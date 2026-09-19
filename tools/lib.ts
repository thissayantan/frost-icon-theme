// Shared helpers for the Hyaline pipeline: paths, palette, source discovery, size derivation.
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

export const ROOT = join(import.meta.dir, "..");
export const SRC = join(ROOT, "src");
export const DIST = join(ROOT, "dist");
export const THEME = "Hyaline";
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
export const LAYERS = ["shadow", "glow", "back", "frost", "lift", "plate", "rim", "glyph"] as const;
/** `lift` (plate contact shadow) is optional: only icons whose plate leaves the back shape need it. */
export const REQUIRED_LAYERS = ["shadow", "glow", "back", "frost", "plate", "rim", "glyph"];

export const NAME_RE = /^[a-z0-9][a-z0-9+_.-]*$/;

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

/** Sheet order: folder anchor first, then the folder family, places, mimetypes, the rest. */
function order(s: Source): number {
  if (s.name === "folder") return 0;
  if (s.name.startsWith("folder") || s.name === "user-home" || s.name === "user-desktop") return 1;
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

/** Minimum glyph stroke at small sizes: 2 px at target size, expressed in 128-canvas units. */
function thickenGlyph(doc: Document, size: number) {
  const glyph = byId(doc, "glyph");
  if (!glyph) return;
  const min = (2 * 128) / size;
  const nodes = [glyph, ...Array.from(glyph.getElementsByTagName("*"))];
  for (const n of nodes) {
    const w = n.getAttribute("stroke-width");
    if (w && Number(w) < min) n.setAttribute("stroke-width", min.toFixed(2));
  }
}

const rectBox = (el: Element | null) =>
  el?.tagName === "rect"
    ? ["x", "y", "width", "height"].map((a) => Number(el.getAttribute(a) ?? 0)) as [number, number, number, number]
    : null;

/**
 * ≤32 px, generic layout (rect back + rect plate that leaves the back): with the plate gone the glyph
 * would hang off the back shape, so the back grows to the live area and the glyph moves to its centre.
 */
function isGeneric(doc: Document): boolean {
  const b = rectBox(byId(doc, "back-shape")), p = rectBox(byId(doc, "plate-shape"));
  if (!b || !p) return false;
  return !(p[0] >= b[0] && p[1] >= b[1] && p[0] + p[2] <= b[0] + b[2] && p[1] + p[3] <= b[1] + b[3]);
}

/** A hinted glyph is already drawn for the re-laid-out back, so only the back moves. */
function recentreOnBack(doc: Document, moveGlyph = true) {
  if (!isGeneric(doc)) return;
  const back = byId(doc, "back-shape"), plate = rectBox(byId(doc, "plate-shape"))!;
  const glyph = byId(doc, "glyph");
  if (!glyph) return;
  back!.setAttribute("x", "8"); back!.setAttribute("y", "8");
  back!.setAttribute("width", "112"); back!.setAttribute("height", "112"); back!.setAttribute("rx", "28");
  if (!moveGlyph) return;
  const [cx, cy] = [plate[0] + plate[2] / 2, plate[1] + plate[3] / 2];
  const k = 1.6;
  const prev = glyph.getAttribute("transform") ?? "";
  glyph.setAttribute("transform", `translate(64 64) scale(${k}) translate(${-cx} ${-cy}) ${prev}`.trim());
}

/**
 * Return the SVG to render for a logical size. @2x renders use the same variant as @1x
 * (48@2x = 96 px with 48 px detail).
 */
export function derive(src: Source, size: number): string {
  const override = src.overrides.get(size);
  if (override) return readFileSync(override, "utf8");
  const doc = parser.parseFromString(readFileSync(src.file, "utf8"), "image/svg+xml") as unknown as Document;
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
  if (size >= 64) {
    // full glass
  } else if (size < 48 && isGeneric(doc)) {
    // generic layout ≤ 32 px: a plate hanging off the back is mud at this size — squircle + centred glyph
    remove(doc, "shadow", "glow", "frost", "lift", "plate", "rim");
    recentreOnBack(doc, !hinted);
    if (!hinted) thickenGlyph(doc, size);
  } else if (size >= 32) {
    // A blurred glow wider than the pixel-hinted edge re-softens the silhouette on light backgrounds:
    // gone at 32, faint at 48.
    if (size < 48) remove(doc, "shadow", "glow");
    else remove(doc, "shadow");
    setBlur(doc, "blur-glow", 4);
    byId(doc, "glow")?.setAttribute("opacity", ".15");
  } else if (size >= 22) {
    remove(doc, "shadow", "glow", "frost", "rim");
    const plate = byId(doc, "plate");
    plate?.setAttribute("fill", "#FFFFFF");
    plate?.setAttribute("fill-opacity", ".40");
    if (!hinted) thickenGlyph(doc, size);
  } else {
    remove(doc, "shadow", "glow", "frost", "lift", "plate", "rim");
    recentreOnBack(doc, !hinted);
    if (!hinted) thickenGlyph(doc, size);
  }
  return serializer.serializeToString(doc as any);
}

export function dirName(size: number, scale: number, ctx: string) {
  return `${size}x${size}${scale === 2 ? "@2x" : ""}/${ctx}`;
}

/** Parse `--flag value` / `--flag a,b` style args. */
export function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
