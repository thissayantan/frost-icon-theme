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
  "folder-typescript": "typescript",
  "folder-javascript": "javascript",
  "folder-python": "python",
  "folder-bash": "gnubash",
  "folder-go": "go",
  "folder-rust": "rust",
  "folder-java": "openjdk",
  "folder-kotlin": "kotlin",
  "folder-android": "android",
  "folder-flutter": "flutter",
  "folder-dart": "dart",
  "folder-swift": "swift",
  "folder-csharp": "dotnet",
  "folder-c": "c",
  "folder-cpp": "cplusplus",
  "folder-php": "php",
  "folder-ruby": "ruby",
  "folder-lua": "lua",
  "folder-deno": "deno",
  "folder-bun": "bun",
  "folder-nodejs": "nodedotjs",
  "folder-docker": "docker",
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

/** Snap apps whose launchers hard-code a PNG path — no theme can reach them. At the owner's request
 *  (2026-09-19) install:local writes per-user launcher copies pointing at Frost icon names. Marked, reversible. */
const SNAP_APPS = "/var/lib/snapd/desktop/applications";
const LAUNCHERS: Record<string, string> = {
  "snap-store_snap-store.desktop": "snap-store",
  "firmware-updater_firmware-updater.desktop": "firmware-updater",
  "firmware-updater_firmware-updater-app.desktop": "firmware-updater",
  "desktop-security-center_desktop-security-center.desktop": "desktop-security-center",
};
const MARK = "X-Frost-Override=true";

export function applyLauncherOverrides(undo = false): string[] {
  const dir = join(process.env.HOME ?? "", ".local/share/applications");
  const done: string[] = [];
  for (const [file, icon] of Object.entries(LAUNCHERS)) {
    const src = join(SNAP_APPS, file), dst = join(dir, file);
    const ours = existsSync(dst) && readFileSync(dst, "utf8").includes(MARK);
    if (undo) { if (ours) { rmSync(dst); done.push(file); } continue; }
    if (!existsSync(src) || (existsSync(dst) && !ours)) continue; // never overwrite the owner's own launcher
    const text = readFileSync(src, "utf8").replace(/^Icon=.*$/m, `Icon=${icon}`).replace(/^\[Desktop Entry\]$/m, `[Desktop Entry]\n${MARK}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(dst, text);
    done.push(file);
  }
  return done;
}

// ── Project stacks: "this folder contains React · Hono · Cloudflare" ──────────────────────────────
/** Brand colours (Simple Icons hex). Pastel-softened at render time; black brands use Frost graphite. */
export const STACK_BRANDS: Record<string, string> = {
  nextdotjs: "000000", react: "61DAFB", vuedotjs: "4FC08D", svelte: "FF3E00", astro: "BC52EE", angular: "0F0F11",
  expo: "000020", android: "3DDC84", flutter: "02569B", electron: "47848F", tauri: "24C8D8",
  hono: "E36002", express: "000000", fastify: "000000", nestjs: "E0234E", django: "092E20", fastapi: "009688",
  flask: "3BABC3", bun: "000000", deno: "70FFAF", nodedotjs: "5FA04E", go: "00ADD8", rust: "000000",
  python: "3776AB", kotlin: "7F52FF", typescript: "3178C6", cloudflare: "F38020", docker: "2496ED",
  vercel: "000000", supabase: "3FCF8E", firebase: "DD2C00", vite: "9135FF", gnubash: "4EAA25",
};
const stackPath = join(LOCAL, "stacks.json");
export const stackIcon = (slugs: string[]) => `folder-stack-${slugs.join("-")}`;
export function readStacks(): string[][] { try { return JSON.parse(readFileSync(stackPath, "utf8")); } catch { return []; } }
export function writeStacks(stacks: string[][]) { mkdirSync(LOCAL, { recursive: true }); writeFileSync(stackPath, JSON.stringify(stacks, null, 2)); }

/** (kept for reference; the white-mark cluster no longer uses brand colour) */
function soft(hex: string): string {
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (L < 0.15) return "#7A8394"; // black-ish brands (Bun, Next, Rust…) → Frost graphite
  if (L > 0.6) [r, g, b] = [r, g, b].map((c) => c * 0.72); // too light for a white mark → deepen
  else [r, g, b] = [r, g, b].map((c) => c * 0.82 + 255 * 0.18); // otherwise soften toward pastel
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** A loose cluster of WHITE marks on the flap (owner's mock, 2026-09-19): the first (the framework) largest,
 *  the rest smaller and slightly tilted around it, never overlapping (white on white would merge). */
const SLOTS: [number, number, number, number][][] = [  // [cx, cy, size, rotate°] per count (max 3)
  [[64, 84, 40, 0]],
  [[48, 86, 36, -8], [86, 80, 30, 8]],
  [[42, 86, 36, -8], [78, 70, 27, 8], [96, 97, 25, -6]],
];

async function stackSvg(slugs: string[]): Promise<string | null> {
  const marks: string[] = [];
  for (const sl of slugs) { const d = await logo(sl); if (!d) return null; marks.push(d); }
  const place = (d: string, cx: number, cy: number, size: number, rot: number) =>
    `<path d="${d}" fill="#FFFFFF" transform="translate(${cx} ${cy}) rotate(${rot}) scale(${size / 24}) translate(-12 -12)"/>`;
  const g = slugs.map((_, i) => place(marks[i], ...SLOTS[slugs.length - 1][i])).join("");
  // ≤ 24 px: only the first (most telling) mark, upright, centred on the flap — in target-pixel units
  const small = (size: number, cx: number, cy: number, px: number) =>
    `<g id="glyph-${size}" transform="scale(${(128 / size).toFixed(4)})">${place(marks[0], cx, cy, px, 0)}</g>`;
  const folder = readFileSync(join(ROOT, "src/places/folder.svg"), "utf8");
  return folder.replace('<g id="glyph"/>', `<g id="glyph">${g}</g>`)
    .replace('    <clipPath id="plate-clip">', small(16, 8, 9.5, 7) + "\n" + small(22, 11, 14.5, 7) + "\n" + small(24, 12, 16, 8) + "\n    <clipPath id=\"plate-clip\">");
}

/** Render every stack combination in local/stacks.json into target/…/places. */
export async function renderStacks(target: string): Promise<string[]> {
  const done: string[] = [];
  mkdirSync(join(LOCAL, "src"), { recursive: true });
  for (const slugs of readStacks()) {
    const svg = await stackSvg(slugs);
    if (!svg) continue;
    const name = stackIcon(slugs), file = join(LOCAL, "src", `${name}.svg`);
    writeFileSync(file, svg);
    const src: Source = { context: "places", name, file, overrides: new Map() };
    for (const size of SIZES) for (const scale of SCALES) {
      const dir = join(target, dirName(size, scale, "places"));
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${name}.png`), await renderPng(src, size, scale));
    }
    done.push(name);
  }
  return done;
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

  done.push(...(await renderStacks(target)));
  const ordered = Object.keys(CONTEXTS).filter((c) => contexts.has(c));
  writeFileSync(join(target, "index.theme"), indexTheme(ordered));
  return done;
}
