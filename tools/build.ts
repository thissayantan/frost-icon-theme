// src/**/*.svg → dist/Hyaline: PNG at every size @1x/@2x, alias symlinks, index.theme, icon cache.
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { copyFileSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONTEXTS, SCALES, SIZES, SYMBOLIC_DIR, THEME, THEME_DIR, aliases, derive, dirName, sources, symbolicSources, type Source } from "./lib";
import { lint } from "./lint";

export const VERSION = (await Bun.file(join(import.meta.dir, "../package.json")).json()).version as string;

/** Render one icon at a logical size and scale, exactly as it ships. */
export async function renderPng(src: Source, size: number, scale: number): Promise<Buffer> {
  const svg = derive(src, size);
  const px = size * scale;
  const raw = new Resvg(svg, { fitTo: { mode: "width", value: px }, font: { loadSystemFonts: false } }).render().asPng();
  return sharp(raw).png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
}

export function indexTheme(contexts: string[], symbolic = existsSync(join(THEME_DIR, SYMBOLIC_DIR))): string {
  const dirs = (scale: number) => [...SIZES.flatMap((s) => contexts.map((c) => dirName(s, scale, c))), ...(scale === 1 && symbolic ? [SYMBOLIC_DIR] : [])];
  const lines = [
    "[Icon Theme]",
    `Name=${THEME}`,
    `Comment=Frosted-glass icons — clean, minimal (v${VERSION})`,
    "Inherits=Papirus,Adwaita,hicolor",
    "Example=folder",
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
  if (symbolic) lines.push(`[${SYMBOLIC_DIR}]`, "Size=16", "MinSize=8", "MaxSize=512", "Context=Status", "Type=Scalable", "");
  return lines.join("\n");
}

export async function build(): Promise<{ icons: number; files: number }> {
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

  // ADR-005: symbolic status icons ship as plain SVG (GTK / GNOME Shell recolour them).
  const symbolic = symbolicSources();
  if (symbolic.length) {
    mkdirSync(join(THEME_DIR, SYMBOLIC_DIR), { recursive: true });
    for (const s of symbolic) { copyFileSync(s.file, join(THEME_DIR, SYMBOLIC_DIR, `${s.name}.svg`)); files++; }
  }

  // ADR-004: aliases are relative symlinks next to their target.
  const byName = new Map(list.map((s) => [s.name, s]));
  const symNames = new Set(symbolic.map((s) => s.name));
  for (const [target, names] of Object.entries(aliases())) {
    if (symNames.has(target)) {
      for (const n of names) symlinkSync(`${target}.svg`, join(THEME_DIR, SYMBOLIC_DIR, `${n}.svg`));
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
  const cache = Bun.spawnSync(["gtk-update-icon-cache", "-f", "-t", "-q", THEME_DIR]);
  if (cache.exitCode !== 0 || !existsSync(join(THEME_DIR, "icon-theme.cache"))) {
    throw new Error(`gtk-update-icon-cache failed: ${cache.stderr.toString()}`);
  }
  return { icons: list.length + symbolic.length, files };
}

if (import.meta.main) {
  const t = performance.now();
  const { icons, files } = await build();
  console.log(`build: ${icons} icons → ${files} files in dist/${THEME} (${((performance.now() - t) / 1000).toFixed(1)}s)`);
}
