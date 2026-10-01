// Drives a running server. For each case: hard-load the start page, click one link, then print where
// the browser ended up and how busy the main thread still is two seconds later.
// Usage: node drive.mjs [baseUrl]        (default http://localhost:3000)
// CHROMIUM_PATH=/path/to/chromium uses an existing browser instead of Playwright's download.
import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://localhost:3000";

// [label, start page, link to click, expected URL, expected <h1>]
const cases = [
  ["redirect()", "/", "/throws-redirect", "/target", "target"],
  ["notFound()", "/", "/throws-not-found", "/throws-not-found", "not-found.jsx"],
  ["throw new Error()", "/", "/throws-error", "/throws-error", "error.jsx"],
  ["redirect(), same dynamic route, prefetch off", "/same-route/1", "/same-route/moved", "/target", "target"],
  ["redirect() in <Suspense>, under a layout that blocks", "/", "/blocking-layout/redirect-in-suspense", "/target", "target"],
  ["notFound(), route only awaits params", "/params-only/1", "/params-only/missing", "/params-only/missing", "not-found.jsx"],
  ["control: nothing thrown", "/", "/control-no-throw", "/control-no-throw", "no throw"],
  ["control: redirect() under <Suspense>", "/", "/control-suspense/redirect", "/target", "target"],
  ["control: redirect() under loading.jsx", "/", "/control-loading/redirect", "/target", "target"],
  ["control: redirect(), other route, prefetch off", "/", "/control-no-prefetch", "/target", "target"],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

let stuck = 0;
const rows = [];
for (const [label, start, href, wantUrl, wantH1] of cases) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const taskSeconds = async () =>
    (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;

  await page.goto(baseUrl + start, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000); // let the viewport prefetches finish
  await page.click(`a[href="${href}"]`);
  await page.waitForTimeout(2000);

  const before = await taskSeconds();
  await page.waitForTimeout(1000);
  const busy = Math.round(((await taskSeconds()) - before) * 100);

  const url = new URL(page.url()).pathname;
  const h1 = await page.textContent("h1");
  const ok = url === wantUrl && h1 === wantH1;
  if (!ok) stuck++;
  rows.push({ case: label, click: `${start} -> ${href}`, "url after": url, "h1 after": h1, "main thread": `${busy}% busy`, result: ok ? "ok" : "STUCK" });
  await context.close();
}
console.table(rows);

await browser.close();
console.log(`clicks that went nowhere: ${stuck} of ${cases.length}`);
