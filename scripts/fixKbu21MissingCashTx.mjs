#!/usr/bin/env node
/** Tambah tx omset tunai KBU 21 Jun yang hilang setelah cleanup duplikat (tanpa ubah status laporan). */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIZ = "e23ed572-234c-4995-acad-fa6bff7c58d2";
const REPORT_ID = "dr1782078708796";
const WALLET = "w_laci_kbu";
const CASH_AMT = 4015000;

function loadEnvLocal() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function walletBalance(walletId, wallets, transactions) {
  const w = wallets.find((x) => x.id === walletId);
  if (!w) return 0;
  return (
    (w.opening || 0) +
    transactions
      .filter((t) => (t.walletId || t.wallet_id) === walletId)
      .reduce((a, t) => a + (t.type === "in" ? t.amount : t.type === "out" ? -t.amount : 0), 0)
  );
}

loadEnvLocal();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb.from("app_state").select("data").eq("business_id", BIZ).maybeSingle();
if (error) throw error;
if (!data?.data) throw new Error("app_state tidak ditemukan");

const doc = data.data;
const rep = (doc.dailyReports || []).find((r) => r.id === REPORT_ID);
if (!rep) throw new Error(`Laporan ${REPORT_ID} tidak ditemukan`);
if (rep.status === "settled") throw new Error("Laporan sudah settled — tidak perlu tambah tx tunai.");

const keepId = `t_${REPORT_ID}_cash`;
const balBefore = walletBalance(WALLET, doc.wallets || [], doc.transactions || []);

if ((doc.transactions || []).some((t) => t.id === keepId)) {
  console.log("Tx", keepId, "sudah ada — tidak ada perubahan.");
  process.exit(0);
}

const dup21 = (doc.transactions || []).filter(
  (t) =>
    t.date === rep.date
    && t.walletId === WALLET
    && /laporan harian/i.test(t.source || "")
    && String(t.desc || "").includes("Omset tunai KBU")
);
if (dup21.length) {
  console.log("Sudah ada tx laporan 21 Jun KBU:", dup21.map((t) => t.id));
  process.exit(0);
}

const cat = (doc.categories || []).find((c) => c.type === "in" && /tunai|penjualan/i.test(c.name || ""));
doc.transactions = doc.transactions || [];
doc.transactions.push({
  id: keepId,
  type: "in",
  amount: CASH_AMT,
  categoryId: cat?.id || "ci_tunai",
  walletId: WALLET,
  desc: "Omset tunai KBU",
  date: rep.date || "2026-06-21",
  source: "Laporan harian",
  dailyReportId: REPORT_ID,
});

const balAfter = walletBalance(WALLET, doc.wallets || [], doc.transactions);
const now = new Date().toISOString();

const { error: upErr } = await sb.from("app_state").upsert({
  business_id: BIZ,
  data: doc,
  updated_at: now,
});
if (upErr) throw upErr;

console.log("OK — tx tunai KBU 21 Jun ditambahkan");
console.log("  id:", keepId, "amount:", CASH_AMT.toLocaleString("id-ID"));
console.log("  Saldo laci:", balBefore.toLocaleString("id-ID"), "→", balAfter.toLocaleString("id-ID"));
console.log("  Status laporan tetap:", rep.status);
