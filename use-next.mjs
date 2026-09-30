// Swaps the installed Next without touching package.json.
// Usage: node use-next.mjs <version | dist-tag | path to a .tgz | path to a built packages/next folder>
// A folder is packed to a tarball first: a symlinked Next cannot resolve its own compiled modules.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const target = process.argv[2];
if (!target) {
  console.error("usage: node use-next.mjs <version | dist-tag | tarball | packages/next folder>");
  process.exit(1);
}

function npm(args, options) {
  const result = spawnSync("npm", args, { encoding: "utf8", shell: process.platform === "win32", ...options });
  if (result.status !== 0) {
    console.error(result.stdout + result.stderr);
    process.exit(1);
  }
  return result.stdout;
}

let spec = `next@${target}`;
if (existsSync(target)) {
  spec = path.resolve(target);
  if (statSync(spec).isDirectory()) {
    const out = mkdtempSync(path.join(tmpdir(), "next-pack-"));
    const name = npm(["pack", "--silent", "--pack-destination", out], { cwd: spec }).trim().split("\n").pop();
    spec = path.join(out, name);
  }
}

npm(["install", "--no-save", "--no-audit", "--no-fund", spec]);
console.log(`installed ${spec}`);
