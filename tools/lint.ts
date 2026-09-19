// Lint SVG sources: viewBox, layer ids, palette-only colours, no raster embeds, naming, aliases.
import { DOMParser } from "@xmldom/xmldom";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { CONTEXTS, NAME_RE, REQUIRED_LAYERS, ROOT, SRC, aliases, allowedColours, sources, walk } from "./lib";

const COLOUR_ATTRS = ["fill", "stroke", "stop-color", "flood-color", "lighting-color", "color"];
const NON_COLOURS = new Set(["none", "currentColor", "inherit", "transparent"]);

export function lint(): string[] {
  const errors: string[] = [];
  const allowed = allowedColours();
  const err = (file: string, msg: string) => errors.push(`${relative(ROOT, file)}: ${msg}`);

  // stray files / directories
  for (const f of readdirSync(SRC)) {
    if (!["_templates", "aliases.json", ...Object.keys(CONTEXTS)].includes(f)) err(join(SRC, f), "unexpected entry in src/");
  }

  const files = [...walk(join(SRC, "_templates")), ...Object.keys(CONTEXTS).flatMap((c) => walk(join(SRC, c)))];
  for (const file of files) {
    const base = file.slice(file.lastIndexOf("/") + 1);
    if (base === ".gitkeep") continue;
    if (!base.endsWith(".svg")) { err(file, "only .svg files belong in src/<context>/"); continue; }
    if (!NAME_RE.test(base)) err(file, "file name must be lower-case ASCII with no spaces");

    const text = readFileSync(file, "utf8");
    const parseErrors: string[] = [];
    const doc = new DOMParser({ onError: (level, msg) => { if (level !== "warning") parseErrors.push(msg); } })
      .parseFromString(text, "image/svg+xml");
    if (parseErrors.length) { err(file, `XML parse error: ${parseErrors[0]}`); continue; }
    const svg = doc.documentElement!;
    if (svg.getAttribute("viewBox") !== "0 0 128 128") err(file, `viewBox must be "0 0 128 128"`);

    const all = Array.from(svg.getElementsByTagName("*"));
    const ids = new Set(all.map((e) => e.getAttribute("id")).filter(Boolean));
    const isOverride = /\.\d+\.svg$/.test(base);
    const required = isOverride ? ["back", "glyph"] : REQUIRED_LAYERS;
    for (const id of required) if (!ids.has(id)) err(file, `missing layer id "${id}"`);

    for (const el of [svg, ...all]) {
      const tag = el.tagName;
      if (tag === "image" || tag === "script" || tag === "foreignObject") err(file, `<${tag}> is not allowed`);
      if (tag === "text" && !base.includes("calendar")) err(file, "text is only allowed in calendar icons");
      for (const a of ["href", "xlink:href"]) {
        const v = el.getAttribute(a);
        if (v && !v.startsWith("#")) err(file, `external/embedded reference not allowed: ${a}="${v.slice(0, 32)}…"`);
      }
      const values: [string, string][] = COLOUR_ATTRS.flatMap((a) => (el.hasAttribute(a) ? [[a, el.getAttribute(a)!]] : []));
      const style = el.getAttribute("style");
      if (style) for (const decl of style.split(";")) {
        const [k, v] = decl.split(":").map((s) => s?.trim());
        if (k && v && COLOUR_ATTRS.includes(k)) values.push([k, v]);
      }
      for (const [attr, v] of values) {
        if (NON_COLOURS.has(v) || v.startsWith("url(#")) continue;
        const hex = v.match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/)?.[0]?.toUpperCase();
        const full = hex?.length === 4 ? "#" + [...hex.slice(1)].map((c) => c + c).join("") : hex;
        if (!full) err(file, `${attr}="${v}" — use a #RRGGBB palette value`);
        else if (!allowed.has(full)) err(file, `${attr}="${v}" is not a palette token (DESIGN §3)`);
      }
    }
  }

  // names + aliases
  const shipped = new Map<string, string>();
  for (const s of sources()) {
    if (s.name.endsWith("-symbolic")) err(s.file, "symbolic icons are out of scope (inherit from Adwaita)");
    const prev = shipped.get(s.name);
    if (prev) err(s.file, `duplicate icon name also in src/${prev}`);
    shipped.set(s.name, s.context);
  }
  const seen = new Set<string>();
  for (const [target, names] of Object.entries(aliases())) {
    const f = join(SRC, "aliases.json");
    if (!shipped.has(target)) console.warn(`! aliases.json: target "${target}" not drawn yet — skipped`);
    for (const n of names) {
      if (!NAME_RE.test(n)) err(f, `alias "${n}" is not a valid icon name`);
      if (shipped.has(n)) err(f, `alias "${n}" collides with a shipped icon`);
      if (seen.has(n)) err(f, `alias "${n}" listed twice`);
      seen.add(n);
    }
  }
  return errors;
}

if (import.meta.main) {
  const errors = lint();
  for (const e of errors) console.error(`✗ ${e}`);
  console.log(errors.length ? `lint: ${errors.length} problem(s)` : "lint: ok");
  process.exit(errors.length ? 1 : 0);
}
