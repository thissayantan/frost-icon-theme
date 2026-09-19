// Personal overlay, applied only to the installed copy by `install:local` — never committed (CLAUDE.md rule 3).
//  • Official Chrome / Chrome Dev icons: symlinks to the PNGs Chrome itself installs in /opt/google.
//  • Language folders: the Frost folder with the real brand mark (Simple Icons, CC0 paths) as a white glyph.
//    Logos are fetched once into git-ignored local/logos/ and never leave this machine.
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { CONTEXTS, ROOT, SCALES, SIZES, dirName, type Source } from "./lib";
import { indexTheme, renderPng } from "./build";

const LOCAL = join(ROOT, "local");

/** icon name → Simple Icons slug. Order matters only for docs; tag-folders decides which applies. */
export const LANG_FOLDERS: Record<string, string> = {
  "folder-android": "android",
  "folder-go": "go",
  "folder-bun": "bun",
  "folder-nodejs": "nodedotjs",
  "folder-typescript": "typescript",
  "folder-python": "python",
  "folder-rust": "rust",
  "folder-flutter": "flutter",
  "folder-deno": "deno",
};

const CHROME = [
  { name: "google-chrome", dir: "/opt/google/chrome", suffix: "" },
  { name: "google-chrome-unstable", dir: "/opt/google/chrome-unstable", suffix: "_dev" },
  { name: "google-chrome-beta", dir: "/opt/google/chrome-beta", suffix: "_beta" },
];

async function logo(slug: string): Promise<string | null> {
  const file = join(LOCAL, "logos", `${slug}.svg`);
  if (!existsSync(file)) {
    try {
      const res = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@16/icons/${slug}.svg`);
      if (!res.ok) throw new Error(String(res.status));
      mkdirSync(join(LOCAL, "logos"), { recursive: true });
      writeFileSync(file, await res.text());
    } catch (e) {
      console.warn(`! local: could not fetch logo "${slug}" (${e}) — skipped`);
      return null;
    }
  }
  return readFileSync(file, "utf8").match(/<path[^>]* d="([^"]+)"/)?.[1] ?? null;
}

/** Wide wordmarks (Go) fill less of their 24×24 box, so they get a bigger box. */
const MARK_BOX: Record<string, number> = { go: 52 };

/** Folder source with a 24×24 Simple Icons path as the white glyph, centred on the flap (64, 84). */
function folderWithMark(d: string, slug: string): string {
  const folder = readFileSync(join(ROOT, "src/places/folder.svg"), "utf8");
  const k = (MARK_BOX[slug] ?? 44) / 24;
  const glyph = `<g id="glyph"><path d="${d}" fill="#FFFFFF" transform="translate(${64 - 12 * k} ${84 - 12 * k}) scale(${k})"/></g>`;
  return folder.replace('<g id="glyph"/>', glyph);
}

export async function applyLocalOverlay(target: string): Promise<string[]> {
  const done: string[] = [];
  const contexts = new Set(Object.keys(CONTEXTS).filter((c) => existsSync(join(target, dirName(16, 1, c)))));

  // language folders → rendered into target/…/places
  mkdirSync(join(LOCAL, "src"), { recursive: true });
  for (const [name, slug] of Object.entries(LANG_FOLDERS)) {
    const d = await logo(slug);
    if (!d) continue;
    const file = join(LOCAL, "src", `${name}.svg`);
    writeFileSync(file, folderWithMark(d, slug));
    const src: Source = { context: "places", name, file, overrides: new Map() };
    for (const size of SIZES) for (const scale of SCALES) {
      const dir = join(target, dirName(size, scale, "places"));
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${name}.png`), await renderPng(src, size, scale));
    }
    contexts.add("places");
    done.push(name);
  }

  // official Chrome icons → symlinks into target/…/apps (only sizes Chrome ships)
  for (const c of CHROME) {
    if (!existsSync(c.dir)) continue;
    for (const size of SIZES) {
      const png = join(c.dir, `product_logo_${size}${c.suffix}.png`);
      if (!existsSync(png)) continue;
      const dir = join(target, dirName(size, 1, "apps"));
      mkdirSync(dir, { recursive: true });
      rmSync(join(dir, `${c.name}.png`), { force: true });
      symlinkSync(png, join(dir, `${c.name}.png`));
      contexts.add("apps");
    }
    done.push(c.name);
  }

  const ordered = Object.keys(CONTEXTS).filter((c) => contexts.has(c));
  writeFileSync(join(target, "index.theme"), indexTheme(ordered));
  return done;
}
