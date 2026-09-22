// docs/cover.png — the store thumbnail: the Frost wordmark and eight big icons, all inside the middle band, because
// gnome-look / KDE Store grids crop the first gallery picture around its centre.
//   bun tools/cover.ts [--out docs/cover.png]
import { Resvg } from "@resvg/resvg-js";
import sharp, { type OverlayOptions } from "sharp";
import { join } from "node:path";
import { renderPng } from "./build";
import { ROOT, flag, sources } from "./lib";

const S = 1.25; // 2000 × 1125, the largest a gnome-look gallery picture may be
const W = 1600, H = 900;
const ICONS = [
  ["folder", "user-home", "application-json"],
  ["text-markdown", "org.gnome.Nautilus", "org.gnome.Settings"],
];
const ICON = 210, GAP = 18;

const byName = new Map(sources().map((s) => [s.name, s]));
const px = (v: number) => Math.round(v * S);

// A dusk wallpaper: soft colour fields on deep blue, so the glass has something to be frosted against.
const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px(W)}" height="${px(H)}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B2340"/><stop offset="1" stop-color="#0F1322"/></linearGradient>
    <radialGradient id="a" cx="18%" cy="22%" r="55%"><stop offset="0" stop-color="#3F6DF5" stop-opacity=".55"/><stop offset="1" stop-color="#3F6DF5" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="88%" cy="18%" r="50%"><stop offset="0" stop-color="#8B42F5" stop-opacity=".45"/><stop offset="1" stop-color="#8B42F5" stop-opacity="0"/></radialGradient>
    <radialGradient id="c" cx="78%" cy="95%" r="55%"><stop offset="0" stop-color="#12A3B0" stop-opacity=".45"/><stop offset="1" stop-color="#12A3B0" stop-opacity="0"/></radialGradient>
    <radialGradient id="d" cx="8%" cy="98%" r="45%"><stop offset="0" stop-color="#EE3A70" stop-opacity=".35"/><stop offset="1" stop-color="#EE3A70" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#a)"/><rect width="${W}" height="${H}" fill="url(#b)"/>
  <rect width="${W}" height="${H}" fill="url(#c)"/><rect width="${W}" height="${H}" fill="url(#d)"/>
</svg>`;

// Wordmark block on the left, icon grid on the right, both centred on the middle of the picture.
const gridW = ICONS[0].length * ICON + (ICONS[0].length - 1) * GAP, gridH = ICONS.length * ICON + (ICONS.length - 1) * GAP;
const gx = W - 100 - gridW, gy = (H - gridH) / 2;
const tx = 120;

/** Text through Pango (sharp), which, unlike resvg, can pick the bold instance of the variable Ubuntu Sans. */
async function text(markup: string): Promise<{ input: Buffer; height: number }> {
  const img = sharp({ text: { text: markup, rgba: true, dpi: Math.round(72 * S), font: "Ubuntu Sans" } }).png();
  const input = await img.toBuffer();
  return { input, height: (await sharp(input).metadata()).height ?? 0 };
}
const title = await text(`<span font_desc="Ubuntu Sans Bold 190" foreground="#FFFFFF" letter_spacing="-4096">Frost</span>`);
const line1 = await text(`<span font_desc="Ubuntu Sans 34" foreground="#E4EAF8">Frosted-glass icons for\nGNOME, KDE and COSMIC</span>`);
const line2 = await text(`<span font_desc="Ubuntu Sans Medium 24" foreground="#9FB0D6">Free and open source</span>`);
const blockH = title.height + line1.height + line2.height + px(28 + 22);
let ty = Math.round((px(H) - blockH) / 2);
const textLayers: OverlayOptions[] = [];
for (const [t, gap] of [[title, 28], [line1, 22], [line2, 0]] as const) {
  textLayers.push({ input: t.input, left: px(tx), top: ty });
  ty += t.height + px(gap);
}

const layers: OverlayOptions[] = [];
for (const [r, row] of ICONS.entries()) {
  for (const [c, name] of row.entries()) {
    const src = byName.get(name);
    if (!src) throw new Error(`no icon ${name}`);
    // 128 px art rendered at the target size, so it stays sharp
    const png = await renderPng(src, 128, (ICON * S) / 128);
    layers.push({ input: png, left: px(gx + c * (ICON + GAP)), top: px(gy + r * (ICON + GAP)) });
  }
}
layers.push(...textLayers);
const out = flag("out") ?? join(ROOT, "docs/cover.png");
await sharp(Buffer.from(new Resvg(bg).render().asPng())).composite(layers).png({ compressionLevel: 9 }).toFile(out);
console.log(`cover → ${out.replace(ROOT + "/", "")}`);
