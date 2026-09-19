// Tag language/tool folders so Files shows their icon (GNOME Files has no per-name folder icons):
//   gio set <dir> metadata::custom-icon-name folder-<lang>
//
//   bun run tag-folders [--dry-run] [--undo] [ROOT…]      default roots: ~/everything/code
// Home-level: ~/Android → folder-android, ~/go → folder-go. Project roots are found by marker files
// (first match wins, see RULES) and are not descended into. Only folders with no custom icon, or with
// one Frost set, are touched; `--undo` removes exactly those. Refresh Files (F5) to see changes.
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { LANG_FOLDERS } from "./local";

const HOME = homedir();
const OURS = new Set(Object.keys(LANG_FOLDERS));
const SKIP = new Set(["node_modules", ".git", "dist", "build", "target", ".venv", "venv", "vendor", ".next"]);
const MAX_DEPTH = 3;

const has = (dir: string, ...files: string[]) => files.some((f) => existsSync(join(dir, f)));
const RULES: [string, (d: string) => boolean][] = [
  ["folder-android", (d) => has(d, "app/src/main/AndroidManifest.xml", "src/main/AndroidManifest.xml")],
  ["folder-flutter", (d) => has(d, "pubspec.yaml")],
  ["folder-go", (d) => has(d, "go.mod")],
  ["folder-rust", (d) => has(d, "Cargo.toml")],
  ["folder-deno", (d) => has(d, "deno.json", "deno.jsonc")],
  ["folder-bun", (d) => has(d, "bun.lock", "bun.lockb")],
  ["folder-typescript", (d) => has(d, "tsconfig.json")],
  ["folder-nodejs", (d) => has(d, "package.json")],
  ["folder-python", (d) => has(d, "pyproject.toml", "requirements.txt", "setup.py", "Pipfile")],
];
const HOME_NAMES: Record<string, string> = { Android: "folder-android", go: "folder-go" };

function current(dir: string): { name: string; file: string } {
  const r = Bun.spawnSync(["gio", "info", "-a", "metadata::custom-icon-name,metadata::custom-icon", dir]);
  const out = r.stdout.toString();
  return {
    name: out.match(/metadata::custom-icon-name: (.+)/)?.[1]?.trim() ?? "",
    file: out.match(/metadata::custom-icon: (.+)/)?.[1]?.trim() ?? "",
  };
}

function detect(dir: string): string | null {
  for (const [icon, test] of RULES) if (test(dir)) return icon;
  return null;
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
    if (icon) yield [dir, icon];
    else yield* projects(dir, depth + 1);
  }
}

const dry = process.argv.includes("--dry-run");
const undo = process.argv.includes("--undo");
const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const targets: [string, string][] = [
  ...Object.entries(HOME_NAMES).map(([n, icon]) => [join(HOME, n), icon] as [string, string]).filter(([d]) => existsSync(d)),
  ...(roots.length ? roots : [join(HOME, "everything/code")]).flatMap((r) => [...projects(r)]),
];

let changed = 0;
for (const [dir, icon] of targets) {
  const cur = current(dir);
  const pretty = dir.replace(HOME, "~");
  if (cur.file || (cur.name && !OURS.has(cur.name))) { console.log(`  skip  ${pretty} (has its own custom icon)`); continue; }
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
