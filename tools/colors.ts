// User colour overrides (ADR-007): frost.colors.json → a per-icon hex substitution applied inside derive().
//
//   bun tools/colors.ts schema          regenerate schema/frost-colors.schema.json (committed; editors autocomplete it)
//   bun tools/colors.ts check FILE      validate a config and print what it changes
//
// A colour is any CSS colour ("coral", "#E8573C", "rgb(…)", "oklch(…)"). One colour is the gradient's mid-tone:
// Frost derives the glass gradient's light and deep ends the way its own palette does (OKLCH offsets of the
// nearest built-in hues). {"light", "deep"} sets both ends exactly. Glass, alphas and white glyphs never change.
import { converter, formatHex, parse, toGamut, wcagContrast, type Oklch } from "culori";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ROOT, SRC, palette, setRecolor, sources, isFolder, type Source, type Token } from "./lib";

export type Pair = { light: string; deep: string };
export type ColorValue = string | Pair;
export type ColorConfig = {
  $schema?: string;
  version?: 1;
  palette?: Record<string, ColorValue>;
  folders?: ColorValue;
  filetypes?: ColorValue | Record<string, ColorValue>;
  icons?: Record<string, ColorValue>;
};
export const SCHEMA_URL = "https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/schema/frost-colors.schema.json";
const TOP_KEYS = ["$schema", "version", "palette", "folders", "filetypes", "icons"];
const MIN_CONTRAST = 2.2; // white glyph on the deep end; built-in yellow (1.9:1) gets a lift shadow instead

// ── colour maths ─────────────────────────────────────────────────────────────
const toOklch = converter("oklch");
const toOklab = converter("oklab");
const hex = (c: Oklch) => formatHex(toGamut("rgb", "oklch")(c)).toUpperCase();
const hueDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

type Offsets = { hue: number; chroma: number; dl: [number, number]; cr: [number, number]; dh: [number, number] };

/** Mid-tone of a built-in pair: the OKLab average of its light and deep ends. */
export function midTone(t: Pair): Oklch {
  const a = toOklab(t.light)!, b = toOklab(t.deep)!;
  return toOklch({ mode: "oklab", l: (a.l + b.l) / 2, a: (a.a + b.a) / 2, b: (a.b + b.b) / 2 })!;
}

let offsetsCache: Offsets[] | null = null;
/** How each built-in token's light/deep ends sit around its mid-tone, sorted by hue. */
function tokenOffsets(): Offsets[] {
  if (offsetsCache) return offsetsCache;
  offsetsCache = palette().map((t): Offsets => {
    const m = midTone(t), l = toOklch(t.light)!, d = toOklch(t.deep)!;
    const mh = m.h ?? 0;
    return {
      hue: mh, chroma: m.c,
      dl: [l.l - m.l, d.l - m.l], cr: [l.c / Math.max(m.c, 1e-4), d.c / Math.max(m.c, 1e-4)],
      dh: [hueDiff(l.h ?? mh, mh), hueDiff(d.h ?? mh, mh)],
    };
  }).sort((a, b) => a.hue - b.hue);
  return offsetsCache!;
}

/** One colour → the gradient pair, interpolating the offsets of the two built-in hues around it. */
export function derivePair(input: string): Pair {
  const c = toOklch(parse(input)!)!;
  const all = tokenOffsets();
  const chromatic = all.filter((o) => o.chroma > 0.04);
  let o: Omit<Offsets, "hue" | "chroma">;
  if (c.c < 0.04 || c.h === undefined) {
    o = all.reduce((a, b) => (a.chroma < b.chroma ? a : b)); // near-grey input: the graphite recipe
  } else {
    const h = c.h;
    const up = chromatic.find((t) => t.hue >= h) ?? chromatic[0];
    const down = [...chromatic].reverse().find((t) => t.hue <= h) ?? chromatic[chromatic.length - 1];
    const span = (up.hue - down.hue + 360) % 360 || 360;
    const k = up === down ? 0 : ((h - down.hue + 360) % 360) / span;
    const mix = (a: [number, number], b: [number, number]): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    o = { dl: mix(down.dl, up.dl), cr: mix(down.cr, up.cr), dh: mix(down.dh, up.dh) };
  }
  const end = (i: 0 | 1): Oklch => ({ mode: "oklch", l: Math.min(0.98, Math.max(0.2, c.l + o.dl[i])), c: c.c * o.cr[i], h: ((c.h ?? 0) + o.dh[i] + 360) % 360 });
  return { light: hex(end(0)), deep: hex(end(1)) };
}

function toPair(v: ColorValue): Pair {
  if (typeof v === "string") return derivePair(v);
  return { light: hex(toOklch(parse(v.light)!)!), deep: hex(toOklch(parse(v.deep)!)!) };
}

// ── what each source is ──────────────────────────────────────────────────────
type IconInfo = { name: string; token: Token | undefined; category: string | undefined; folder: boolean; filetype: boolean };

/** The token an SVG is tinted with: its #tint gradient's two stops name exactly one palette pair. */
export function tokenOf(svg: string): Token | undefined {
  const grad = svg.match(/<linearGradient id="tint"[^]*?<\/linearGradient>/)?.[0] ?? "";
  const stops = [...grad.matchAll(/stop-color="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase());
  return palette().find((t) => t.light === stops[0] && t.deep === stops[1]);
}

export function info(src: Source, svg = readFileSync(src.file, "utf8")): IconInfo {
  return {
    name: src.name, token: tokenOf(svg), folder: isFolder(src), filetype: src.context === "mimetypes",
    category: svg.match(/data-category="([^"]+)"/)?.[1],
  };
}

/** Every file-type category and its token, read from the generated sources. */
export function categories(): Map<string, string> {
  const out = new Map<string, string>();
  for (const s of sources().filter((s) => s.context === "mimetypes")) {
    const i = info(s);
    if (i.category && i.token) out.set(i.category, i.token.name);
  }
  return out;
}

// ── validation ───────────────────────────────────────────────────────────────
function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function unknown(where: string, key: string, valid: string[]): string {
  const near = valid.map((v) => [v, lev(key, v)] as const).sort((a, b) => a[1] - b[1])[0];
  const hint = near && near[1] <= Math.max(2, key.length / 3) ? ` — did you mean "${near[0]}"?` : "";
  const list = valid.length <= 40 ? ` Valid: ${valid.join(", ")}.` : "";
  return `${where}: unknown key "${key}"${hint}${list}`;
}

function checkValue(where: string, v: unknown, errors: string[]) {
  const ok = (s: unknown) => typeof s === "string" && parse(s) !== undefined;
  if (typeof v === "string") { if (!ok(v)) errors.push(`${where}: "${v}" is not a CSS colour (try "#E8573C", "coral" or "oklch(0.7 0.15 30)")`); return; }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) if (k !== "light" && k !== "deep") errors.push(unknown(where, k, ["light", "deep"]));
    for (const k of ["light", "deep"]) if (!ok(o[k])) errors.push(`${where}.${k}: needs a CSS colour`);
    return;
  }
  errors.push(`${where}: expected a colour string or {"light": …, "deep": …}`);
}

export function validate(cfg: unknown): string[] {
  const errors: string[] = [];
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return ["the file must be a JSON object"];
  const c = cfg as Record<string, unknown>;
  const tokens = palette().map((t) => t.name), cats = [...categories().keys()].sort(), names = sources().map((s) => s.name);
  for (const k of Object.keys(c)) if (!TOP_KEYS.includes(k)) errors.push(unknown("top level", k, TOP_KEYS.slice(1)));
  if (c.version !== undefined && c.version !== 1) errors.push(`version: ${JSON.stringify(c.version)} — this Frost understands version 1`);
  const map = (key: string, valid: string[]) => {
    const v = c[key];
    if (v === undefined) return;
    if (!v || typeof v !== "object" || Array.isArray(v)) { errors.push(`${key}: expected an object`); return; }
    for (const [k, val] of Object.entries(v)) valid.includes(k) ? checkValue(`${key}.${k}`, val, errors) : errors.push(unknown(key, k, valid));
  };
  map("palette", tokens);
  map("icons", names);
  if (c.folders !== undefined) checkValue("folders", c.folders, errors);
  if (c.filetypes !== undefined) {
    const f = c.filetypes as Record<string, unknown>;
    const isPair = f && typeof f === "object" && ("light" in f || "deep" in f);
    if (typeof f === "string" || isPair) checkValue("filetypes", f, errors);
    else map("filetypes", cats);
  }
  return errors;
}

// ── resolution: config → per-icon substitution ───────────────────────────────
export type Resolved = { config: ColorConfig; file: string; warnings: string[]; recolor: (src: Source, svg: string) => string };

export function presetPath(arg: string): string {
  if (existsSync(arg)) return arg;
  const preset = join(ROOT, "presets", `${arg.replace(/\.json$/, "")}.json`);
  if (existsSync(preset)) return preset;
  throw new Error(`--colors ${arg}: no such file, and no preset presets/${basename(preset)}`);
}

export function resolve(file: string): Resolved {
  let config: ColorConfig;
  try { config = JSON.parse(readFileSync(file, "utf8")); } catch (e) { throw new Error(`${file}: not valid JSON (${(e as Error).message})`); }
  const errors = validate(config);
  if (errors.length) throw new Error(`${file}:\n  ${errors.join("\n  ")}`);
  const tokens = palette();
  const global = new Map<string, Pair>(); // token name → pair, applied to every use of that token
  for (const [k, v] of Object.entries(config.palette ?? {})) global.set(k, toPair(v));
  const folders = config.folders !== undefined ? toPair(config.folders) : undefined;
  const ft = config.filetypes;
  const ftAll = typeof ft === "string" || (ft && ("light" in ft || "deep" in ft)) ? toPair(ft as ColorValue) : undefined;
  const ftCat = new Map<string, Pair>(!ftAll && ft ? Object.entries(ft as Record<string, ColorValue>).map(([k, v]) => [k, toPair(v)]) : []);
  const icons = new Map<string, Pair>(Object.entries(config.icons ?? {}).map(([k, v]) => [k, toPair(v)]));

  const warnings: string[] = [];
  const warn = (where: string, p: Pair) => {
    const r = wcagContrast(p.deep, "#FFFFFF");
    if (r < MIN_CONTRAST) warnings.push(`${where}: ${p.deep} is light (${r.toFixed(1)}:1 against the white symbols) — they will be hard to read`);
  };
  for (const [k, p] of global) warn(`palette.${k}`, p);
  if (folders) warn("folders", folders);
  if (ftAll) warn("filetypes", ftAll);
  for (const [k, p] of ftCat) warn(`filetypes.${k}`, p);
  for (const [k, p] of icons) warn(`icons.${k}`, p);

  const recolor = (src: Source, svg: string): string => {
    const i = info(src, svg);
    const own = icons.get(i.name) ?? (i.folder ? folders : undefined) ?? (i.filetype ? ftCat.get(i.category ?? "") ?? ftAll : undefined);
    const subst = new Map<string, string>();
    for (const t of tokens) {
      const p = t === i.token && own ? own : global.get(t.name);
      if (p) { subst.set(t.light, p.light); subst.set(t.deep, p.deep); }
    }
    if (!subst.size) return svg;
    return svg.replace(/#[0-9A-Fa-f]{6}\b/g, (h) => subst.get(h.toUpperCase()) ?? h);
  };
  return { config, file, warnings, recolor };
}

/** Load a config (path or preset name) and install it into derive(). Returns it for the caller to report. */
export function applyColors(arg: string): Resolved {
  const r = resolve(presetPath(arg));
  setRecolor(r.recolor);
  return r;
}

// ── JSON Schema ──────────────────────────────────────────────────────────────
export function schema(): object {
  const colour = { $ref: "#/$defs/colour" };
  const tokens = palette().map((t) => t.name), cats = [...categories().keys()].sort(), names = sources().map((s) => s.name).sort();
  const obj = (keys: string[], desc: string) => ({ type: "object", description: desc, additionalProperties: false, properties: Object.fromEntries(keys.map((k) => [k, colour])) });
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: SCHEMA_URL,
    title: "Frost colours",
    description: "Recolour the Frost icon theme. Leave out anything you want to keep. Install with: sh install.sh --colors frost.colors.json",
    type: "object",
    additionalProperties: false,
    properties: {
      $schema: { type: "string" },
      version: { const: 1, description: "Format version." },
      palette: obj(tokens, "Recolour a palette colour everywhere it is used."),
      folders: { ...colour, description: "Every folder (Home, Documents, Downloads…)." },
      filetypes: { description: "One colour for every file type, or a colour per kind of file.", anyOf: [colour, obj(cats, "Per kind of file.")] },
      icons: obj(names, "One specific icon, by its icon name."),
    },
    $defs: {
      colour: {
        description: "A CSS colour (\"coral\", \"#E8573C\", \"rgb(232 87 60)\", \"oklch(0.68 0.17 35)\") used as the mid-tone — Frost derives the glass gradient — or {\"light\", \"deep\"} for both gradient ends.",
        anyOf: [
          { type: "string", minLength: 3 },
          { type: "object", additionalProperties: false, required: ["light", "deep"], properties: { light: { type: "string" }, deep: { type: "string" } } },
        ],
      },
    },
  };
}

if (import.meta.main) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "schema") {
    const out = join(ROOT, "schema/frost-colors.schema.json");
    writeFileSync(out, JSON.stringify(schema(), null, 2) + "\n");
    console.log(`schema → ${out.replace(ROOT + "/", "")}`);
  } else if (cmd === "check" && arg) {
    try {
      const r = resolve(presetPath(arg));
      const c = r.config;
      const show = (k: string, v: ColorValue) => { const p = toPair(v); console.log(`  ${k.padEnd(24)} ${p.light} → ${p.deep}`); };
      console.log(`${r.file}: ok`);
      for (const [k, v] of Object.entries(c.palette ?? {})) show(`palette.${k}`, v);
      if (c.folders) show("folders", c.folders);
      if (typeof c.filetypes === "string" || (c.filetypes && "light" in c.filetypes)) show("filetypes", c.filetypes as ColorValue);
      else for (const [k, v] of Object.entries(c.filetypes ?? {})) show(`filetypes.${k}`, v as ColorValue);
      for (const [k, v] of Object.entries(c.icons ?? {})) show(`icons.${k}`, v);
      for (const w of r.warnings) console.warn(`⚠ ${w}`);
    } catch (e) { console.error(`✗ ${(e as Error).message}`); process.exit(1); }
  } else {
    console.log("usage: bun tools/colors.ts schema | check FILE|PRESET");
    process.exit(2);
  }
}
