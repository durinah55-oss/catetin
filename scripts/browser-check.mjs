import { chromium } from "playwright";

const BASE = process.env.NF3_URL || "http://localhost:3001";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

async function check(path, waitMs = 5000, name = path) {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(waitMs);
  const text = (await page.evaluate(() => document.body?.innerText || "")).replace(/\s+/g, " ").trim();
  const snippet = text.slice(0, 500);
  console.log(`\n=== ${name} (${res?.status()}) ===`);
  console.log(snippet);
  return { status: res?.status(), text: snippet };
}

await check("/login", 3000, "Login");
await check("/pair", 3000, "Pair");
const dash = await check("/dashboard", 12000, "Dashboard (12s wait)");

if (/Memuat/i.test(dash.text) && !/NF3|Beranda|Login|Daftar/i.test(dash.text)) {
  console.log("\n⚠ Dashboard masih 'Memuat' setelah 12s — cek auth redirect atau load app_state");
}

console.log("\n--- Console errors ---");
logs.filter((l) => /error|fail|404|pageerror/i.test(l)).slice(0, 20).forEach((l) => console.log(l));

await page.screenshot({ path: "scripts/browser-check-dashboard.png", fullPage: true });
console.log("\nScreenshot: scripts/browser-check-dashboard.png");

await browser.close();
