// Shared helpers for the Frost pipeline: paths, palette, source discovery, size derivation.
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { converter, formatHex, wcagContrast } from "culori";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

export const ROOT = join(import.meta.dir, "..");
export const SRC = join(ROOT, "src");
export const DIST = join(ROOT, "dist");
export const THEME = "Frost";
export const THEME_DIR = join(DIST, THEME);

/** Every size we ship (DESIGN §4), each at @1x and @2x. */
export const SIZES = [16, 22, 24, 32, 48, 64, 96, 128, 256] as const;
export const SCALES = [1, 2] as const;
export const CONTEXTS: Record<string, string> = {
  places: "Places",
  mimetypes: "MimeTypes",
  apps: "Applications",
  devices: "Devices",
};
/** Symbolic status icons (ADR-005): plain recolourable SVG, copied as-is into this directory. */
export const SYMBOLIC_DIR = "symbolic/status";
/** The same art on a 22 px canvas (16 px glyph, 3 px margin) for KDE's 22 px tray — crisp instead of scaled ×1.375. */
export const SYMBOLIC_22_DIR = "symbolic/status-22";
export function pad22(svg: string): string {
  const style = svg.match(/<style id="current-color-scheme"[^]*?<\/style>/)?.[0] ?? "";
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(style, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">${style}<g transform="translate(3 3)">${inner}</g></svg>\n`;
}
export function symbolicSources(): { name: string; file: string }[] {
  return walk(join(SRC, "status")).filter((f) => f.endsWith(".svg"))
    .map((file) => ({ name: file.slice(file.lastIndexOf("/") + 1, -4), file }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const LAYERS = ["shadow", "glow", "back", "frost", "lift", "plate", "rim", "glyph"] as const;
/** `lift` (plate contact shadow) is optional: only icons whose plate leaves the back shape need it. */
export const REQUIRED_LAYERS = ["shadow", "glow", "back", "frost", "plate", "rim", "glyph"];

export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9+_.-]*$/; // app ids are reverse-DNS, mixed case

// ── palette ────────────────────────────────────────────────────────────────
export type Token = { name: string; light: string; deep: string };

/** Palette tokens are parsed from docs/DESIGN.md §3 so the doc stays the single source of truth. */
export function palette(): Token[] {
  const md = readFileSync(join(ROOT, "docs/DESIGN.md"), "utf8");
  const section = md.split("## 3. Palette tokens")[1]?.split("\n## ")[0] ?? "";
  const tokens: Token[] = [];
  for (const m of section.matchAll(/^\|\s*`(\w+)`\s*\|\s*`(#[0-9A-Fa-f]{6})`\s*\|\s*`(#[0-9A-Fa-f]{6})`/gm)) {
    tokens.push({ name: m[1], light: m[2].toUpperCase(), deep: m[3].toUpperCase() });
  }
  if (tokens.length === 0) throw new Error("no palette tokens found in docs/DESIGN.md §3");
  return tokens;
}

export function allowedColours(): Set<string> {
  const s = new Set(["#FFFFFF", "#000000"]);
  for (const t of palette()) s.add(t.light).add(t.deep);
  return s;
}

// ── sources ────────────────────────────────────────────────────────────────
export type Source = {
  context: string; // places | mimetypes | apps | devices
  name: string; // icon name
  file: string; // absolute path of the main source
  overrides: Map<number, string>; // hand-tuned <name>.<size>.svg
};

export function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function sources(only?: string[]): Source[] {
  const byKey = new Map<string, Source>();
  const overrides: [string, string, number, string][] = [];
  for (const ctx of Object.keys(CONTEXTS)) {
    for (const file of walk(join(SRC, ctx))) {
      if (!file.endsWith(".svg")) continue;
      const base = file.slice(file.lastIndexOf("/") + 1, -4);
      const m = base.match(/^(.*)\.(\d+)$/);
      if (m) overrides.push([ctx, m[1], Number(m[2]), file]);
      else byKey.set(`${ctx}/${base}`, { context: ctx, name: base, file, overrides: new Map() });
    }
  }
  for (const [ctx, name, size, file] of overrides) {
    const s = byKey.get(`${ctx}/${name}`);
    if (!s) throw new Error(`override without main source: ${relative(ROOT, file)}`);
    s.overrides.set(size, file);
  }
  let list = [...byKey.values()];
  if (only?.length) list = list.filter((s) => only.includes(s.name));
  return list.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
}

/** The folder family: every folder-shaped place icon (the `folders` colour override targets these). */
export function isFolder(s: Source): boolean {
  return s.context === "places" && (s.name.startsWith("folder") || s.name === "user-home" || s.name === "user-desktop");
}

/** Sheet order: folder anchor first, then the folder family, places, mimetypes, the rest. */
function order(s: Source): number {
  if (s.name === "folder") return 0;
  if (isFolder(s)) return 1;
  return { places: 2, mimetypes: 3, devices: 4, apps: 5 }[s.context] ?? 9;
}

export type Aliases = Record<string, string[]>;
export function aliases(): Aliases {
  const raw = JSON.parse(readFileSync(join(SRC, "aliases.json"), "utf8"));
  delete raw.$comment;
  return raw;
}

// ── size derivation (DESIGN §4, ADR-003) ─────────────────────────────────────
const parser = new DOMParser();
const toOklch = converter("oklch");
const serializer = new XMLSerializer();

function byId(doc: Document, id: string): Element | null {
  const all = doc.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) if (all[i].getAttribute("id") === id) return all[i];
  return null;
}

function remove(doc: Document, ...ids: string[]) {
  for (const id of ids) {
    const el = byId(doc, id);
    el?.parentNode?.removeChild(el);
  }
}

function setBlur(doc: Document, filterId: string, sigma: number) {
  const f = byId(doc, filterId);
  const blur = f?.getElementsByTagName("feGaussianBlur")[0];
  blur?.setAttribute("stdDeviation", String(sigma));
}

/**
 * Minimum glyph stroke at small sizes: 2 px at target size, expressed in 128-canvas units.
 * `scale` is any enlargement applied afterwards (the generic re-layout), so the result is still 2 px.
 */
function thickenGlyph(doc: Document, size: number, scale = 1) {
  const glyph = byId(doc, "glyph");
  if (!glyph) return;
  const min = (2 * 128) / size / scale;
  const nodes = [glyph, ...Array.from(glyph.getElementsByTagName("*"))];
  for (const n of nodes) {
    const w = n.getAttribute("stroke-width");
    if (w && Number(w) < min) n.setAttribute("stroke-width", min.toFixed(2));
  }
}

/** Glyph enlargement in the small-size generic re-layout (DESIGN §4). */
const RELAYOUT_SCALE = 2;

const rectBox = (el: Element | null) =>
  el?.tagName === "rect"
    ? ["x", "y", "width", "height"].map((a) => Number(el.getAttribute(a) ?? 0)) as [number, number, number, number]
    : null;

/**
 * ≤48 px, generic layout (rect back + rect plate that leaves the back): with the plate gone the glyph
 * would hang off the back shape, so the back grows to the live area and the glyph moves to its centre.
 */
function isGeneric(doc: Document): boolean {
  const b = rectBox(byId(doc, "back-shape")), p = rectBox(byId(doc, "plate-shape"));
  if (!b || !p) return false;
  return !(p[0] >= b[0] && p[1] >= b[1] && p[0] + p[2] <= b[0] + b[2] && p[1] + p[3] <= b[1] + b[3]);
}

/** App family: squircle back (x 12, width 104) with the object plate drawn inside it. */
function isApp(doc: Document): boolean {
  const b = rectBox(byId(doc, "back-shape"));
  return !!b && b[0] === 12 && b[2] === 104 && byId(doc, "plate-shape")?.tagName === "path";
}

function knockout(doc: Document) {
  let deep = byId(doc, "tint")?.getElementsByTagName("stop")[1]?.getAttribute("stop-color")?.toUpperCase() ?? "#000000";
  deep = knockoutInk(deep);
  const plate = byId(doc, "plate");
  plate?.setAttribute("fill", "#FFFFFF");
  plate?.removeAttribute("fill-opacity");
  const glyph = byId(doc, "glyph");
  if (!glyph) return;
  for (const n of [glyph, ...Array.from(glyph.getElementsByTagName("*"))]) {
    if (n.getAttribute("data-keep-white")) continue; // hand-drawn small glyph meant to stay white on the tint
    for (const a of ["fill", "stroke"]) if (n.getAttribute(a)?.toUpperCase() === "#FFFFFF") n.setAttribute(a, deep);
  }
}

/**
 * The glyph colour on a knockout's white plate must read on white. Built-in yellow's deep (~1.9:1) borrows
 * orange's deep; any other ink under 3:1 (a light user colour) is darkened in OKLCH until it reaches 3:1.
 */
function knockoutInk(deep: string): string {
  if (deep === "#FFAA1F") return "#FF7430";
  const c = toOklch(deep);
  if (!c) return deep;
  while (wcagContrast(formatHex(c), "#FFFFFF") < 3 && c.l > 0.05) c.l -= 0.02;
  return formatHex(c).toUpperCase();
}

/** A hinted glyph is already drawn for the re-laid-out back, so only the back moves. */
function recentreOnBack(doc: Document, size: number, moveGlyph = true) {
  if (!isGeneric(doc)) return;
  const back = byId(doc, "back-shape"), plate = rectBox(byId(doc, "plate-shape"))!;
  const glyph = byId(doc, "glyph");
  if (!glyph) return;
  // Snap the squircle to whole pixels: 1 px padding up to 24 px, then 8/128 of the size (floored).
  const u = 128 / size, pad = Math.max(1, Math.floor((8 * size) / 128)) * u;
  back!.setAttribute("x", String(pad)); back!.setAttribute("y", String(pad));
  back!.setAttribute("width", String(128 - 2 * pad)); back!.setAttribute("height", String(128 - 2 * pad));
  back!.setAttribute("rx", String(Math.round((28 * size) / 128) * u));
  if (!moveGlyph) return;
  // Generic glyphs are centred at plate centre + (2, −2) = (58, 74) so they clear the back's r20 corner.
  const [cx, cy] = [plate[0] + plate[2] / 2 + 2, plate[1] + plate[3] / 2 - 2];
  const k = RELAYOUT_SCALE;
  const prev = glyph.getAttribute("transform") ?? "";
  glyph.setAttribute("transform", `translate(64 64) scale(${k}) translate(${-cx} ${-cy}) ${prev}`.trim());
}

/**
 * Return the SVG to render for a logical size. @2x renders use the same variant as @1x
 * (48@2x = 96 px with 48 px detail).
 */
/** User colour overrides (ADR-007, tools/colors.ts) — a text substitution of palette hex values per icon. */
let recolor: ((src: Source, svg: string) => string) | null = null;
export function setRecolor(f: typeof recolor) { recolor = f; }
const read = (src: Source, file: string) => (recolor ? recolor(src, readFileSync(file, "utf8")) : readFileSync(file, "utf8"));

export function derive(src: Source, size: number): string {
  const override = src.overrides.get(size);
  if (override) return read(src, override);
  const doc = parser.parseFromString(read(src, src.file), "image/svg+xml") as unknown as Document;
  // Pixel-grid hints: <path id="back-shape-24"> replaces #back-shape's geometry at 24 px (and 24@2x).
  for (const id of ["back-shape", "plate-shape"]) {
    const hint = byId(doc, `${id}-${size}`), base = byId(doc, id);
    if (hint && base) base.setAttribute("d", hint.getAttribute("d")!);
  }
  // Glyph hints: <g id="glyph-24"> in <defs> replaces the contents of #glyph at 24 px.
  const glyphHint = byId(doc, `glyph-${size}`), glyph = byId(doc, "glyph");
  const hinted = !!(glyphHint && glyph);
  if (glyphHint && glyph) {
    while (glyph.firstChild) glyph.removeChild(glyph.firstChild);
    for (const attr of Array.from(glyphHint.attributes)) if (attr.name !== "id") glyph.setAttribute(attr.name, attr.value);
    while (glyphHint.firstChild) glyph.appendChild(glyphHint.firstChild);
  }
  if (doc.documentElement?.getAttribute("data-family") === "sheet") {
    sheet(doc, size, hinted);
  } else if (size >= 64) {
    // full glass
  } else if (size <= 48 && isGeneric(doc)) {
    // generic layout ≤ 48 px: a plate hanging off the back is mud at this size — squircle + centred glyph
    remove(doc, "shadow", "glow", "frost", "lift", "plate", "rim");
    recentreOnBack(doc, size, !hinted);
    if (!hinted) thickenGlyph(doc, size, RELAYOUT_SCALE);
  } else if (size >= 32) {
    // A blurred glow wider than the pixel-hinted edge re-softens the silhouette on light backgrounds:
    // gone at 32, faint at 48.
    if (size < 48) remove(doc, "shadow", "glow");
    else remove(doc, "shadow");
    setBlur(doc, "blur-glow", 4);
    byId(doc, "glow")?.setAttribute("opacity", ".15");
  } else if (isApp(doc)) {
    // App family ≤ 24 px: knockout — the object plate goes solid white, the glyph takes the back's deep tint.
    remove(doc, "shadow", "glow", "frost", "lift", "rim");
    knockout(doc);
  } else if (size >= 22) {
    remove(doc, "shadow", "glow", "frost", "rim");
    const plate = byId(doc, "plate");
    plate?.setAttribute("fill", "#FFFFFF");
    // page family: a 40 % flap makes the pastel lower half too light for a white glyph — keep it at 20 %
    plate?.setAttribute("fill-opacity", src.context === "mimetypes" ? ".20" : ".40");
    if (!hinted) thickenGlyph(doc, size);
  } else {
    remove(doc, "shadow", "glow", "frost", "lift", "plate", "rim");
    recentreOnBack(doc, size, !hinted);
    if (!hinted) thickenGlyph(doc, size, isGeneric(doc) ? RELAYOUT_SCALE : 1);
  }
  return serializer.serializeToString(doc as any);
}

/**
 * Sheet family (file types, DESIGN §6): tinted glass page in front of a deeper sheet. The type label shows
 * from 48 px (pixel caps at 48); below that the glyph moves down to the glass centre, and at ≤ 24 px the glass
 * goes solid (token gradient) with the sheet peeking — at 16 px the sheet goes too.
 */
function sheet(doc: Document, size: number, hinted: boolean) {
  const label = byId(doc, "label"), label48 = byId(doc, "label-48");
  if (size === 48 && label && label48) {
    while (label.firstChild) label.removeChild(label.firstChild);
    for (const attr of Array.from(label48.attributes)) if (attr.name !== "id") label.setAttribute(attr.name, attr.value);
    while (label48.firstChild) label.appendChild(label48.firstChild);
  } else if (size < 48 && label) {
    label.parentNode?.removeChild(label);
  }
  const glyph = byId(doc, "glyph");
  if (size < 48) glyph?.removeAttribute("filter"); // yellow's lift shadow is for the glass sizes only
  if (size < 48 && !hinted && label && glyph) {
    const shift = Number(doc.documentElement?.getAttribute("data-glyph-shift") ?? 0);
    // no label: room to grow — the glyph moves to the glass centre and scales up 1.3×
    glyph.setAttribute("transform", `translate(0 ${shift}) ${glyph.getAttribute("transform") ?? ""} scale(1.3)`.trim());
  }
  if (size >= 64) return;
  if (size >= 48) {
    remove(doc, "shadow");
    setBlur(doc, "blur-glow", 4);
    byId(doc, "glow")?.setAttribute("opacity", ".15");
  } else {
    // ≤ 32 px: translucent glass over a pastel is too pale for a white glyph — the glass goes solid tint
    remove(doc, "shadow", "glow", "frost", "depth", "rim");
    byId(doc, "back")?.removeAttribute("mask"); // the page is opaque here; the mask's anti-aliased corner would notch the sheet
    if (size >= 32 && !hinted) thickenGlyph(doc, size, 1.3);
    byId(doc, "plate")?.setAttribute("fill", "url(#tint)");
    if (size <= 16) remove(doc, "back");
  }
}

export function dirName(size: number, scale: number, ctx: string) {
  return `${size}x${size}${scale === 2 ? "@2x" : ""}/${ctx}`;
}

/** Parse `--flag value` / `--flag a,b` style args. */
export function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
