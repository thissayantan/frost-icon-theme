// Copy dist/Frost to ~/.local/share/icons/Frost and refresh its cache.
// Never touches any other theme and never changes the active icon theme.
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { THEME, THEME_DIR } from "./lib";
import { applyLauncherOverrides, applyLocalOverlay } from "./local";

if (process.argv.includes("--undo-launchers")) {
  console.log(`install: removed launcher overrides → ${applyLauncherOverrides(true).join(", ") || "none"}`);
  process.exit(0);
}

// ADR-006: per-user MIME add-on (types for lock/env/Dockerfile/TS/key files), never system-wide.
const mimeDir = join(homedir(), ".local/share/mime"), mimePkg = join(mimeDir, "packages/frost.xml");
function refreshMime(): void {
  const r = Bun.spawnSync(["update-mime-database", mimeDir]);
  if (r.exitCode !== 0) throw new Error(`update-mime-database failed: ${r.stderr.toString()}`);
}
if (process.argv.includes("--undo-mime")) {
  rmSync(mimePkg, { force: true });
  refreshMime();
  console.log("install: removed the Frost MIME add-on (restart Files: nautilus -q)");
  process.exit(0);
}

const target = join(homedir(), ".local/share/icons", THEME);
if (!existsSync(join(THEME_DIR, "index.theme"))) {
  console.error("dist/Frost missing — run `bun run build` first");
  process.exit(1);
}
if (!target.endsWith(`/icons/${THEME}`)) throw new Error(`refusing to write to ${target}`);

rmSync(target, { recursive: true, force: true });
cpSync(THEME_DIR, target, { recursive: true, verbatimSymlinks: true });
if (!process.argv.includes("--no-local")) {
  const extra = await applyLocalOverlay(target);
  if (extra.length) console.log(`install: personal overlay (not in the repo) → ${extra.join(", ")}`);
  const launchers = applyLauncherOverrides();
  if (launchers.length) console.log(`install: launcher overrides (undo: bun run install:local --undo-launchers) → ${launchers.join(", ")}`);
}
if (!process.argv.includes("--no-mime")) {
  mkdirSync(join(mimeDir, "packages"), { recursive: true });
  copyFileSync(join(import.meta.dir, "mime/frost.xml"), mimePkg);
  refreshMime();
  console.log(`install: MIME add-on → ${mimePkg} (undo: bun run install:local --undo-mime; restart Files: nautilus -q)`);
}
const cache = Bun.spawnSync(["gtk-update-icon-cache", "-f", "-t", "-q", target]);
if (cache.exitCode !== 0) {
  console.error(`gtk-update-icon-cache failed: ${cache.stderr.toString()}`);
  process.exit(1);
}
const active = Bun.spawnSync(["gsettings", "get", "org.gnome.desktop.interface", "icon-theme"]).stdout.toString().trim();
console.log(`install: ${THEME} → ${target} (${active === `'${THEME}'` ? "active theme — refreshed" : "not active; pick it in GNOME Tweaks → Appearance → Icons"})`);
