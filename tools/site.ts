// The colour builder page (GitHub Pages): site/ + generated data → dist/site/.
//   bun tools/site.ts            build dist/site (open dist/site/index.html through a local server to try it)
//   bun tools/site.ts --serve    build, then serve it on http://localhost:4173
// The page recolours the same 128 px SVG the build renders (derive(src, 128)), with the same code (colors-core),
// so what it shows is what install.sh --colors installs.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { catalog, categories, info } from "./colors";
import { SCHEMA_URL } from "./colors-core";
import { DIST, ROOT, derive, sources } from "./lib";

const OUT = join(DIST, "site");
const PAGE_URL = "https://thissayantan.github.io/frost-icon-theme/";
const INSTALL = "https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh";

/** The scene on the preview stage: what a Files window and a dock would show. Label = what a person reads. */
const STAGE = {
  folders: [["user-home", "Home"], ["folder-documents", "Documents"], ["folder-download", "Downloads"], ["folder-pictures", "Pictures"], ["folder-music", "Music"], ["folder", "project"]],
  files: [["application-json", "package.json"], ["text-markdown", "README.md"], ["image-png", "photo.png"], ["audio-mpeg", "song.mp3"], ["application-pdf", "invoice.pdf"], ["application-zip", "backup.zip"], ["text-x-script", "deploy.sh"], ["text-x-generic", "notes.txt"]],
  apps: [["org.gnome.Nautilus", "Files"], ["org.gnome.Settings", "Settings"], ["org.gnome.Ptyxis", "Terminal"], ["org.gnome.TextEditor", "Text Editor"], ["org.gnome.Calculator", "Calculator"], ["org.gnome.Loupe", "Image Viewer"], ["org.gnome.Software", "Software"]],
};

/** DESIGN §3's "Used for" column, so the page can say what each palette colour paints. */
function usedFor(): Map<string, string> {
  const md = readFileSync(join(ROOT, "docs/DESIGN.md"), "utf8").split("## 3. Palette tokens")[1]?.split("\n## ")[0] ?? "";
  return new Map([...md.matchAll(/^\|\s*`(\w+)`\s*\|[^|]*\|[^|]*\|\s*([^|]+?)\s*\|/gm)].map((m) => [m[1], m[2]]));
}

export function buildSite() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "icons"), { recursive: true });
  const cat = catalog(), uses = usedFor(), cats = categories();
  const icons: Record<string, { token?: string; category?: string; folder: boolean; filetype: boolean }> = {};
  const sampleOf = new Map<string, string>();
  for (const s of sources()) {
    const svg = derive(s, 128);
    writeFileSync(join(OUT, "icons", `${s.name}.svg`), svg);
    const i = info(s);
    icons[s.name] = { token: i.token?.name, category: i.category, folder: i.folder, filetype: i.filetype };
    if (i.category && (!sampleOf.has(i.category) || /generic$/.test(s.name))) sampleOf.set(i.category, s.name);
  }
  const order = ["warm", "forest", "ocean", "pastel", "mono"], rank = (f: string) => (order.includes(f.slice(0, -5)) ? order.indexOf(f.slice(0, -5)) : 99);
  const presets = Object.fromEntries(readdirSync(join(ROOT, "presets")).filter((f) => f.endsWith(".json")).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((f) => {
    const { $schema: _, ...c } = JSON.parse(readFileSync(join(ROOT, "presets", f), "utf8"));
    return [f.slice(0, -5), c];
  }));
  const data = {
    pageUrl: PAGE_URL, installUrl: INSTALL, schemaUrl: SCHEMA_URL,
    palette: cat.palette.map((t) => ({ ...t, usedFor: uses.get(t.name) ?? "" })),
    categories: cat.categories.map((c) => ({ name: c, token: cats.get(c), sample: sampleOf.get(c) })),
    names: cat.names.sort(), icons, stage: STAGE, presets,
  };
  writeFileSync(join(OUT, "data.json"), JSON.stringify(data));
  for (const f of readdirSync(join(ROOT, "site"))) cpSync(join(ROOT, "site", f), join(OUT, f), { recursive: true });
  // Pages used to publish docs/ as-is; keep its images at the same URLs for anything that links them.
  for (const f of readdirSync(join(ROOT, "docs")).filter((f) => f.endsWith(".png"))) cpSync(join(ROOT, "docs", f), join(OUT, f));
  const res = Bun.spawnSync(["bun", "build", join(ROOT, "tools/site/app.ts"), "--target=browser", "--minify", "--outfile", join(OUT, "app.js")]);
  if (res.exitCode !== 0) throw new Error(`bundling the page failed:\n${res.stderr.toString()}`);
  console.log(`site: ${Object.keys(icons).length} icons, ${data.categories.length} kinds, ${Object.keys(presets).length} presets → dist/site`);
}

if (import.meta.main) {
  buildSite();
  if (process.argv.includes("--serve")) {
    const server = Bun.serve({
      port: 4173,
      fetch(req) {
        let path = new URL(req.url).pathname.replace(/^\/frost-icon-theme/, "");
        if (path.endsWith("/")) path += "index.html";
        const file = Bun.file(join(OUT, path));
        return file.exists().then((ok) => (ok ? new Response(file) : new Response("not found", { status: 404 })));
      },
    });
    console.log(`serving on http://localhost:${server.port}/`);
  }
}
