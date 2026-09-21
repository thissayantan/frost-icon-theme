// docs/colors.png — Frost's own colours next to every preset in presets/, rendered through the real build path
// (derive + resvg, with the preset applied), on a light and a dark background. For the README's "Make it yours".
//   bun tools/colors-sheet.ts [--out docs/colors.png]
import { Resvg } from "@resvg/resvg-js";
import sharp, { type OverlayOptions } from "sharp";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { renderPng } from "./build";
import { applyColors } from "./colors";
import { ROOT, flag, setRecolor, sources } from "./lib";

const ICONS = ["folder", "folder-documents", "user-home", "folder-download", "application-json", "text-markdown", "image-png", "audio-mpeg"];
const PANELS = [{ fill: "#FAFAFB", ink: "#2A2B30", sub: "#6B6D75" }, { fill: "#1E1E22", ink: "#F2F2F5", sub: "#A8AAB2" }];
const S = 2; // HD: everything is drawn at 2x
const ICON = 96, CELL = 120, LABEL_W = 250, ROW = 124, HEAD = 22;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x: number, y: number, s: string, fill: string, size: number, weight = 500) =>
  `<text x="${x * S}" y="${y * S}" fill="${fill}" font-family="Ubuntu Sans" font-size="${size * S}" font-weight="${weight}">${esc(s)}</text>`;

const presets = readdirSync(join(ROOT, "presets")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
const order = ["warm", "forest", "ocean", "pastel", "mono"];
const rank = (p: string) => (order.includes(p) ? order.indexOf(p) : order.length);
presets.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
const rows = [{ name: "Frost", note: "the built-in colours" }, ...presets.map((p) => ({
  name: p, note: `--colors ${p}`,
}))];

const list = sources(ICONS);
const byName = new Map(list.map((s) => [s.name, s]));
const W = LABEL_W + ICONS.length * CELL + 24, panelH = HEAD + rows.length * ROW + 16, H = panelH * PANELS.length;

// Render every row once (a preset changes the colours; the backgrounds don't matter to the icon PNG).
const pngs: Buffer[][] = [];
for (const r of rows) {
  if (r.name === "Frost") setRecolor(null); else applyColors(r.name);
  pngs.push(await Promise.all(ICONS.map((n) => renderPng(byName.get(n)!, ICON, S))));
}
setRecolor(null);

let bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">`;
let labels = bg;
const layers: OverlayOptions[] = [];
PANELS.forEach((p, k) => {
  const y0 = k * panelH;
  bg += `<rect y="${y0 * S}" width="${W * S}" height="${panelH * S}" fill="${p.fill}"/>`;
  rows.forEach((r, i) => {
    const y = y0 + HEAD + i * ROW;
    labels += text(28, y + ROW / 2 - 2, r.name, p.ink, 18, 600) + text(28, y + ROW / 2 + 20, r.note, p.sub, 12.5, 400);
    pngs[i].forEach((png, j) => layers.push({ input: png, left: (LABEL_W + j * CELL + (CELL - ICON) / 2) * S, top: (y + (ROW - ICON) / 2) * S }));
  });
});
bg += "</svg>"; labels += "</svg>";
layers.push({ input: Buffer.from(new Resvg(labels, { font: { loadSystemFonts: true } }).render().asPng()), left: 0, top: 0 });
const out = flag("out") ?? join(ROOT, "docs/colors.png");
await sharp(Buffer.from(new Resvg(bg).render().asPng())).composite(layers).png({ compressionLevel: 9 }).toFile(out);
console.log(`colors-sheet: ${rows.length} rows × ${ICONS.length} icons → ${out.replace(ROOT + "/", "")}`);
