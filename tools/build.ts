// src/**/*.svg → dist/Frost: PNG at every size @1x/@2x, alias symlinks, index.theme, icon cache.
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONTEXTS, SCALES, SIZES, SYMBOLIC_22_DIR, SYMBOLIC_DIR, THEME, THEME_DIR, aliases, derive, dirName, flag, pad22, sources, symbolicSources, type Source } from "./lib";
import { lint } from "./lint";
import { applyColors, type Resolved } from "./colors";

export const VERSION = (await Bun.file(join(import.meta.dir, "../package.json")).json()).version as string;

/** Render one icon at a logical size and scale, exactly as it ships. */
export async function renderPng(src: Source, size: number, scale: number): Promise<Buffer> {
  const svg = derive(src, size);
  const px = Math.round(size * scale); // resvg ignores a fractional width and falls back to the SVG size
  const raw = new Resvg(svg, { fitTo: { mode: "width", value: px }, font: { loadSystemFonts: false } }).render().asPng();
  return sharp(raw).png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
}

/** Set when the build applies a colour config (ADR-007); noted in index.theme's Comment. */
let custom: Resolved | null = null;

export function indexTheme(contexts: string[], symbolic = existsSync(join(THEME_DIR, SYMBOLIC_DIR))): string {
  // The fixed 22 px status directory comes first: at 22 px (KDE's tray) it is an exact match and wins over
  // the scalable 16 px one; every other size still resolves to the 16 px art.
  const dirs = (scale: number) => [...SIZES.flatMap((s) => contexts.map((c) => dirName(s, scale, c))), ...(scale === 1 && symbolic ? [SYMBOLIC_22_DIR, SYMBOLIC_DIR] : [])];
  const lines = [
    "[Icon Theme]",
    `Name=${THEME}`,
    `Comment=Frosted-glass icons — clean, minimal (v${VERSION}${custom ? ", custom colours" : ""})`,
    // breeze after Adwaita: KDE apps' own names (kate, okular…) fall back to KDE's art when Papirus is absent
    "Inherits=Papirus,Adwaita,breeze,hicolor",
    "Example=folder",
    // KDE: recolour the symbolic SVGs through their current-color-scheme stylesheet (ADR-005), and its size defaults
    "FollowsColorScheme=true",
    "DesktopDefault=48",
    "DesktopSizes=16,22,24,32,48,64,96,128,256",
    "ToolbarDefault=22",
    "ToolbarSizes=16,22,24,32,48",
    "MainToolbarDefault=22",
    "MainToolbarSizes=16,22,24,32,48",
    "SmallDefault=16",
    "SmallSizes=16,22,24,32,48",
    "PanelDefault=48",
    "PanelSizes=16,22,24,32,48,64,96,128,256",
    "DialogDefault=32",
    "DialogSizes=16,22,24,32,48,64,96,128,256",
    "",
    `Directories=${dirs(1).join(",")}`,
    `ScaledDirectories=${dirs(2).join(",")}`,
    "",
  ];
  for (const scale of SCALES) for (const size of SIZES) for (const c of contexts) {
    lines.push(`[${dirName(size, scale, c)}]`, `Size=${size}`);
    if (scale === 2) lines.push("Scale=2");
    lines.push(`Context=${CONTEXTS[c]}`, "Type=Fixed", "");
  }
  if (symbolic) lines.push(`[${SYMBOLIC_22_DIR}]`, "Size=22", "Context=Status", "Type=Fixed", "");
  if (symbolic) lines.push(`[${SYMBOLIC_DIR}]`, "Size=16", "MinSize=8", "MaxSize=512", "Context=Status", "Type=Scalable", "");
  return lines.join("\n");
}

export async function build(): Promise<{ icons: number; files: number; deduped: number }> {
  const problems = lint();
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
    throw new Error(`lint failed (${problems.length})`);
  }
  const list = sources();
  rmSync(THEME_DIR, { recursive: true, force: true });
  const contexts = Object.keys(CONTEXTS).filter((c) => list.some((s) => s.context === c));
  let files = 0;

  await Promise.all(list.map(async (src) => {
    for (const size of SIZES) for (const scale of SCALES) {
      const dir = join(THEME_DIR, dirName(size, scale, src.context));
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${src.name}.png`), await renderPng(src, size, scale));
      files++;
    }
  }));

  // Byte-identical renders in one directory become relative symlinks to the first (by name). File types that
  // share a category are identical below 48 px, where the type label drops out (ADR-006).
  let deduped = 0;
  for (const size of SIZES) for (const scale of SCALES) for (const ctx of contexts) {
    const dir = join(THEME_DIR, dirName(size, scale, ctx));
    const first = new Map<string, string>();
    for (const f of readdirSync(dir).sort()) {
      const key = Bun.hash(readFileSync(join(dir, f))).toString();
      const keep = first.get(key);
      if (!keep) { first.set(key, f); continue; }
      unlinkSync(join(dir, f)); symlinkSync(keep, join(dir, f)); deduped++;
    }
  }

  // ADR-005: symbolic status icons ship as plain SVG (GTK / GNOME Shell recolour them).
  const symbolic = symbolicSources();
  if (symbolic.length) {
    mkdirSync(join(THEME_DIR, SYMBOLIC_DIR), { recursive: true });
    mkdirSync(join(THEME_DIR, SYMBOLIC_22_DIR), { recursive: true });
    for (const s of symbolic) {
      copyFileSync(s.file, join(THEME_DIR, SYMBOLIC_DIR, `${s.name}.svg`));
      writeFileSync(join(THEME_DIR, SYMBOLIC_22_DIR, `${s.name}.svg`), pad22(readFileSync(s.file, "utf8")));
      files += 2;
    }
  }

  // ADR-004: aliases are relative symlinks next to their target.
  const byName = new Map(list.map((s) => [s.name, s]));
  const symNames = new Set(symbolic.map((s) => s.name));
  for (const [target, names] of Object.entries(aliases())) {
    if (symNames.has(target)) {
      for (const n of names) for (const d of [SYMBOLIC_DIR, SYMBOLIC_22_DIR]) symlinkSync(`${target}.svg`, join(THEME_DIR, d, `${n}.svg`));
      continue;
    }
    const src = byName.get(target);
    if (!src) continue;
    for (const size of SIZES) for (const scale of SCALES) {
      const dir = join(THEME_DIR, dirName(size, scale, src.context));
      for (const n of names) symlinkSync(`${target}.png`, join(dir, `${n}.png`));
    }
  }

  writeFileSync(join(THEME_DIR, "index.theme"), indexTheme(contexts, symbolic.length > 0));
  // The colour config travels with the theme, so an upgrade can offer to re-apply it.
  if (custom) copyFileSync(custom.file, join(THEME_DIR, "frost-colors.json"));
  // GTK's cache speeds lookups up; KDE and COSMIC ignore it, and their distros may not ship the tool.
  if (Bun.which("gtk-update-icon-cache")) {
    const cache = Bun.spawnSync(["gtk-update-icon-cache", "-f", "-t", "-q", THEME_DIR]);
    if (cache.exitCode !== 0 || !existsSync(join(THEME_DIR, "icon-theme.cache"))) {
      throw new Error(`gtk-update-icon-cache failed: ${cache.stderr.toString()}`);
    }
  } else console.warn("build: gtk-update-icon-cache not found — skipping the GTK icon cache (the theme works without it)");
  return { icons: list.length + symbolic.length, files, deduped };
}

/** `--colors FILE|PRESET` (ADR-007): recolour this build. Exits with the config's problems if it is invalid. */
export function useColors(arg: string | undefined): Resolved | null {
  if (!arg) return null;
  try { custom = applyColors(arg); } catch (e) { console.error(`✗ ${(e as Error).message}`); process.exit(1); }
  for (const w of custom.warnings) console.warn(`⚠ ${w}`);
  console.log(`colours: ${custom.file}`);
  return custom;
}

if (import.meta.main) {
  useColors(flag("colors"));
  const t = performance.now();
  const { icons, files, deduped } = await build();
  console.log(`build: ${icons} icons → ${files} files in dist/${THEME}, ${deduped} identical linked (${((performance.now() - t) / 1000).toFixed(1)}s)`);
}
