// For `next dev`: prints which React work loop renders the page after a URL write.
// Usage: node drive-render-stack.mjs [baseUrl]        (default http://localhost:3000)
import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.goto(`${baseUrl}/render-stack/1`);
await page.waitForSelector("#content");
await page.waitForTimeout(2500);
await page.evaluate(() => {
  window.__renders = [`${Math.round(performance.now())} history.replaceState`];
  history.replaceState(null, "", "?a=1");
});
await page.waitForTimeout(1200);
console.log(await page.evaluate(() => window.__renders.join("\n")));
await browser.close();
