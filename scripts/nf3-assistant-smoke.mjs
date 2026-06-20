/**
 * Smoke test NF3 Assistant — no auto API on load, auth gate, optional login flow.
 * Usage:
 *   node scripts/nf3-assistant-smoke.mjs
 *   $env:NF3_TEST_PASSWORD="..."; node scripts/nf3-assistant-smoke.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.NF3_URL || "http://localhost:3001";
const email = process.env.NF3_TEST_EMAIL || "sampriatna@gmail.com";
const password = process.env.NF3_TEST_PASSWORD || "";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

const apiCalls = [];
page.on("request", (req) => {
  const url = req.url();
  if (url.includes("/api/nf3-assistant") || url.includes("/api/business-analysis")) {
    apiCalls.push({ url, method: req.method(), when: Date.now() });
  }
});

let passed = 0;
let failed = 0;
function ok(label) {
  console.log(`  ✓ ${label}`);
  passed++;
}
function fail(label, detail = "") {
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  failed++;
}

console.log(`\n=== NF3 Assistant smoke test @ ${BASE} ===\n`);

// 1. Dashboard tanpa sesi — tidak boleh panggil assistant API
console.log("1. Dashboard tanpa sesi");
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const assistantBeforeLogin = apiCalls.filter((c) => c.url.includes("nf3-assistant"));
if (assistantBeforeLogin.length === 0) ok("Tidak ada call /api/nf3-assistant sebelum login");
else fail("Auto-call nf3-assistant sebelum login", `${assistantBeforeLogin.length} request`);

// 2. API tanpa token → 401
console.log("\n2. API auth gate");
const unauth = await page.evaluate(async () => {
  const r = await fetch("/api/nf3-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessId: "e23ed572-234c-4995-acad-fa6bff7c58d2",
      messages: [{ role: "user", content: "test" }],
    }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
});
if (unauth.status === 401) ok("POST tanpa token → 401");
else fail("POST tanpa token", `status ${unauth.status}`);

// 3. Login + UI checks
if (!password) {
  console.log("\n3. Login + chat UI");
  console.log("  SKIP — set NF3_TEST_PASSWORD untuk tes tombol ✦ & suggestion chips");
} else {
  console.log(`\n3. Login sebagai ${email}`);
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  const callsBeforeLogin = apiCalls.length;
  await page.getByRole("button", { name: /Masuk/i }).click();
  await page.waitForTimeout(12000);

  const afterLoginCalls = apiCalls.slice(callsBeforeLogin).filter((c) => c.url.includes("nf3-assistant"));
  if (afterLoginCalls.length === 0) ok("Tidak ada auto-call nf3-assistant setelah login/dashboard load");
  else fail("Auto-call nf3-assistant setelah login", `${afterLoginCalls.length} request`);

  const fab = page.locator('button[aria-label="Buka NF3 Assistant"]');
  if ((await fab.count()) > 0) ok("Tombol ✦ muncul");
  else fail("Tombol ✦ tidak ditemukan");

  await fab.click();
  await page.waitForTimeout(1500);
  const text = await page.evaluate(() => document.body.innerText);
  if (/Mau tanya apa/i.test(text)) ok("Greeting chat muncul");
  else fail("Greeting chat tidak muncul");

  const chips = await page.locator('button').filter({ hasText: /outlet|item|pengeluaran|transaksi/i }).count();
  if (chips >= 1) ok(`Suggestion chips muncul (${chips})`);
  else fail("Suggestion chips tidak muncul");

  const callsBeforeSend = apiCalls.length;
  if (chips >= 1) {
    await page.locator('button').filter({ hasText: /outlet|item|pengeluaran|transaksi/i }).first().click();
    await page.waitForTimeout(20000);
    const sendCalls = apiCalls.slice(callsBeforeSend).filter((c) => c.url.includes("nf3-assistant"));
    if (sendCalls.length >= 1) ok("API dipanggil setelah user tap chip");
    else fail("API tidak dipanggil setelah tap chip");

    const hasReply = await page.evaluate(() => {
      const t = document.body.innerText;
      return t.includes("Sedang cek data") === false && t.length > 200;
    });
    if (hasReply) ok("Ada respons assistant (atau loading selesai)");
    else fail("Respons assistant belum terlihat — cek ANTHROPIC_API_KEY");
  }
}

console.log(`\n=== Hasil: ${passed} lulus, ${failed} gagal ===\n`);
await browser.close();
process.exit(failed > 0 ? 1 : 0);
