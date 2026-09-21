// The colour builder page: edit a frost.colors.json with colour pickers, preview Frost's real icons recoloured by
// the same code the installer uses (colors-core), and leave with a download, a link, or one install command.
import {
  decodeConfig, encodeConfig, makeRecolor, toHex, toPair, validate, contrastOnWhite, MIN_CONTRAST,
  type Catalog, type ColorConfig, type ColorValue, type IconInfo, type Token,
} from "../colors-core";

type Data = {
  pageUrl: string; installUrl: string; schemaUrl: string;
  palette: (Token & { usedFor: string })[];
  categories: { name: string; token?: string; sample?: string }[];
  names: string[];
  icons: Record<string, { token?: string; category?: string; folder: boolean; filetype: boolean }>;
  stage: { folders: string[][]; files: string[][]; apps: string[][] };
  presets: Record<string, ColorConfig>;
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {}, ...kids: (Node | string)[]) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("data-") || k.startsWith("aria-") || k === "role") e.setAttribute(k, String(v));
    else (e as unknown as Record<string, unknown>)[k] = v;
  }
  e.append(...kids);
  return e;
};

const data: Data = await (await fetch("data.json")).json();
const catalog: Catalog = { palette: data.palette, categories: data.categories.map((c) => c.name), names: data.names };
const svgCache = new Map<string, Promise<string>>();
const svgOf = (name: string) => {
  if (!svgCache.has(name)) svgCache.set(name, fetch(`icons/${name}.svg`).then((r) => r.text()));
  return svgCache.get(name)!;
};
const infoOf = (name: string): IconInfo => {
  const i = data.icons[name];
  return { name, token: data.palette.find((t) => t.name === i?.token), category: i?.category, folder: !!i?.folder, filetype: !!i?.filetype };
};

// ── state ────────────────────────────────────────────────────────────────────
let config: ColorConfig = {};
let preset = "";
const fromLink = new URLSearchParams(location.search).get("c") ?? new URLSearchParams(location.hash.slice(1)).get("c");
if (fromLink) {
  try {
    const c = decodeConfig(fromLink);
    if (!validate(c, catalog).length) config = c;
  } catch { /* a damaged link starts from Frost's colours */ }
}

/** The config without empty parts, in the order a person would read it. */
function clean(c: ColorConfig): ColorConfig {
  const out: ColorConfig = { $schema: data.schemaUrl, version: 1 };
  if (c.description) out.description = c.description;
  if (c.folders) out.folders = c.folders;
  if (typeof c.filetypes === "string") out.filetypes = c.filetypes;
  else if (c.filetypes && Object.keys(c.filetypes).length) out.filetypes = c.filetypes;
  if (c.palette && Object.keys(c.palette).length) out.palette = c.palette;
  if (c.icons && Object.keys(c.icons).length) out.icons = c.icons;
  return out;
}
const isEmpty = (c: ColorConfig) => !c.folders && !c.filetypes && !Object.keys(c.palette ?? {}).length && !Object.keys(c.icons ?? {}).length;
const linkFor = (c: ColorConfig) => { const { $schema: _, ...rest } = clean(c); return `${data.pageUrl}?c=${encodeConfig(rest)}`; };

/** Change the config. While a colour picker is being dragged (final = false) only the preview and the output
 *  update, so the picker itself isn't rebuilt under the pointer. */
function set(mutate: (c: ColorConfig) => void, final = true) {
  mutate(config);
  preset = "";
  delete config.description; // a preset's description stops being true once it is edited
  if (final) return render();
  renderOutput();
  void renderStage();
}

// ── one colour choice: swatch + text (any CSS colour) + clear ────────────────
function colourRow(opts: { thumb?: string; label: string; sub?: string; value: ColorValue | undefined; fallback: string; onChange: (v: string | undefined, final?: boolean) => void }) {
  const current = typeof opts.value === "string" ? opts.value : opts.value?.deep;
  const hex = (current && toHex(current)) ?? opts.fallback;
  const text = el("input", { type: "text", value: current ?? "", placeholder: "Frost", "aria-label": `${opts.label} colour`, spellcheck: false });
  const picker = el("input", { type: "color", value: hex.toLowerCase(), "aria-label": `Pick a colour for ${opts.label}` });
  const clear = el("button", { type: "button", className: "clear", title: "Back to Frost's colour", "aria-label": `Reset ${opts.label}` }, "×");
  picker.addEventListener("input", () => { text.value = picker.value.toUpperCase(); opts.onChange(picker.value.toUpperCase(), false); });
  picker.addEventListener("change", () => opts.onChange(picker.value.toUpperCase(), true));
  text.addEventListener("change", () => {
    const v = text.value.trim();
    if (!v) return opts.onChange(undefined);
    if (!toHex(v)) { text.setAttribute("aria-invalid", "true"); return; }
    opts.onChange(v);
  });
  clear.addEventListener("click", () => opts.onChange(undefined));
  const row = el("div", { className: `row${current ? "" : " is-default"}` });
  const thumb = el("img", { className: "thumb", alt: "" });
  if (opts.thumb) recoloured(opts.thumb).then((src) => (thumb.src = src));
  row.append(thumb, el("div", { className: "label" }, el("b", {}, opts.label), ...(opts.sub ? [el("small", {}, opts.sub)] : [])), el("div", { className: "pick" }, picker, text, ...(current ? [clear] : [])));
  if (opts.value) {
    const r = contrastOnWhite(toPair(opts.value, data.palette).deep);
    if (r < MIN_CONTRAST) row.append(el("div", { className: "note" }, "Too light for the white symbols on top. Try a slightly deeper shade."));
  }
  return row;
}

// ── recolouring ──────────────────────────────────────────────────────────────
const urls = new Map<string, string>();
async function recoloured(name: string): Promise<string> {
  const svg = await svgOf(name);
  const out = makeRecolor(config, data.palette).apply(infoOf(name), svg);
  const key = `${name}:${out.length}:${hashish(out)}`;
  if (!urls.has(key)) urls.set(key, URL.createObjectURL(new Blob([out], { type: "image/svg+xml" })));
  return urls.get(key)!;
}
function hashish(s: string) { let h = 0; for (let i = 0; i < s.length; i += 7) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

// ── rendering ────────────────────────────────────────────────────────────────
function renderPresets() {
  const box = $("presets");
  box.replaceChildren();
  const choices: [string, ColorConfig][] = [["Frost", {}], ...Object.entries(data.presets)];
  for (const [name, c] of choices) {
    const on = name === "Frost" ? isEmpty(config) && !preset : preset === name;
    const b = el("button", { type: "button", className: "preset", role: "radio", "aria-checked": String(on) }, el("img", { alt: "" }), name);
    const img = b.querySelector("img")!;
    const mk = makeRecolor(c, data.palette);
    svgOf("folder").then((svg) => (img.src = URL.createObjectURL(new Blob([mk.apply(infoOf("folder"), svg)], { type: "image/svg+xml" }))));
    b.addEventListener("click", () => { config = structuredClone(c); preset = name === "Frost" ? "" : name; render(); });
    box.append(b);
  }
  $("preset-note").textContent = preset ? (data.presets[preset].description ?? "") : isEmpty(config) ? "Frost's own colours. Change anything below." : "Your own mix.";
}

function renderControls() {
  $("folders").replaceChildren(colourRow({
    thumb: "folder", label: "All folders", value: config.folders, fallback: "#6A93FA",
    onChange: (v, f) => set((c) => { if (v) c.folders = v; else delete c.folders; }, f),
  }));

  const all = typeof config.filetypes === "string" ? config.filetypes : undefined;
  $("filetypes-all").replaceChildren(colourRow({
    thumb: "text-x-generic", label: "All file types", value: all, fallback: "#A4ABB8",
    onChange: (v, f) => set((c) => { if (v) c.filetypes = v; else delete c.filetypes; }, f),
  }));
  const per = typeof config.filetypes === "object" ? config.filetypes as Record<string, ColorValue> : {};
  const kinds = $("kinds");
  kinds.replaceChildren(...data.categories.map((k) => colourRow({
    thumb: k.sample, label: k.name, sub: k.token ? `Frost ${k.token}` : undefined, value: per[k.name],
    fallback: data.palette.find((t) => t.name === k.token)?.deep ?? "#7A8394",
    onChange: (v, f) => set((c) => {
      const map = typeof c.filetypes === "object" ? { ...(c.filetypes as Record<string, ColorValue>) } : {};
      if (v) map[k.name] = v; else delete map[k.name];
      c.filetypes = Object.keys(map).length ? map : undefined;
    }, f),
  })));
  if (Object.keys(per).length) ($("kinds-wrap") as HTMLDetailsElement).open = true;

  $("palette").replaceChildren(...data.palette.map((t) => colourRow({
    thumb: data.names.find((n) => data.icons[n].token === t.name && !data.icons[n].filetype && !data.icons[n].folder) ?? undefined,
    label: `Frost ${t.name}`, sub: t.usedFor, value: config.palette?.[t.name], fallback: t.deep,
    onChange: (v, f) => set((c) => {
      const p = { ...(c.palette ?? {}) };
      if (v) p[t.name] = v; else delete p[t.name];
      c.palette = p;
    }, f),
  })));

  $("icons").replaceChildren(...Object.entries(config.icons ?? {}).map(([name, v]) => colourRow({
    thumb: name, label: name, value: v, fallback: "#6A93FA",
    onChange: (nv, f) => set((c) => {
      const i = { ...(c.icons ?? {}) };
      if (nv) i[name] = nv; else delete i[name];
      c.icons = i;
    }, f),
  })));
}

async function renderStage() {
  const tile = async (name: string, label: string, dock = false) => {
    const img = el("img", { alt: dock ? label : "", src: await recoloured(name), title: label });
    return dock ? img : el("div", { className: "tile" }, img, el("span", {}, label));
  };
  const extra = Object.keys(config.icons ?? {}).filter((n) => ![...data.stage.folders, ...data.stage.files, ...data.stage.apps].some(([m]) => m === n));
  const files = [...data.stage.folders, ...data.stage.files, ...extra.filter((n) => !data.icons[n]?.token || data.icons[n].filetype || data.icons[n].folder).map((n) => [n, n])];
  const apps = [...data.stage.apps, ...extra.filter((n) => !files.some(([m]) => m === n)).map((n) => [n, n])];
  $("stage-files").replaceChildren(...await Promise.all(files.map(([n, l]) => tile(n, l))));
  $("stage-apps").replaceChildren(...await Promise.all(apps.map(([n, l]) => tile(n, l, true))));
}

function renderOutput() {
  const c = clean(config);
  const empty = isEmpty(config);
  const base = `curl -fsSL ${data.installUrl} | sh`;
  $("cmd").textContent = empty ? base : `${base} -s -- --colors '${linkFor(config)}'`;
  $("install-hint").textContent = empty
    ? "Nothing changed yet, so this installs Frost in its own colours."
    : "Paste this in a terminal. It explains each step and asks before installing anything; your colours travel inside the link.";
  $("json").textContent = JSON.stringify(c, null, 2);
  const warnings = makeRecolor(config, data.palette).warnings;
  $("warnings").replaceChildren(...warnings.map((w) => el("li", {}, w)));
  history.replaceState(null, "", empty ? location.pathname : `?c=${encodeConfig((({ $schema: _, ...r }) => r)(c))}`);
}

function render() {
  renderPresets();
  renderControls();
  renderOutput();
  void renderStage();
}

// ── actions ──────────────────────────────────────────────────────────────────
const toast = (msg: string) => { $("toast").textContent = msg; setTimeout(() => ($("toast").textContent = ""), 2600); };
const copy = async (text: string, msg: string) => { await navigator.clipboard.writeText(text); toast(msg); };

$("copy-cmd").addEventListener("click", () => copy($("cmd").textContent ?? "", "Copied the install command."));
$("copy-link").addEventListener("click", () => copy(linkFor(config), "Copied a link to these colours."));
$("download").addEventListener("click", () => {
  const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(clean(config), null, 2) + "\n"], { type: "application/json" })), download: "frost.colors.json" });
  a.click();
  toast("Downloaded frost.colors.json. Install it with: sh install.sh --colors frost.colors.json");
});
$("reset").addEventListener("click", () => { config = {}; preset = ""; render(); toast("Back to Frost's own colours."); });
$<HTMLInputElement>("import").addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const c = JSON.parse(await file.text());
    const errors = validate(c, catalog);
    if (errors.length) return toast(`That file has problems: ${errors[0]}`);
    config = c; preset = ""; render(); toast(`Opened ${file.name}.`);
  } catch { toast(`${file.name} isn't a JSON file.`); }
});

const search = $<HTMLInputElement>("icon-search");
$("icon-names").replaceChildren(...data.names.map((n) => el("option", { value: n })));
const addIcon = () => {
  const q = search.value.trim().toLowerCase();
  const name = data.names.find((n) => n.toLowerCase() === q) ?? data.names.find((n) => n.toLowerCase().includes(q));
  if (!q || !name) return toast(q ? `No icon matches "${search.value}".` : "Type an icon name first.");
  set((c) => { c.icons = { ...(c.icons ?? {}), [name]: c.icons?.[name] ?? "#6A93FA" }; });
  search.value = "";
};
$("icon-add").addEventListener("click", addIcon);
search.addEventListener("keydown", (e) => { if (e.key === "Enter") addIcon(); });

for (const b of document.querySelectorAll<HTMLButtonElement>(".bg-switch button")) {
  b.addEventListener("click", () => {
    $("stage").dataset.bg = b.dataset.bg;
    for (const o of document.querySelectorAll(".bg-switch button")) o.setAttribute("aria-checked", String(o === b));
  });
}

render();
