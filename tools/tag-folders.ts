// Tag language/tool folders so Files shows their icon (GNOME Files has no per-name folder icons):
//   gio set <dir> metadata::custom-icon-name folder-<lang>
//
//   bun run tag-folders [--dry-run] [--undo] [ROOT…]      default roots: ~/everything/code
// Home-level: ~/Android → folder-android, ~/go → folder-go. Project roots are found by marker files
// (language first, first match wins — see RULES), else by the majority source extension; not descended into. Only folders with no custom icon, or with
// one Frost set, are touched; `--undo` removes exactly those. Refresh Files (F5) to see changes.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { LANG_FOLDERS, STACK_BRANDS, renderStacks, stackIcon, writeStacks } from "./local";

const HOME = homedir();
const OURS = new Set(Object.keys(LANG_FOLDERS));
const isOurs = (name: string) => OURS.has(name) || name.startsWith("folder-stack-");
const SKIP = new Set(["node_modules", ".git", "dist", "build", "target", ".venv", "venv", "vendor", ".next"]);
const MAX_DEPTH = 3;

const has = (dir: string, ...files: string[]) => files.some((f) => existsSync(join(dir, f)));
const hasExt = (dir: string, ...exts: string[]) => {
  try { return readdirSync(dir).some((f) => exts.some((e) => f.endsWith(e))); } catch { return false; }
};
const read = (dir: string, f: string) => { try { return readFileSync(join(dir, f), "utf8"); } catch { return ""; } };

/** Language first (what the code is), runtime second — a Bun + TypeScript project is TypeScript. First match wins. */
const RULES: [string, (d: string) => boolean][] = [
  ["folder-android", (d) => has(d, "app/src/main/AndroidManifest.xml", "src/main/AndroidManifest.xml")],
  ["folder-flutter", (d) => has(d, "pubspec.yaml") && /\bflutter\b/.test(read(d, "pubspec.yaml"))],
  ["folder-dart", (d) => has(d, "pubspec.yaml")],
  ["folder-go", (d) => has(d, "go.mod")],
  ["folder-rust", (d) => has(d, "Cargo.toml")],
  ["folder-kotlin", (d) => has(d, "build.gradle.kts", "settings.gradle.kts") && !has(d, "pom.xml")],
  ["folder-java", (d) => has(d, "pom.xml", "build.gradle", "settings.gradle")],
  ["folder-swift", (d) => has(d, "Package.swift")],
  ["folder-csharp", (d) => hasExt(d, ".csproj", ".sln")],
  ["folder-php", (d) => has(d, "composer.json")],
  ["folder-ruby", (d) => has(d, "Gemfile")],
  ["folder-deno", (d) => has(d, "deno.json", "deno.jsonc")],
  ["folder-typescript", (d) => has(d, "tsconfig.json") || (has(d, "package.json") && tsWins(d))],
  ["folder-javascript", (d) => has(d, "package.json")],
  ["folder-python", (d) => has(d, "pyproject.toml", "requirements.txt", "setup.py", "Pipfile")],
  ["folder-cpp", (d) => has(d, "CMakeLists.txt") || hasExt(d, ".cpp", ".cc", ".hpp")],
  ["folder-c", (d) => has(d, "Makefile") && hasExt(d, ".c", ".h")],
];

/** Node-ecosystem project without a root tsconfig (monorepos): TypeScript if .ts/.tsx files outnumber .js. */
function tsWins(dir: string): boolean {
  const c = byExtension(dir);
  return (c["folder-typescript"] ?? 0) >= Math.max(1, c["folder-javascript"] ?? 0);
}

/** No marker file: the language most of the source files are in (≥ 3 files, depth ≤ 2). */
const EXT: Record<string, string> = {
  ".sh": "folder-bash", ".bash": "folder-bash", ".py": "folder-python", ".ts": "folder-typescript", ".tsx": "folder-typescript",
  ".js": "folder-javascript", ".mjs": "folder-javascript", ".go": "folder-go", ".rs": "folder-rust", ".rb": "folder-ruby",
  ".php": "folder-php", ".c": "folder-c", ".cpp": "folder-cpp", ".java": "folder-java", ".kt": "folder-kotlin",
  ".swift": "folder-swift", ".dart": "folder-dart", ".cs": "folder-csharp", ".lua": "folder-lua",
};
function byExtension(dir: string, depth = 0, counts: Record<string, number> = {}): Record<string, number> {
  if (depth > 2) return counts;
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return counts; }
  for (const e of entries) {
    if (e.startsWith(".") || SKIP.has(e)) continue;
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) byExtension(p, depth + 1, counts);
    else { const ext = e.slice(e.lastIndexOf(".")); if (EXT[ext]) counts[EXT[ext]] = (counts[EXT[ext]] ?? 0) + 1; }
  }
  return counts;
}
const HOME_NAMES: Record<string, string> = { Android: "folder-android", go: "folder-go" };

function current(dir: string): { name: string; file: string } {
  const r = Bun.spawnSync(["gio", "info", "-a", "metadata::custom-icon-name,metadata::custom-icon", dir]);
  const out = r.stdout.toString();
  return {
    name: out.match(/metadata::custom-icon-name: (.+)/)?.[1]?.trim() ?? "",
    file: out.match(/metadata::custom-icon: (.+)/)?.[1]?.trim() ?? "",
  };
}

/** What a project *contains*, most telling first: [UI framework/platform, backend or runtime, deploy target]. */
function deps(dir: string, depth = 0, acc = new Set<string>()): Set<string> {
  if (depth > 3) return acc;
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return acc; }
  if (entries.includes("package.json")) {
    try {
      const pj = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      for (const k of Object.keys({ ...pj.dependencies, ...pj.devDependencies })) acc.add(k);
    } catch {}
  }
  for (const e of entries) {
    if (e.startsWith(".") || SKIP.has(e)) continue;
    try { if (statSync(join(dir, e)).isDirectory()) deps(join(dir, e), depth + 1, acc); } catch {}
  }
  return acc;
}
function stack(dir: string): string[] {
  const d = deps(dir), any = (...n: string[]) => n.some((x) => d.has(x));
  const deep = (...files: string[]) => files.some((f) => has(dir, f)) || [...readdirSafe(dir)].some((sub) => files.some((f) => has(join(dir, sub), f)));
  const ui = has(dir, "app/src/main/AndroidManifest.xml", "src/main/AndroidManifest.xml") ? "android"
    : has(dir, "pubspec.yaml") ? "flutter"
    : any("next") ? "nextdotjs" : any("expo") ? "expo" : any("astro") ? "astro" : any("svelte", "@sveltejs/kit") ? "svelte"
    : any("vue", "nuxt") ? "vuedotjs" : any("@angular/core") ? "angular" : any("electron") ? "electron"
    : any("@tauri-apps/api") ? "tauri" : any("react") ? "react" : null;
  const backend = any("hono") ? "hono" : any("@nestjs/core") ? "nestjs" : any("fastify") ? "fastify" : any("express") ? "express" : null;
  const runtime = deep("bun.lock", "bun.lockb") ? "bun" : has(dir, "deno.json", "deno.jsonc") ? "deno"
    : has(dir, "go.mod") ? "go" : has(dir, "Cargo.toml") ? "rust" : has(dir, "pyproject.toml", "requirements.txt") ? "python"
    : has(dir, "build.gradle.kts") && !ui ? "kotlin" : has(dir, "package.json") ? "nodedotjs" : null;
  const platform = deep("wrangler.toml", "wrangler.jsonc", "wrangler.json") || any("wrangler") ? "cloudflare"
    : has(dir, "Dockerfile", "docker-compose.yml", "compose.yaml") ? "docker" : has(dir, "vercel.json") ? "vercel"
    : any("@supabase/supabase-js") ? "supabase" : any("firebase") ? "firebase" : null;
  const lang = any("typescript") || deep("tsconfig.json") ? "typescript" : null;
  const picks = [ui, backend, platform, runtime, lang].filter((x): x is string => !!x && x in STACK_BRANDS);
  return [...new Set(picks)].slice(0, 3);  // framework, backend, runtime/platform — three read at 64 px, four don't
}
function readdirSafe(dir: string): string[] { try { return readdirSync(dir).filter((e) => !e.startsWith(".") && !SKIP.has(e)); } catch { return []; } }

function detect(dir: string, leaf = false): string | null {
  for (const [icon, test] of RULES) if (test(dir)) return icon;
  if (!leaf) return null;
  const counts = Object.entries(byExtension(dir)).sort((a, b) => b[1] - a[1]);
  return counts.length && counts[0][1] >= 3 ? counts[0][0] : null;
}

function* projects(root: string, depth = 0): Generator<[string, string]> {
  if (depth > MAX_DEPTH) return;
  let entries: string[] = [];
  try { entries = readdirSync(root); } catch { return; }
  for (const e of entries) {
    if (e.startsWith(".") || SKIP.has(e)) continue;
    const dir = join(root, e);
    try { if (!statSync(dir).isDirectory()) continue; } catch { continue; }
    const icon = detect(dir);
    if (icon) { yield [dir, icon]; continue; }
    const sub = [...projects(dir, depth + 1)];
    if (sub.length) yield* sub;
    else { const byExt = detect(dir, true); if (byExt) yield [dir, byExt]; }
  }
}

const dry = process.argv.includes("--dry-run");
const undo = process.argv.includes("--undo");
const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const targets: [string, string][] = [
  ...Object.entries(HOME_NAMES).map(([n, icon]) => [join(HOME, n), icon] as [string, string]).filter(([d]) => existsSync(d)),
  ...(roots.length ? roots : [join(HOME, "everything/code")]).flatMap((r) => [...projects(r)]),
];

// Projects show their stack (up to 3 badges); folders without a detectable stack keep the language mark.
const combos = new Map<string, string[]>();
for (const t of targets) {
  if (t[0].startsWith(join(HOME, "everything")) || !Object.keys(HOME_NAMES).some((n) => t[0] === join(HOME, n))) {
    const st = stack(t[0]);
    if (st.length) { t[1] = stackIcon(st); combos.set(t[1], st); }
  }
}
if (!undo && !dry) {
  writeStacks([...combos.values()]);
  const target = join(HOME, ".local/share/icons/Frost");
  if (existsSync(join(target, "index.theme"))) {
    await renderStacks(target);
    Bun.spawnSync(["gtk-update-icon-cache", "-f", "-t", "-q", target]);
  }
}

let changed = 0;
for (const [dir, icon] of targets) {
  const cur = current(dir);
  const pretty = dir.replace(HOME, "~");
  if (cur.file || (cur.name && !isOurs(cur.name))) { console.log(`  skip  ${pretty} (has its own custom icon)`); continue; }
  if (undo) {
    if (!cur.name) continue;
    if (!dry) Bun.spawnSync(["gio", "set", "-t", "unset", dir, "metadata::custom-icon-name"]);
    console.log(`  unset ${pretty}`);
    changed++;
  } else {
    if (cur.name === icon) continue;
    if (!dry) Bun.spawnSync(["gio", "set", dir, "metadata::custom-icon-name", icon]);
    console.log(`  ${icon.padEnd(18)} ${pretty}`);
    changed++;
  }
}
console.log(`tag-folders: ${changed} folder(s) ${undo ? "untagged" : "tagged"}${dry ? " (dry run)" : ""}`);
