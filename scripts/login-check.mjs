import { chromium } from "playwright";

const BASE = process.env.NF3_URL || "http://localhost:3001";
const email = process.env.NF3_TEST_EMAIL || "sampriatna@gmail.com";
const password = process.env.NF3_TEST_PASSWORD || "";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

console.log("=== 1. Halaman login ===");
const loginRes = await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2500);
const loginText = await page.evaluate(() => document.body.innerText.slice(0, 800));
console.log("HTTP", loginRes?.status());
console.log("Ada form email:", /email/i.test(loginText));
console.log("Ada Lupa password:", /Lupa password/i.test(loginText));
console.log("Snippet:", loginText.replace(/\s+/g, " ").slice(0, 220));

if (!password) {
  console.log("\n=== 2. Login penuh ===");
  console.log("SKIP — password tidak diset. Jalankan:");
  console.log('  $env:NF3_TEST_PASSWORD="password-anda"; node scripts/login-check.mjs');
} else {
  console.log(`\n=== 2. Login sebagai ${email} ===`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole("button", { name: /Masuk/i }).click();
  await page.waitForTimeout(10000);
  const after = await page.evaluate(() => ({
    url: location.href,
    text: document.body.innerText.slice(0, 1500),
  }));
  console.log("URL:", after.url);
  const badges = ["Owner", "Admin", "Kasir", "Purchasing", "Memuat", "NF3 Assistant", "Beranda"];
  console.log("Terdeteksi:", badges.filter((b) => after.text.includes(b)).join(", ") || "(tidak jelas)");
  const errMatch = after.text.match(/Invalid|salah|error|Gagal/i);
  if (errMatch) console.log("Kemungkinan error login:", errMatch[0]);

  const fab = page.locator('button[aria-label="Buka NF3 Assistant"]');
  const fabCount = await fab.count();
  console.log("Tombol ✦ NF3 Assistant:", fabCount);
  if (fabCount > 0) {
    await fab.click();
    await page.waitForTimeout(1500);
    const chatOpen = await page.evaluate(() => document.body.innerText.includes("Mau tanya apa"));
    console.log("Chat panel terbuka:", chatOpen);
  }
}

console.log("\n=== 3. /dashboard tanpa sesi ===");
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const dash = await page.evaluate(() => ({
  url: location.href,
  text: document.body.innerText.slice(0, 500),
}));
console.log("URL:", dash.url);
console.log("Snippet:", dash.text.replace(/\s+/g, " ").slice(0, 200));

console.log("\n=== API nf3-assistant tanpa token ===");
const apiRes = await page.evaluate(async () => {
  const r = await fetch("/api/nf3-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId: "e23ed572-234c-4995-acad-fa6bff7c58d2", messages: [{ role: "user", content: "test" }] }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
});
console.log("Status:", apiRes.status, "|", apiRes.body?.error || apiRes.body?.message || "");

console.log("\n=== Console errors (sample) ===");
logs.filter((l) => /error|fail|pageerror/i.test(l)).slice(0, 8).forEach((l) => console.log(l));

await page.screenshot({ path: "scripts/login-check.png", fullPage: true });
console.log("\nScreenshot: scripts/login-check.png");
await browser.close();
