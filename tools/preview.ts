// Contact sheet of the *built* PNGs: rows = icons, column groups = light / dark / wallpaper backgrounds.
//   bun run preview [--only a,b] [--size 256 | --sizes 16,24] [--scale 2] [--zoom 3] [--templates | --from-src]
//                   [--grid] [--wallpaper file.jpg] [--out path.png]
import { Resvg } from "@resvg/resvg-js";
import sharp, { type OverlayOptions } from "sharp";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DIST, SRC, THEME_DIR, dirName, flag, sources, type Source } from "./lib";
import { renderPng } from "./build";

const BACKGROUNDS = [
  { name: "light", fill: "#FAFAFB", ink: "#55575E" },
  { name: "dark", fill: "#1E1E22", ink: "#A8AAB2" },
  { name: "wallpaper", fill: "", ink: "#FFFFFF" },
];

type Entry = { label: string; png: (size: number, scale: number) => Promise<Buffer> };

function entries(): Entry[] {
  const only = flag("only")?.split(",");
  if (process.argv.includes("--templates")) {
    return ["folder", "glass"].map((t) => {
      const src: Source = { context: "_templates", name: t, file: join(SRC, "_templates", `${t}.svg`), overrides: new Map() };
      return { label: `template: ${t}`, png: (size, scale) => renderPng(src, size, scale) };
    });
  }
  if (process.argv.includes("--from-src")) {
    // Same derive + render path as the build, in memory — for iterating without touching dist/.
    return sources(only).map((s) => ({ label: s.name, png: (size, scale) => renderPng(s, size, scale) }));
  }
  if (!existsSync(join(THEME_DIR, "index.theme"))) throw new Error("dist/Hyaline missing — run `bun run build` first");
  return sources(only).map((s) => ({
    label: s.name,
    png: async (size, scale) => readFileSync(join(THEME_DIR, dirName(size, scale, s.context), `${s.name}.png`)),
  }));
}

/** A busy, photo-like backdrop (deterministic, licence-free): soft colour fields + hard light/dark detail. */
function wallpaperSvg(w: number, h: number, busy = true): string {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hues = ["#1F4E79", "#E07A2E", "#3C8D5A", "#F2D16B", "#7A3B8C", "#0F2233", "#D94F4F", "#9FD3F2"];
  let blobs = "";
  for (let i = 0; i < Math.ceil((w * h) / 9000); i++) {
    blobs += `<circle cx="${(rnd() * w).toFixed(0)}" cy="${(rnd() * h).toFixed(0)}" r="${(20 + rnd() * 90).toFixed(0)}" fill="${hues[Math.floor(rnd() * hues.length)]}" opacity="${(0.35 + rnd() * 0.5).toFixed(2)}"/>`;
  }
  let detail = "";
  for (let i = 0; busy && i < Math.ceil((w * h) / 4000); i++) {
    const x = rnd() * w, y = rnd() * h, l = 10 + rnd() * 60, a = rnd() * 180;
    detail += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${l.toFixed(0)}" height="${(1 + rnd() * 4).toFixed(1)}" transform="rotate(${a.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})" fill="${rnd() > 0.5 ? "#FFFFFF" : "#000000"}" opacity="${(0.25 + rnd() * 0.5).toFixed(2)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#6FA8DC"/><stop offset=".55" stop-color="#E9B872"/><stop offset="1" stop-color="#2E4A2E"/></linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="14"/></filter></defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/><g filter="url(#soft)">${blobs}</g>${detail}</svg>`;
}

async function backdrop(w: number, h: number, busy = true): Promise<Buffer> {
  const file = flag("wallpaper");
  if (file) return sharp(file).resize(w, h, { fit: "cover" }).png().toBuffer();
  return Buffer.from(new Resvg(wallpaperSvg(w, h, busy)).render().asPng());
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x: number, y: number, s: string, fill: string, size = 13, anchor = "start", weight = 500) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-family="Ubuntu Sans" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(s)}</text>`;

async function sheet(list: Entry[], sizes: number[], scale: number) {
  const pad = 14, labelW = 190, headerH = 34;
  const cellW = sizes.map((s) => Math.max(s * scale, 28) + pad * 2);
  const groupW = cellW.reduce((a, b) => a + b, 0);
  const rowH = Math.max(...sizes) * scale + pad * 2;
  const W = labelW + groupW * BACKGROUNDS.length, H = headerH + rowH * list.length;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#FFFFFF"/>`;
  BACKGROUNDS.forEach((bg, g) => {
    const x0 = labelW + g * groupW;
    if (bg.fill) svg += `<rect x="${x0}" y="0" width="${groupW}" height="${H}" fill="${bg.fill}"/>`;
  });
  svg += "</svg>";
  const layers: OverlayOptions[] = [];
  const wp = BACKGROUNDS.findIndex((b) => !b.fill);
  layers.push({ input: await backdrop(groupW, H), left: labelW + wp * groupW, top: 0 });

  let labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  BACKGROUNDS.forEach((bg, g) => {
    let x = labelW + g * groupW;
    sizes.forEach((s, i) => {
      labels += text(x + cellW[i] / 2, 22, `${s}${scale === 2 ? "@2x" : ""}`, bg.ink, 11, "middle");
      x += cellW[i];
    });
  });
  for (const [r, e] of list.entries()) {
    const y0 = headerH + r * rowH;
    labels += text(14, y0 + rowH / 2 + 5, e.label, "#2A2B30", 13);
    for (const g of BACKGROUNDS.keys()) {
      let x = labelW + g * groupW;
      for (const [i, s] of sizes.entries()) {
        const px = s * scale;
        layers.push({ input: await e.png(s, scale), left: Math.round(x + (cellW[i] - px) / 2), top: Math.round(y0 + (rowH - px) / 2) });
        x += cellW[i];
      }
    }
  }
  labels += "</svg>";
  layers.push({ input: Buffer.from(new Resvg(labels).render().asPng()), left: 0, top: 0 });
  return sharp(Buffer.from(new Resvg(svg).render().asPng())).composite(layers);
}

/** Showcase layout for docs/preview.png: the whole set at 96 px on light, dark and wallpaper panels. */
async function grid(list: Entry[], size: number) {
  const cols = Math.min(8, list.length), cell = size + 56, labelH = 22, title = 40, gap = 0;
  const rows = Math.ceil(list.length / cols);
  const panelW = cols * cell + 48, panelH = title + rows * (cell + labelH) + 24;
  const W = panelW, H = panelH * BACKGROUNDS.length + gap;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  BACKGROUNDS.forEach((bg, p) => { if (bg.fill) svg += `<rect y="${p * panelH}" width="${W}" height="${panelH}" fill="${bg.fill}"/>`; });
  svg += "</svg>";
  const layers: OverlayOptions[] = [];
  const wp = BACKGROUNDS.findIndex((b) => !b.fill);
  layers.push({ input: await backdrop(W, panelH, false), left: 0, top: wp * panelH });
  let labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  for (const [p, bg] of BACKGROUNDS.entries()) {
    const y0 = p * panelH;
    if (!bg.fill) labels += `<rect x="16" y="${y0 + 10}" width="170" height="26" rx="13" fill="#000000" fill-opacity=".35"/>`;
    labels += text(24, y0 + 28, `Hyaline — ${bg.name}`, bg.ink, 15, "start", 600);
    for (const [i, e] of list.entries()) {
      const cx = 24 + (i % cols) * cell, cy = y0 + title + Math.floor(i / cols) * (cell + labelH);
      layers.push({ input: await e.png(size, 1), left: cx + 28, top: cy + 20 });
      if (!bg.fill) labels += `<rect x="${cx + cell / 2 - e.label.length * 3.1 - 8}" y="${cy + cell - 3}" width="${e.label.length * 6.2 + 16}" height="18" rx="9" fill="#000000" fill-opacity=".35"/>`;
      labels += text(cx + cell / 2, cy + cell + 10, e.label, bg.ink, 11, "middle", 400);
    }
  }
  labels += "</svg>";
  layers.push({ input: Buffer.from(new Resvg(labels).render().asPng()), left: 0, top: 0 });
  return sharp(Buffer.from(new Resvg(svg).render().asPng())).composite(layers);
}

if (import.meta.main) {
  const list = entries();
  if (!list.length) throw new Error("no icons matched");
  const single = flag("size");
  const sizes = single ? [Number(single)] : (flag("sizes")?.split(",").map(Number) ?? [16, 24, 48, 128]);
  const scale = Number(flag("scale") ?? 1);
  const out = flag("out") ?? join(DIST, "preview", "sheet.png");
  let img = process.argv.includes("--grid") ? await grid(list, Number(single ?? 96)) : await sheet(list, sizes, scale);
  const zoom = Number(flag("zoom") ?? 1);
  if (zoom > 1) {
    const buf = await img.png().toBuffer();
    const { width } = await sharp(buf).metadata();
    img = sharp(buf).resize({ width: width! * zoom, kernel: "nearest" });
  }
  mkdirSync(dirname(out), { recursive: true });
  await img.png({ compressionLevel: 9 }).toFile(out);
  console.log(`preview: ${list.length} icon(s) → ${out.replace(process.cwd() + "/", "")}`);
}
