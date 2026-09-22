// docs/showcase.png — the whole range in one landscape picture: folders & places, every app, file types, and the
// top-bar status icons, rendered through the real build path. For store galleries (gnome-look / KDE Store) and posts.
//   bun tools/showcase.ts [--scale 1.25] [--out docs/showcase.png]
import { Resvg } from "@resvg/resvg-js";
import sharp, { type OverlayOptions } from "sharp";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderPng } from "./build";
import { ROOT, SRC, flag, sources } from "./lib";

const S = Number(flag("scale") ?? 1.25); // 2000 px wide: the most gnome-look / KDE Store galleries take
const W = 1600, H = 900, M = 56, ICON = 64, CELL = 82, ROW = 104, HEAD = 38;
const BG = ["#23262E", "#16181D"], INK = "#F2F2F5", SUB = "#9AA0AC";

const PLACES = ["folder", "user-home", "folder-documents", "folder-download", "folder-music", "folder-pictures", "folder-videos",
  "folder-templates", "folder-publicshare", "user-desktop", "folder-remote", "folder-open", "folder-drag-accept", "user-bookmarks",
  "network-server", "network-workgroup", "user-trash", "user-trash-full"];
const FILES = ["application-json", "text-markdown", "image-png", "image-svg+xml", "audio-mpeg", "video-mp4", "application-pdf",
  "application-zip", "text-x-python", "text-x-go", "text-x-typescript", "text-html", "text-css", "application-x-shellscript",
  "text-x-dockerfile", "text-x-lockfile", "application-pgp-keys", "application-certificate", "application-toml", "application-sql",
  "text-x-patch", "application-vnd.ms-excel", "application-msword", "application-vnd.ms-powerpoint", "font-ttf", "application-epub+zip",
  "application-vnd.appimage", "application-vnd.efi.iso", "text-calendar", "text-vcard", "message-rfc822", "text-x-log", "text-plain",
  "application-x-executable", "text-x-gitconfig", "application-java-archive"];
const STATUS = ["network-wireless-signal-excellent", "network-wireless-signal-ok", "network-wireless-acquiring", "network-wireless-no-route",
  "network-wired", "network-vpn", "bluetooth-active", "audio-volume-high", "audio-volume-medium", "audio-volume-muted",
  "microphone-sensitivity-high", "battery-level-80", "battery-level-50-charging", "battery-level-20", "battery-level-10",
  "battery-level-100-charged", "night-light", "airplane-mode", "notifications", "notifications-disabled", "power-profile-balanced",
  "camera-web", "location-services-active", "display-brightness"].map((n) => `${n}-symbolic`);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x: number, y: number, s: string, fill: string, size: number, weight = 500) =>
  `<text x="${x * S}" y="${y * S}" fill="${fill}" font-family="Ubuntu Sans" font-size="${size * S}" font-weight="${weight}">${esc(s)}</text>`;

/** A status icon the way GNOME Shell paints it on a dark bar: white, with the state colours (St defaults). */
function statusPng(name: string, px: number): Buffer {
  const colour = { success: "#57E389", warning: "#F5793E", error: "#ED333B" } as Record<string, string>;
  const svg = readFileSync(join(SRC, "status", `${name}.svg`), "utf8").replace(/<path([^>]*)>/g, (_, attrs: string) => {
    const state = attrs.match(/class="(success|warning|error)\b/)?.[1];
    return `<path${attrs.replace('fill="currentColor"', `fill="${state ? colour[state] : INK}"`)}>`;
  });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: px } }).render().asPng());
}

const byName = new Map(sources().map((s) => [s.name, s]));
const apps = sources().filter((s) => s.context === "apps").map((s) => s.name);
const pick = (names: string[]) => names.filter((n) => byName.has(n));

const layers: OverlayOptions[] = [];
let labels = "";
const perRow = Math.floor((W - 2 * M) / CELL);
let y = M + 58;
labels += text(M, M + 22, "Frost", INK, 30, 600) + text(M + 96, M + 22, "a frosted-glass icon theme for GNOME, KDE Plasma and COSMIC", SUB, 17, 400);

async function section(title: string, names: string[], rows: number) {
  labels += text(M, y + 18, title, SUB, 14, 500);
  y += HEAD;
  const list = names.slice(0, perRow * rows);
  await Promise.all(list.map(async (n, i) => {
    const png = await renderPng(byName.get(n)!, ICON, S);
    layers.push({ input: png, left: Math.round((M + (i % perRow) * CELL) * S), top: Math.round((y + Math.floor(i / perRow) * ROW) * S) });
  }));
  y += Math.ceil(list.length / perRow) * ROW;
}

await section("Folders and places", pick(PLACES), 1);
await section("Apps", apps, 2);
await section("File types", pick(FILES), 2);
labels += text(M, y + 18, "Top-bar status icons, recoloured by the desktop", SUB, 14, 500);
y += HEAD + 6;
const SYM = 28, SCELL = (W - 2 * M) / STATUS.length;
STATUS.forEach((n, i) => layers.push({ input: statusPng(n, SYM * S), left: Math.round((M + i * SCELL) * S), top: Math.round(y * S) }));

const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
  `<stop offset="0" stop-color="${BG[0]}"/><stop offset="1" stop-color="${BG[1]}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
layers.push({ input: Buffer.from(new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${labels}</svg>`, { font: { loadSystemFonts: true } }).render().asPng()), left: 0, top: 0 });
const out = flag("out") ?? join(ROOT, "docs/showcase.png");
await sharp(Buffer.from(new Resvg(bg).render().asPng())).composite(layers).png({ compressionLevel: 9 }).toFile(out);
console.log(`showcase: ${pick(PLACES).length} places, ${apps.length} apps, ${pick(FILES).length} file types, ${STATUS.length} status icons → ${out.replace(ROOT + "/", "")} (bottom at ${y + SYM} of ${H})`);
