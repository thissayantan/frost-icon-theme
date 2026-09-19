#!/usr/bin/env python3
"""Probe: with the Frost MIME add-on applied (in a temp XDG_DATA_HOME), the icon GTK asks for first for each
sample developer file must be shipped by dist/Frost — not a fallback. Run by `bun run verify`."""
import os, subprocess, sys, tempfile, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLES = {  # name: content
    "package.json": '{"a":1}\n', "tsconfig.jsonc": "{}\n", "bun.lock": "lockfileVersion 1\n", "Cargo.lock": "version = 3\n",
    "CLAUDE.md": "# x\n", "notes.txt": "x\n", "server-cert.pem": "-----BEGIN CERTIFICATE-----\nx\n", "server.key": "-----BEGIN PRIVATE KEY-----\nx\n",
    "id_ed25519.pub": "ssh-ed25519 AAAA x\n", ".env": "A=1\n", "Dockerfile": "FROM alpine\n", ".gitignore": "x\n", "go.mod": "module x\n",
    "go.sum": "x h1:a\n", "main.go": "package main\n", "app.ts": "const a = 1;\n", "App.tsx": "export {}\n", "run.sh": "#!/bin/sh\necho\n",
    ".zshrc": "echo\n", "tool.py": "print(1)\n", "config.yaml": "a: 1\n", "Cargo.toml": "[a]\n", "setup.cfg": "[a]\n", "x.proto": "syntax = \"proto3\";\n",
    "main.tf": "a = 1\n", "data.csv": "a,b\n", "fix.patch": "--- a\n+++ b\n", "q.sql": "select 1;\n", "app.log": "x\n", "page.html": "<html></html>\n",
    "Makefile": "all:\n", "init.lua": "print(1)\n",
}
def main():
    dist = os.path.join(ROOT, "dist/Frost/48x48/mimetypes")
    tmp = tempfile.mkdtemp(prefix="frost-mime-")
    try:
        os.makedirs(f"{tmp}/mime/packages"); shutil.copy(f"{ROOT}/tools/mime/frost.xml", f"{tmp}/mime/packages/")
        subprocess.run(["update-mime-database", f"{tmp}/mime"], check=True, capture_output=True)
        os.makedirs(f"{tmp}/f")
        for n, body in SAMPLES.items(): open(f"{tmp}/f/{n}", "w").write(body)
        code = ("import gi,os,sys;gi.require_version('Gio','2.0');from gi.repository import Gio\n"
                "for n in sys.argv[1:]:\n"
                " i=Gio.File.new_for_path(n).query_info('standard::icon',0,None); print(n, i.get_icon().get_names()[0])")
        out = subprocess.run([sys.executable, "-c", code, *SAMPLES], cwd=f"{tmp}/f", capture_output=True, text=True,
                             env={**os.environ, "XDG_DATA_HOME": tmp}, check=True).stdout
        bad = [line for line in out.splitlines() if not os.path.exists(f"{dist}/{line.split()[1]}.png")]
        for line in bad: print(f"✗ mime-probe: {line} — not shipped by Frost")
        print(f"mime-probe: {len(SAMPLES) - len(bad)}/{len(SAMPLES)} sample files resolve to a Frost file-type icon")
        return 1 if bad else 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
sys.exit(main())
