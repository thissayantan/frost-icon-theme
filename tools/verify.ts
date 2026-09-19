// Gate for every milestone: lint, dist freshness, index.theme against the spec, file hygiene,
// and a real GTK lookup (tools/lookup.py) of every shipped name and alias.
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { CONTEXTS, DIST, NAME_RE, ROOT, SCALES, SIZES, SRC, SYMBOLIC_DIR, THEME, THEME_DIR, aliases, dirName, sources, symbolicSources, walk } from "./lib";
import { lint } from "./lint";

const BUDGET_MB = 40; // ADR-001 (v0.1: 25 MB) → ADR-006: 134 file types, mostly 256@2x art
const errors: string[] = [];
const fail = (m: string) => errors.push(m);

// 1. sources
for (const e of lint()) fail(`lint: ${e}`);

// 2. dist exists and is fresh
const indexFile = join(THEME_DIR, "index.theme");
if (!existsSync(indexFile)) {
  console.error("✗ dist/Frost/index.theme missing — run `bun run build`");
  process.exit(1);
}
const built = statSync(indexFile).mtimeMs;
const stale = [...walk(SRC), join(ROOT, "docs/DESIGN.md"), ...walk(join(ROOT, "tools")).filter((f) => /build|lib/.test(f))]
  .filter((f) => statSync(f).mtimeMs > built);
if (stale.length) fail(`dist is older than ${relative(ROOT, stale[0])} — run \`bun run build\``);

// 3. index.theme against the Icon Theme Spec
const ini = new Map<string, Map<string, string>>();
let section = "";
for (const raw of readFileSync(indexFile, "utf8").split("\n")) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const h = line.match(/^\[(.+)\]$/);
  if (h) { section = h[1]; if (ini.has(section)) fail(`index.theme: duplicate section [${section}]`); ini.set(section, new Map()); continue; }
  const kv = line.match(/^([A-Za-z0-9-]+(?:\[[^\]]+\])?)=(.*)$/);
  if (!kv || !section) { fail(`index.theme: malformed line "${line}"`); continue; }
  ini.get(section)!.set(kv[1], kv[2]);
}
const head = ini.get("Icon Theme");
if (!head) fail("index.theme: missing [Icon Theme]");
else {
  for (const k of ["Name", "Comment", "Directories"]) if (!head.get(k)) fail(`index.theme: [Icon Theme] missing ${k}`);
  if (head.get("Name") !== THEME) fail(`index.theme: Name should be ${THEME}`);
  const inherits = head.get("Inherits")?.split(",") ?? [];
  if (inherits.at(-1) !== "hicolor") fail("index.theme: Inherits should end with hicolor");
  const dirs = head.get("Directories")?.split(",").filter(Boolean) ?? [];
  const scaled = head.get("ScaledDirectories")?.split(",").filter(Boolean) ?? [];
  for (const d of dirs) if (d.includes("@2x")) fail(`index.theme: ${d} belongs in ScaledDirectories only`);
  for (const d of scaled) if (!d.includes("@2x")) fail(`index.theme: ${d} is not a scaled directory`);
  const listed = new Set([...dirs, ...scaled]);
  if (listed.size !== dirs.length + scaled.length) fail("index.theme: a directory is listed twice");
  for (const d of listed) {
    const s = ini.get(d);
    if (!s) { fail(`index.theme: no [${d}] section`); continue; }
    if (d === SYMBOLIC_DIR) {
      if (s.get("Type") !== "Scalable" || s.get("Size") !== "16") fail(`index.theme: [${d}] must be Type=Scalable, Size=16`);
      if (!existsSync(join(THEME_DIR, d))) fail(`index.theme: ${d} listed but missing on disk`);
      continue;
    }
    if (!existsSync(join(THEME_DIR, d))) fail(`index.theme: ${d} listed but missing on disk`);
    const size = Number(s.get("Size"));
    if (!Number.isInteger(size) || size <= 0) fail(`index.theme: [${d}] Size must be a positive integer`);
    if (!d.startsWith(`${size}x${size}`)) fail(`index.theme: [${d}] Size=${size} does not match its path`);
    const type = s.get("Type") ?? "Threshold";
    if (type !== "Fixed") fail(`index.theme: [${d}] Type=${type}, Frost ships Fixed PNGs (ADR-001)`);
    const scale = Number(s.get("Scale") ?? 1);
    if (scale !== (d.includes("@2x") ? 2 : 1)) fail(`index.theme: [${d}] Scale=${scale} does not match its path`);
    const ctx = d.split("/")[1];
    if (s.get("Context") !== CONTEXTS[ctx]) fail(`index.theme: [${d}] Context should be ${CONTEXTS[ctx]}`);
  }
  for (const size of readdirSync(THEME_DIR).filter((f) => statSync(join(THEME_DIR, f)).isDirectory())) {
    for (const ctx of readdirSync(join(THEME_DIR, size))) {
      if (!listed.has(`${size}/${ctx}`)) fail(`index.theme: ${size}/${ctx} exists on disk but is not listed (ignored by GTK)`);
    }
  }
}

// 4. file hygiene: PNG only, clean names, no broken symlinks, everything at every size
let bytes = 0;
for (const f of walk(THEME_DIR)) {
  const rel = relative(THEME_DIR, f);
  const base = f.slice(f.lastIndexOf("/") + 1);
  if (base === "index.theme" || base === "icon-theme.cache") continue;
  const symbolic = rel.startsWith(SYMBOLIC_DIR + "/");
  if (symbolic ? !base.endsWith("-symbolic.svg") : !base.endsWith(".png")) fail(`dist: ${rel} — PNG only, except *-symbolic.svg in ${SYMBOLIC_DIR} (ADR-001/005)`);
  if (!NAME_RE.test(base)) fail(`dist: ${rel} has a name gtk-update-icon-cache will reject`);
  const l = lstatSync(f);
  if (l.isSymbolicLink()) {
    if (!existsSync(f)) fail(`dist: broken symlink ${rel}`);
  } else bytes += l.size;
}
if (bytes > BUDGET_MB * 1024 * 1024) fail(`dist: ${(bytes / 1048576).toFixed(1)} MB exceeds the ${BUDGET_MB} MB budget`);

const list = sources();
const names: string[] = [];
for (const s of list) {
  names.push(s.name);
  for (const size of SIZES) for (const scale of SCALES) {
    if (!existsSync(join(THEME_DIR, dirName(size, scale, s.context), `${s.name}.png`))) fail(`dist: ${s.name} missing at ${size}@${scale}x`);
  }
}
const symbolicNames = symbolicSources().map((s) => s.name);
names.push(...symbolicNames);
for (const [target, alias] of Object.entries(aliases())) if (list.some((s) => s.name === target) || symbolicNames.includes(target)) names.push(...alias);

const cache = join(THEME_DIR, "icon-theme.cache");
if (!existsSync(cache)) fail("dist: icon-theme.cache missing");
else if (statSync(cache).mtimeMs + 1000 < built) fail("dist: icon-theme.cache is older than index.theme");

// 5. real GTK lookup of every shipped name + alias, against dist/ (not the installed copy)
if (names.length) {
  const res = Bun.spawnSync(["python3", join(ROOT, "tools/lookup.py"), THEME, ...names, "--search-path", DIST, "--sizes", "16,24,48,128", "--json"]);
  if (res.exitCode !== 0 && !res.stdout.length) fail(`lookup.py failed: ${res.stderr.toString().trim()}`);
  else {
    const rows: { name: string; size: number; scale: number; path: string | null; own: boolean }[] = JSON.parse(res.stdout.toString());
    for (const r of rows) {
      if (!r.own || !r.path?.startsWith(THEME_DIR + "/")) fail(`lookup: ${r.name} ${r.size}@${r.scale}x resolved to ${r.path ?? "nothing"}`);
    }
    console.log(`lookup: ${names.length} names × ${rows.length / Math.max(names.length, 1)} size/scale → all inside dist/${THEME}`);
  }
}

// 6. ADR-006: with the MIME add-on applied, real developer files resolve to Frost file-type icons
const probe = Bun.spawnSync(["python3", join(ROOT, "tools/mime-probe.py")]);
process.stdout.write(probe.stdout.toString());
if (probe.exitCode !== 0) fail(`mime-probe failed ${probe.stderr.toString().trim()}`);

for (const e of errors) console.error(`✗ ${e}`);
console.log(`verify: ${list.length} icons, ${(bytes / 1048576).toFixed(1)} MB — ${errors.length ? `${errors.length} problem(s)` : "ok"}`);
process.exit(errors.length ? 1 : 0);
