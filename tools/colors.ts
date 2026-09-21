// User colour overrides (ADR-007): frost.colors.json → a per-icon hex substitution applied inside derive().
//
//   bun tools/colors.ts schema          regenerate schema/frost-colors.schema.json (committed; editors autocomplete it)
//   bun tools/colors.ts check FILE      validate a config and print what it changes
//
// The logic lives in colors-core.ts (no file access) so the colour builder page uses exactly the same code; this
// file feeds it Frost's real palette, file-type kinds and icons.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  SCHEMA_URL, categoryOf, derivePair as derivePairWith, makeRecolor, midTone, toPair as toPairWith, tokenOf as tokenOfWith,
  validate as validateWith, type Catalog, type ColorConfig, type ColorValue, type IconInfo, type Pair,
} from "./colors-core";
import { ROOT, isFolder, palette, setRecolor, sources, type Source, type Token } from "./lib";

export { midTone, type ColorConfig, type ColorValue, type Pair };
export const derivePair = (input: string): Pair => derivePairWith(input, palette());
const toPair = (v: ColorValue): Pair => toPairWith(v, palette());
export const tokenOf = (svg: string): Token | undefined => tokenOfWith(svg, palette());

export function info(src: Source, svg = readFileSync(src.file, "utf8")): IconInfo {
  return { name: src.name, token: tokenOf(svg), folder: isFolder(src), filetype: src.context === "mimetypes", category: categoryOf(svg) };
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

export function catalog(): Catalog {
  return { palette: palette(), categories: [...categories().keys()].sort(), names: sources().map((s) => s.name) };
}
export const validate = (cfg: unknown): string[] => validateWith(cfg, catalog());

// ── resolution ───────────────────────────────────────────────────────────────
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
  const r = makeRecolor(config, palette());
  return { config, file, warnings: r.warnings, recolor: (src, svg) => r.apply(info(src, svg), svg) };
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
      description: { type: "string", description: "A note for yourself: what this colour set is." },
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
