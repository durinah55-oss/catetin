import { chromium } from "playwright";

const BASE = process.env.NF3_URL || "http://localhost:3001";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

const res = await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });
console.log("status", res?.status());

await page.waitForTimeout(8000);

const text = await page.evaluate(() => document.body?.innerText?.slice(0, 4000) || "");
const navLabels = await page.evaluate(() =>
  [...document.querySelectorAll("button span")].map((el) => el.textContent?.trim()).filter(Boolean)
);

console.log("--- NAV LABELS ---");
console.log([...new Set(navLabels)].join(" | "));
console.log("--- BODY SNIPPET ---");
console.log(text.slice(0, 1500));
console.log("--- ERRORS ---");
logs.filter((l) => /error|404|fail/i.test(l)).slice(0, 15).forEach((l) => console.log(l));

await page.screenshot({ path: "scripts/purchasing-dashboard.png", fullPage: true });
console.log("screenshot scripts/purchasing-dashboard.png");

await browser.close();
