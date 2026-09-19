// Preview symbolic status icons the way GNOME Shell's top bar (St) draws them: St wraps each SVG in a stylesheet
// that forces every shape to the foreground colour, and `.warning/.error/.success` to its semantic colours.
//   bun tools/status-sheet.ts [--only a,b] [--out dist/preview/status.png]
import { Resvg } from "@resvg/resvg-js";
import sharp, { type OverlayOptions } from "sharp";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DIST, SRC, flag } from "./lib";

// St defaults (st-theme-node.c) — the shell theme sets none for #panel.
const SEMANTIC = { success: "#4e9a06", warning: "#f5793e", error: "#cc0000" };
const PANELS = [
  { name: "dark panel", bg: "#161618", fg: "#FFFFFF", ink: "#9A9AA2" },
  { name: "light", bg: "#FAFAFB", fg: "#2E3436", ink: "#55575E" },
];

export function stRecolour(svg: string, fg: string): string {
  const css = `rect,path,ellipse,circle,polygon{fill:${fg}!important}` +
    Object.entries(SEMANTIC).map(([c, v]) => `.${c}{fill:${v}!important}`).join("");
  return svg.replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`);
}

const dir = join(SRC, "status");
const only = flag("only")?.split(",");
const names = readdirSync(dir).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4))
  .filter((n) => !only || only.some((o) => n.startsWith(o))).sort(naturalOrder);

function naturalOrder(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

const cols = 12, cell = 92, sizes = [16, 32];
const rows = Math.ceil(names.length / cols);
const panelH = 30 + rows * 84;
const W = cols * cell + 24, H = panelH * PANELS.length;
const layers: OverlayOptions[] = [];
let bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
let labels = bg;
for (const [p, panel] of PANELS.entries()) {
  const y0 = p * panelH;
  bg += `<rect y="${y0}" width="${W}" height="${panelH}" fill="${panel.bg}"/>`;
  labels += `<text x="12" y="${y0 + 20}" font-family="Ubuntu Sans" font-size="12" font-weight="600" fill="${panel.ink}">${panel.name} — 16 px (as in the bar) and 32 px</text>`;
  for (const [i, n] of names.entries()) {
    const x = 12 + (i % cols) * cell, y = y0 + 30 + Math.floor(i / cols) * 84;
    const svg = stRecolour(readFileSync(join(dir, `${n}.svg`), "utf8"), panel.fg);
    let dx = 0;
    for (const s of sizes) {
      const png = new Resvg(svg, { fitTo: { mode: "width", value: s } }).render().asPng();
      layers.push({ input: Buffer.from(png), left: x + 8 + dx, top: y + (32 - s) / 2 + 4 });
      dx += s + 12;
    }
    const short = n.replace(/-symbolic$/, "").replace(/^network-/, "").replace(/^battery-level-/, "bat-")
      .replace(/^audio-volume-/, "vol-").replace(/^microphone-sensitivity-/, "mic-").replace(/^power-profile-/, "pp-");
    labels += `<text x="${x + cell / 2 - 6}" y="${y + 58}" font-family="Ubuntu Sans" font-size="9" text-anchor="middle" fill="${panel.ink}">${short.slice(0, 20)}</text>`;
  }
}
bg += "</svg>";
labels += "</svg>";
layers.push({ input: Buffer.from(new Resvg(labels).render().asPng()), left: 0, top: 0 });
const out = flag("out") ?? join(DIST, "preview", "status.png");
mkdirSync(dirname(out), { recursive: true });
await sharp(Buffer.from(new Resvg(bg).render().asPng())).composite(layers).png().toFile(out);
console.log(`status-sheet: ${names.length} icons → ${out}`);
