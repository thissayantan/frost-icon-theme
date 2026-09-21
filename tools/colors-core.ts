// The colour-override logic (ADR-007) with no file access, shared by the build (tools/colors.ts) and the
// colour builder web page (site/), so a colour previewed in the browser is exactly the colour that gets installed.
import { converter, formatHex, parse, toGamut, wcagContrast, type Oklch } from "culori";

export type Token = { name: string; light: string; deep: string };
export type Pair = { light: string; deep: string };
export type ColorValue = string | Pair;
export type ColorConfig = {
  $schema?: string;
  version?: 1;
  description?: string;
  palette?: Record<string, ColorValue>;
  folders?: ColorValue;
  filetypes?: ColorValue | Record<string, ColorValue>;
  icons?: Record<string, ColorValue>;
};
/** What the config can name: Frost's palette, its file-type kinds and its icons. */
export type Catalog = { palette: Token[]; categories: string[]; names: string[] };
/** What a single icon is, for deciding which override applies to it. */
export type IconInfo = { name: string; token: Token | undefined; category: string | undefined; folder: boolean; filetype: boolean };

export const SCHEMA_URL = "https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/schema/frost-colors.schema.json";
export const TOP_KEYS = ["$schema", "version", "description", "palette", "folders", "filetypes", "icons"];
export const MIN_CONTRAST = 2.2; // white glyph on the deep end; built-in yellow (1.9:1) gets a lift shadow instead

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

const offsetsCache = new WeakMap<Token[], Offsets[]>();
/** How each built-in token's light/deep ends sit around its mid-tone, sorted by hue. */
function tokenOffsets(palette: Token[]): Offsets[] {
  const hit = offsetsCache.get(palette);
  if (hit) return hit;
  const out = palette.map((t): Offsets => {
    const m = midTone(t), l = toOklch(t.light)!, d = toOklch(t.deep)!;
    const mh = m.h ?? 0;
    return {
      hue: mh, chroma: m.c,
      dl: [l.l - m.l, d.l - m.l], cr: [l.c / Math.max(m.c, 1e-4), d.c / Math.max(m.c, 1e-4)],
      dh: [hueDiff(l.h ?? mh, mh), hueDiff(d.h ?? mh, mh)],
    };
  }).sort((a, b) => a.hue - b.hue);
  offsetsCache.set(palette, out);
  return out;
}

/** One colour → the gradient pair, interpolating the offsets of the two built-in hues around it. */
export function derivePair(input: string, palette: Token[]): Pair {
  const c = toOklch(parse(input)!)!;
  const all = tokenOffsets(palette);
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

export function toPair(v: ColorValue, palette: Token[]): Pair {
  if (typeof v === "string") return derivePair(v, palette);
  return { light: hex(toOklch(parse(v.light)!)!), deep: hex(toOklch(parse(v.deep)!)!) };
}

/** Any CSS colour → #RRGGBB (for colour pickers), or undefined. */
export function toHex(v: string): string | undefined {
  const c = parse(v);
  return c ? formatHex(c).toUpperCase() : undefined;
}

export const contrastOnWhite = (hexColour: string) => wcagContrast(hexColour, "#FFFFFF");

// ── what an SVG is ───────────────────────────────────────────────────────────
/** The token an SVG is tinted with: its #tint gradient's two stops name exactly one palette pair. */
export function tokenOf(svg: string, palette: Token[]): Token | undefined {
  const grad = svg.match(/<linearGradient id="tint"[^]*?<\/linearGradient>/)?.[0] ?? "";
  const stops = [...grad.matchAll(/stop-color="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase());
  return palette.find((t) => t.light === stops[0] && t.deep === stops[1]);
}

export const categoryOf = (svg: string) => svg.match(/data-category="([^"]+)"/)?.[1];

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

export function validate(cfg: unknown, cat: Catalog): string[] {
  const errors: string[] = [];
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return ["the file must be a JSON object"];
  const c = cfg as Record<string, unknown>;
  const tokens = cat.palette.map((t) => t.name);
  for (const k of Object.keys(c)) if (!TOP_KEYS.includes(k)) errors.push(unknown("top level", k, TOP_KEYS.slice(1)));
  if (c.version !== undefined && c.version !== 1) errors.push(`version: ${JSON.stringify(c.version)} — this Frost understands version 1`);
  if (c.description !== undefined && typeof c.description !== "string") errors.push("description: expected text");
  const map = (key: string, valid: string[]) => {
    const v = c[key];
    if (v === undefined) return;
    if (!v || typeof v !== "object" || Array.isArray(v)) { errors.push(`${key}: expected an object`); return; }
    for (const [k, val] of Object.entries(v)) valid.includes(k) ? checkValue(`${key}.${k}`, val, errors) : errors.push(unknown(key, k, valid));
  };
  map("palette", tokens);
  map("icons", cat.names);
  if (c.folders !== undefined) checkValue("folders", c.folders, errors);
  if (c.filetypes !== undefined) {
    const f = c.filetypes as Record<string, unknown>;
    const isPair = f && typeof f === "object" && ("light" in f || "deep" in f);
    if (typeof f === "string" || isPair) checkValue("filetypes", f, errors);
    else map("filetypes", cat.categories);
  }
  return errors;
}

// ── resolution: config → per-icon substitution ───────────────────────────────
export type Recolor = { warnings: string[]; apply: (info: IconInfo, svg: string) => string };

/** A validated config → warnings + a function that recolours one icon's SVG text. */
export function makeRecolor(config: ColorConfig, palette: Token[]): Recolor {
  const pair = (v: ColorValue) => toPair(v, palette);
  const global = new Map<string, Pair>(); // token name → pair, applied to every use of that token
  for (const [k, v] of Object.entries(config.palette ?? {})) global.set(k, pair(v));
  const folders = config.folders !== undefined ? pair(config.folders) : undefined;
  const ft = config.filetypes;
  const ftAll = typeof ft === "string" || (ft && ("light" in ft || "deep" in ft)) ? pair(ft as ColorValue) : undefined;
  const ftCat = new Map<string, Pair>(!ftAll && ft ? Object.entries(ft as Record<string, ColorValue>).map(([k, v]) => [k, pair(v)]) : []);
  const icons = new Map<string, Pair>(Object.entries(config.icons ?? {}).map(([k, v]) => [k, pair(v)]));

  const warnings: string[] = [];
  const warn = (where: string, p: Pair) => {
    const r = contrastOnWhite(p.deep);
    if (r < MIN_CONTRAST) warnings.push(`${where}: ${p.deep} is light (${r.toFixed(1)}:1 against the white symbols) — they will be hard to read`);
  };
  for (const [k, p] of global) warn(`palette.${k}`, p);
  if (folders) warn("folders", folders);
  if (ftAll) warn("filetypes", ftAll);
  for (const [k, p] of ftCat) warn(`filetypes.${k}`, p);
  for (const [k, p] of icons) warn(`icons.${k}`, p);

  const apply = (i: IconInfo, svg: string): string => {
    const own = icons.get(i.name) ?? (i.folder ? folders : undefined) ?? (i.filetype ? ftCat.get(i.category ?? "") ?? ftAll : undefined);
    const subst = new Map<string, string>();
    for (const t of palette) {
      const p = own && t.name === i.token?.name ? own : global.get(t.name);
      if (p) { subst.set(t.light, p.light); subst.set(t.deep, p.deep); }
    }
    if (!subst.size) return svg;
    return svg.replace(/#[0-9A-Fa-f]{6}\b/g, (h) => subst.get(h.toUpperCase()) ?? h);
  };
  return { warnings, apply };
}

// ── sharing a config in a link (the builder page ↔ install.sh --colors URL) ──
/** Config → URL-safe base64 of its JSON, for `?c=` in a builder link. */
export function encodeConfig(config: ColorConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(config));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeConfig(s: string): ColorConfig {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
}
