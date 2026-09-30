// Drives a running server. Prints how long #content was off screen after each URL write, and
// whether typing "abc" into an input that writes ?q= per keystroke keeps its text and focus.
// Usage: node drive.mjs [baseUrl]        (default http://localhost:3000)
// CHROMIUM_PATH=/path/to/chromium uses an existing browser instead of Playwright's download.
import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://localhost:3000";

const routes = [
  ["/client-page-params/1", "client page, use(params)"],
  ["/client-page-search-params", "client page, use(searchParams)"],
  ["/client-layout-params/1", "client layout, use(params)"],
  ["/control-use-params-hook/1", "control: useParams()"],
  ["/control-server-page/1", "control: server page awaits params"],
  ["/control-passed-promise/1", "control: server page passes its promise"],
];

// Records when #content leaves and returns to the screen. Checked on every DOM mutation as well
// as every animation frame, so a hide shorter than one frame is still counted.
function watchContent() {
  window.__blanks = [];
  const visible = () => {
    const el = document.querySelector("#content");
    return !!el && el.getClientRects().length > 0;
  };
  let hiddenAt = null;
  const check = () => {
    const now = performance.now();
    if (!visible() && hiddenAt === null) hiddenAt = now;
    if (visible() && hiddenAt !== null) {
      window.__blanks.push(Math.round(now - hiddenAt));
      hiddenAt = null;
    }
  };
  new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true });
  const tick = () => {
    check();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function open(path) {
  const page = await browser.newPage();
  await page.goto(baseUrl + path);
  await page.waitForSelector("#content");
  await page.waitForTimeout(800);
  await page.evaluate(watchContent);
  return page;
}

async function blankAfter(page, action) {
  await page.evaluate(() => (window.__blanks.length = 0));
  await action();
  await page.waitForTimeout(900);
  const blanks = await page.evaluate(() => window.__blanks.slice());
  return blanks.length ? blanks.map((ms) => `${ms} ms`).join(" + ") : "none";
}

let affected = 0;
const rows = [];
for (const [path, label] of routes) {
  const page = await open(path);
  const row = {
    route: label,
    replaceState: await blankAfter(page, () => page.evaluate(() => history.replaceState(null, "", "?a=1"))),
    pushState: await blankAfter(page, () => page.evaluate(() => history.pushState(null, "", "?a=2"))),
    "click handler": await blankAfter(page, () => page.click("#btn")),
  };
  await page.click("#q");
  await page.keyboard.type("abc", { delay: 60 });
  await page.waitForTimeout(900);
  const typed = await page.inputValue("#q");
  const focused = await page.evaluate(() => document.activeElement?.id === "q");
  row['typed "abc"'] = JSON.stringify(typed);
  row["input focused"] = focused;
  const blanked = [row.replaceState, row.pushState, row["click handler"]].some((b) => b !== "none");
  if (blanked || typed !== "abc" || !focused) affected++;
  rows.push(row);
  await page.close();
}
console.table(rows);

const plain = await open("/plain-react");
console.table([
  { "plain React, fresh promise per render": "update in a transition", blank: await blankAfter(plain, () => plain.click("#transition")) },
  { "plain React, fresh promise per render": "ordinary update", blank: await blankAfter(plain, () => plain.click("#ordinary")) },
]);

await browser.close();
console.log(`routes that blanked, dropped typing or lost focus: ${affected} of ${routes.length}`);
