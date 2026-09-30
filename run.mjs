// Builds and drives the app twice: cacheComponents on, then off.
// Usage: node run.mjs [on|off]     (default: both)
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const version = (name) => require(`${name}/package.json`).version;
console.log(`next ${version("next")}, react ${version("react")}, node ${process.version}`);

const modes = process.argv[2] ? [process.argv[2]] : ["on", "off"];
const next = require.resolve("next/dist/bin/next");

for (const mode of modes) {
  const port = mode === "on" ? 3100 : 3101;
  const env = { ...process.env, CACHE_COMPONENTS: mode === "on" ? "1" : "0" };
  console.log(`\n===== cacheComponents: ${mode === "on"} =====`);

  const build = spawnSync(process.execPath, [next, "build"], { env, encoding: "utf8" });
  if (build.status !== 0) {
    console.error(build.stdout + build.stderr);
    process.exit(1);
  }

  const server = spawn(process.execPath, [next, "start", "-p", String(port)], { env, stdio: "ignore" });
  try {
    for (let i = 0; ; i++) {
      const up = await fetch(`http://localhost:${port}/plain-react`).then((r) => r.ok, () => false);
      if (up) break;
      if (i > 100) throw new Error("server did not start");
      await new Promise((r) => setTimeout(r, 200));
    }
    spawnSync(process.execPath, ["drive.mjs", `http://localhost:${port}`], { env, stdio: "inherit" });
  } finally {
    server.kill();
  }
}
