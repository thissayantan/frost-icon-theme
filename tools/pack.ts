// dist/Frost → dist/Frost-v<version>.tar.xz: the theme directory plus the MIME add-on, as install.sh expects.
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DIST, THEME, THEME_DIR } from "./lib";
import { VERSION } from "./build";

if (!existsSync(join(THEME_DIR, "index.theme"))) throw new Error("dist/Frost missing — run `bun run build` first");
copyFileSync(join(import.meta.dir, "mime/frost.xml"), join(DIST, "frost-mime.xml"));
const out = `${THEME}-v${VERSION}.tar.xz`;
const tar = Bun.spawnSync(["tar", "-C", DIST, "-cJf", join(DIST, out), THEME, "frost-mime.xml"]);
if (tar.exitCode !== 0) throw new Error(`tar failed: ${tar.stderr.toString()}`);
console.log(`pack: dist/${out} (${(Bun.file(join(DIST, out)).size / 1048576).toFixed(1)} MB)`);
