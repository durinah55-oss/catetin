#!/usr/bin/env node
/**
 * Recovery KBU laci setelah settle tanpa tx tunai — saldo harus floor 250rb.
 *   node scripts/fixKbuLaciAfterSettle.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIZ = "e23ed572-234c-4995-acad-fa6bff7c58d2";
const WALLET = "w_laci_kbu";
const REPORT_ID = "dr1782078708796";
const CASH_AMT = 4015000;
const FLOOR = 250000;
const CASH_ID = `t_${REPORT_ID}_cash`;
const TRF_ID = `t_${REPORT_ID}_settle_trf_cash`;

function loadEnvLocal() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

function resolveWalletId(t) {
  return t.walletId || t.wallet_id || null;
}

function walletBalance(walletId, wallets, transactions) {
  const w = wallets.find((x) => x.id === walletId);
  if (!w) return 0;
  const txs = transactions.filter((t) => {
    if (t.type === "transfer") {
      const from = t.fromWalletId || t.from_wallet_id;
      const to = t.toWalletId || t.to_wallet_id;
      return from === walletId || to === walletId;
    }
    return resolveWalletId(t) === walletId;
  });
  return (
    (w.opening || 0) +
    txs.reduce((a, t) => {
      if (t.type === "transfer") {
        const from = t.fromWalletId || t.from_wallet_id;
        const to = t.toWalletId || t.to_wallet_id;
        return a + (to === walletId ? t.amount : -t.amount);
      }
      return a + (t.type === "in" ? t.amount : -t.amount);
    }, 0)
  );
}

loadEnvLocal();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb.from("app_state").select("data").eq("business_id", BIZ).maybeSingle();
if (error) throw error;
const doc = data.data;
const rep = (doc.dailyReports || []).find((r) => r.id === REPORT_ID);
if (!rep) throw new Error("Laporan KBU 21 Jun tidak ditemukan");

const balBefore = walletBalance(WALLET, doc.wallets || [], doc.transactions || []);
console.log("Saldo laci KBU sebelum:", balBefore.toLocaleString("id-ID"));

const reportSettleTxs = (doc.transactions || []).filter(
  (t) => t.dailyReportId === REPORT_ID && /settle admin/i.test(t.source || "")
);
const laciTrfs = reportSettleTxs.filter(
  (t) => t.type === "transfer" && (t.fromWalletId || t.from_wallet_id) === WALLET
);
console.log("Settle tx laporan:", reportSettleTxs.length, "| transfer laci:", laciTrfs.length);

const removeIds = new Set();
for (const t of laciTrfs) {
  if (t.id !== TRF_ID) removeIds.add(t.id);
}
for (const t of reportSettleTxs) {
  if (t.type === "transfer") continue;
  if (resolveWalletId(t) === WALLET) removeIds.add(t.id);
  if (!t.id.startsWith(`t_${REPORT_ID}_settle_`)) removeIds.add(t.id);
}

doc.deletedTransactionIds = [...new Set([...(doc.deletedTransactionIds || []), ...removeIds])].slice(-1000);
doc.transactions = (doc.transactions || []).filter((t) => !removeIds.has(t.id));

const hasCash = doc.transactions.some((t) => t.id === CASH_ID);
if (!hasCash) {
  const cat = (doc.categories || []).find((c) => c.type === "in" && /tunai|penjualan/i.test(c.name || ""));
  doc.transactions.push({
    id: CASH_ID,
    type: "in",
    amount: CASH_AMT,
    categoryId: cat?.id || "ci_tunai",
    walletId: WALLET,
    desc: "Omset tunai KBU",
    date: rep.date || "2026-06-21",
    source: "Laporan harian",
    dailyReportId: REPORT_ID,
  });
  console.log("Tambah tx tunai:", CASH_ID);
}

const hasTrf = doc.transactions.some((t) => t.id === TRF_ID);
if (!hasTrf) {
  doc.transactions.push({
    id: TRF_ID,
    type: "transfer",
    amount: CASH_AMT,
    fromWalletId: WALLET,
    toWalletId: "w_kas_besar",
    desc: `Setoran tunai KBU · ${rep.date} → Kas Besar`,
    date: rep.date || "2026-06-21",
    source: "Settle Admin NF3",
    dailyReportId: REPORT_ID,
  });
  console.log("Tambah tx settle tunai:", TRF_ID);
} else {
  doc.transactions = doc.transactions.map((t) =>
    t.id === TRF_ID ? { ...t, amount: CASH_AMT, fromWalletId: WALLET, toWalletId: "w_kas_besar" } : t
  );
}

const idx = (doc.dailyReports || []).findIndex((r) => r.id === REPORT_ID);
if (idx >= 0) {
  doc.dailyReports[idx] = {
    ...rep,
    status: "settled",
    settlement: { toKasBesar: CASH_AMT, laciFloor: FLOOR, laciAfter: FLOOR },
  };
}

const balAfter = walletBalance(WALLET, doc.wallets || [], doc.transactions);
const now = new Date().toISOString();
const { error: upErr } = await sb.from("app_state").upsert({
  business_id: BIZ,
  data: doc,
  updated_at: now,
});
if (upErr) throw upErr;

console.log("OK — KBU laci diperbaiki");
console.log("  Hapus tx duplikat/salah:", removeIds.size);
console.log("  Saldo:", balBefore.toLocaleString("id-ID"), "→", balAfter.toLocaleString("id-ID"), balAfter === FLOOR ? "✓" : "⚠");
