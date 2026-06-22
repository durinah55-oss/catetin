#!/usr/bin/env node
/** Diagnosa Laci KBU — saldo, duplikat tx laporan, status revisi 21 Jun */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIZ = "e23ed572-234c-4995-acad-fa6bff7c58d2";
const WALLET = "w_laci_kbu";
const REPORT_ID = "dr1782078708796";

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
        const to = t.toWalletId || t.to_wallet_id;
        return a + (to === walletId ? t.amount : -t.amount);
      }
      return a + (t.type === "in" ? t.amount : -t.amount);
    }, 0)
  );
}

loadEnvLocal();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb.from("app_state").select("data, updated_at").eq("business_id", BIZ).maybeSingle();
if (error) throw error;

const doc = data.data || {};
const wallets = doc.wallets || [];
const txs = doc.transactions || [];
const reports = doc.dailyReports || [];
const msgs = doc.staffMessages || [];

const w = wallets.find((x) => x.id === WALLET);
const bal = walletBalance(WALLET, wallets, txs);

console.log("\n=== KBU Laci Diagnostic ===");
console.log("Cloud updated_at:", data.updated_at);
console.log("Laci KBU opening/floor:", w?.opening, w?.floor);
console.log("Computed balance:", bal.toLocaleString("id-ID"));

const kbuTxs = txs.filter((t) => resolveWalletId(t) === WALLET || t.fromWalletId === WALLET || t.toWalletId === WALLET);
console.log("Total txs touching laci KBU:", kbuTxs.length);

const laporanTxs = txs.filter(
  (t) => t.source === "Laporan harian" && (t.dailyReportId === REPORT_ID || String(t.desc || "").includes("KBU"))
);
console.log("\nTx 'Laporan harian' for KBU report", REPORT_ID + ":", laporanTxs.length);
for (const t of laporanTxs.slice(0, 5)) {
  console.log(" ", t.id, t.date, t.amount, t.dailyReportId);
}
if (laporanTxs.length > 5) console.log(" ... +", laporanTxs.length - 5, "more");

const dupByReport = new Map();
for (const t of txs.filter((t) => t.source === "Laporan harian" && resolveWalletId(t) === WALLET)) {
  const k = t.dailyReportId || t.date || "?";
  dupByReport.set(k, (dupByReport.get(k) || 0) + 1);
}
console.log("\nLaporan harian tx counts per reportId on laci KBU:");
for (const [k, n] of dupByReport) console.log(" ", k, "→", n, n > 1 ? "⚠ DUPLIKAT" : "");

const rep = reports.find((r) => r.id === REPORT_ID);
console.log("\nReport KBU 21 Jun:", rep ? { status: rep.status, total: rep.total, resubmittedAt: rep.resubmittedAt, revisionNote: rep.revisionNote } : "NOT FOUND");

const revMsgs = msgs.filter((m) => m.kind === "revision_request" && m.meta?.outlet === "KBU");
const subMsgs = msgs.filter((m) => m.kind === "daily_report_submitted" && m.meta?.outlet === "KBU");
console.log("\nStaff messages KBU:");
console.log("  revision_request:", revMsgs.length);
console.log("  daily_report_submitted:", subMsgs.length);
if (subMsgs.length > 3) {
  console.log("  ⚠ Terlalu banyak notif submitted — kemungkinan tap ganda");
  console.log("  sample dedupeKeys:", subMsgs.slice(0, 3).map((m) => m.meta?.dedupeKey));
}
