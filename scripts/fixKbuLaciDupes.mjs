#!/usr/bin/env node
/**
 * Recovery KBU 21 Jun — hapus 39 duplikat tx laci + normalisasi laporan revisi.
 *   node scripts/fixKbuLaciDupes.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  createDailyReportSubmittedMessage,
  resolveRevisionMessages,
  prependStaffMessage,
} from "../lib/staffMessages.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
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
const reports = doc.dailyReports || [];
const idx = reports.findIndex((r) => r.id === REPORT_ID);
if (idx < 0) throw new Error(`Laporan ${REPORT_ID} tidak ditemukan`);

const rep = reports[idx];
const now = new Date().toISOString();

const laporanTxs = (doc.transactions || []).filter(
  (t) => t.dailyReportId === REPORT_ID && t.source === "Laporan harian"
);
const keepId = `t_${REPORT_ID}_cash`;
const otherIds = new Set(laporanTxs.map((t) => t.id));
otherIds.delete(keepId);

doc.transactions = (doc.transactions || []).filter((t) => !otherIds.has(t.id));

const hasKeep = doc.transactions.some((t) => t.id === keepId);
if (!hasKeep) {
  const cat = (doc.categories || []).find((c) => c.type === "in" && /tunai|penjualan/i.test(c.name || ""));
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
} else {
  doc.transactions = doc.transactions.map((t) =>
    t.id === keepId ? { ...t, amount: CASH_AMT, walletId: WALLET } : t
  );
}

reports[idx] = {
  ...rep,
  status: "submitted",
  cash: CASH_AMT,
  setoranOwner: CASH_AMT,
  revisionNote: null,
  revisionRequestedAt: null,
  revisionRequestedBy: null,
  revisionRequestedByRole: null,
  resubmittedAt: rep.resubmittedAt || now,
  adminVerifiedAt: null,
  adminVerifiedBy: null,
  adminVerifyNote: null,
};
doc.dailyReports = reports;

doc.staffMessages = resolveRevisionMessages(
  doc.staffMessages || [],
  REPORT_ID,
  rep.kasirId || "recovery",
  rep.date,
  now
);

const nmsg = createDailyReportSubmittedMessage({
  report: reports[idx],
  author: { name: rep.kasirName || "Kasir KBU", role: "kasir" },
  resubmit: true,
});
doc.staffMessages = prependStaffMessage(doc.staffMessages, nmsg, doc.notificationPrefs);

const balBefore = walletBalance(WALLET, doc.wallets || [], data.data.transactions || []);
const balAfter = walletBalance(WALLET, doc.wallets || [], doc.transactions);

const { error: upErr } = await sb.from("app_state").upsert({
  business_id: BIZ,
  data: doc,
  updated_at: now,
});
if (upErr) throw upErr;

console.log("OK — KBU laci & laporan 21 Jun diperbaiki");
console.log("  Hapus tx duplikat:", otherIds.size);
console.log("  Tx tersisa laporan:", doc.transactions.filter((t) => t.dailyReportId === REPORT_ID).length);
console.log("  Saldo laci KBU:", balBefore.toLocaleString("id-ID"), "→", balAfter.toLocaleString("id-ID"));
console.log("  Status laporan:", reports[idx].status, "total:", reports[idx].total);
console.log("  Notif owner/admin: daily_report_submitted ditambahkan");
