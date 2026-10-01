// Logs React's work loop during one click, to show why nothing commits.
// Adds log lines to the React that Next bundles (next/dist/compiled/react-dom), builds, clicks,
// prints the log, then puts the file back. The added lines only log.
// Usage: node trace.mjs [on|off] [start page] [link]     (default: on / /throws-redirect)
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const [mode = "on", start = "/", href = "/throws-redirect"] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");
const reactFile = require.resolve("next/dist/compiled/react-dom/cjs/react-dom-client.production.js");

// [text that must appear exactly once, what to put in its place]
const edits = [
  [
    "function performWorkOnRoot(root$jscomp$0, lanes, forceSync) {\n",
    `function __trace(line) {
  var log = globalThis.__trace || (globalThis.__trace = { lines: [], count: 0 });
  log.count++;
  if (log.lines.length < 32) log.lines.push(line);
}
function __lanes(lanes) {
  var names = [];
  for (var i = 0; i < 31; i++)
    if (lanes & (1 << i))
      names.push(i >= 18 && i <= 21 ? "deferred" + (i - 17) : i >= 8 && i <= 17 ? "transition" + (i - 7) : "lane" + i);
  return "[" + names.join(" ") + "]";
}
var __exit = ["in progress", "fatal", "ERRORED", "suspended", "suspended with delay", "completed", "SUSPENDED AT THE SHELL"];
$&`,
  ],
  [
    "    renderWasConcurrent = shouldTimeSlice;\n",
    `$&  0 !== exitStatus && __trace("render       " + __lanes(lanes) + " -> " + __exit[exitStatus] + "   (pending " + __lanes(root$jscomp$0.pendingLanes) + ")");\n`,
  ],
  [
    "            if (\n              2 !== JSCompiler_inline_result &&\n              6 !== JSCompiler_inline_result\n",
    `            __trace("  sync retry " + __lanes(lanes) + " -> " + __exit[JSCompiler_inline_result]);\n$&`,
  ],
  [
    "function mountDeferredValueImpl(hook, value, initialValue) {\n",
    `$&  void 0 !== initialValue && value !== initialValue &&
    __trace("    useDeferredValue(real, shell) returns the " + (0 !== (renderLanes & 1073741824) && 0 === (workInProgressRootRenderLanes & 261930) ? "real response" : "shell"));\n`,
  ],
  [
    "  suspendedState\n) {\n  var remainingLanes = finishedWork.lanes | finishedWork.childLanes;\n",
    `$&  __trace("COMMIT       " + __lanes(lanes));\n`,
  ],
];

const original = readFileSync(reactFile, "utf8");
let edited = original;
for (const [find, replace] of edits) {
  if (edited.split(find).length !== 2) throw new Error(`expected exactly one match for:\n${find}`);
  edited = edited.replace(find, () => replace.replaceAll("$&", () => find));
}

const port = 3102;
const env = { ...process.env, CACHE_COMPONENTS: mode === "on" ? "1" : "0" };
let server;
try {
  writeFileSync(reactFile, edited);
  const build = spawnSync(process.execPath, [next, "build"], { env, encoding: "utf8" });
  if (build.status !== 0) throw new Error(build.stdout + build.stderr);

  server = spawn(process.execPath, [next, "start", "-p", String(port)], { env, stdio: "ignore" });
  const baseUrl = `http://localhost:${port}`;
  for (let i = 0; ; i++) {
    if (await fetch(`${baseUrl}/target`).then((r) => r.ok, () => false)) break;
    if (i > 100) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 200));
  }

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage();
  await page.goto(baseUrl + start, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => (globalThis.__trace = { lines: [], count: 0 }));
  await page.click(`a[href="${href}"]`);
  await page.waitForTimeout(2000);
  const before = await page.evaluate(() => globalThis.__trace.count);
  await page.waitForTimeout(1000);
  const { lines, count } = await page.evaluate(() => globalThis.__trace);

  console.log(`next ${require("next/package.json").version}, bundled react-dom ${/exports\.version = "(.+?)"/.exec(original)[1]}`);
  console.log(`cacheComponents: ${mode === "on"}, ${start} -> ${href}`);
  console.log(`url after 3 s: ${new URL(page.url()).pathname}`);
  console.log(`log lines in the third second: ${count - before}`);
  console.log("each useDeferredValue line belongs to the render or retry printed under it\n");
  console.log(lines.join("\n"));
  if (count > lines.length) console.log(`... ${count - lines.length} more lines`);
  await browser.close();
} finally {
  server?.kill();
  writeFileSync(reactFile, original);
}
