// Copy dist/Frost to ~/.local/share/icons/Frost and refresh its cache.
// Never touches any other theme and never changes the active icon theme.
import { cpSync, existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { THEME, THEME_DIR } from "./lib";
import { applyLocalOverlay } from "./local";

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
}
const cache = Bun.spawnSync(["gtk-update-icon-cache", "-f", "-t", "-q", target]);
if (cache.exitCode !== 0) {
  console.error(`gtk-update-icon-cache failed: ${cache.stderr.toString()}`);
  process.exit(1);
}
const active = Bun.spawnSync(["gsettings", "get", "org.gnome.desktop.interface", "icon-theme"]).stdout.toString().trim();
console.log(`install: ${THEME} → ${target} (${active === `'${THEME}'` ? "active theme — refreshed" : "not active; pick it in GNOME Tweaks → Appearance → Icons"})`);
