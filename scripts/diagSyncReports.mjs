#!/usr/bin/env node
/** Audit sync laporan omset — semua outlet, duplikat settle, ghost reports */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { reportHasSettleTxs } from "../lib/kasirHarian.js";
import { pendingReports, reportsAwaitingVerify, reportsReadyToSettle } from "../lib/kasirHarian.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIZ = "e23ed572-234c-4995-acad-fa6bff7c58d2";

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

loadEnvLocal();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb.from("app_state").select("data, updated_at").eq("business_id", BIZ).maybeSingle();
if (error) throw error;

const doc = data.data || {};
const reports = doc.dailyReports || [];
const txs = doc.transactions || [];

console.log("\n=== Sync Audit Laporan Omset ===");
console.log("Cloud updated_at:", data.updated_at);
console.log("Total laporan:", reports.length);
console.log("Deleted report ids:", (doc.deletedDailyReportIds || []).length);
console.log("Deleted slots:", (doc.deletedDailyReportSlots || []).length);

const byDate = new Map();
for (const r of reports) {
  const k = r.date || "?";
  if (!byDate.has(k)) byDate.set(k, []);
  byDate.get(k).push(r);
}

console.log("\n--- Per tanggal (terbaru dulu) ---");
for (const date of [...byDate.keys()].sort().reverse().slice(0, 7)) {
  console.log(`\n${date}:`);
  for (const r of byDate.get(date)) {
    const settleTxs = txs.filter(
      (t) => t.dailyReportId === r.id && /settle admin/i.test(t.source || "")
    );
    const cashTxs = txs.filter(
      (t) => t.dailyReportId === r.id && /laporan harian/i.test(t.source || "")
    );
    const ghost = r.status !== "settled" && reportHasSettleTxs(r.id, txs);
    console.log(
      `  ${r.outlet} ${r.id.slice(-8)} status=${r.status} total=${r.total}`,
      `cashTx=${cashTxs.length} settleTx=${settleTxs.length}`,
      ghost ? "⚠ GHOST (ada settle tx tapi belum settled)" : "",
      settleTxs.length > 2 ? "⚠ DUPLIKAT SETTLE" : ""
    );
  }
}

const dupSettle = new Map();
for (const t of txs.filter((t) => /settle admin/i.test(t.source || ""))) {
  const k = `${t.dailyReportId}|${t.type}|${t.desc || ""}`;
  dupSettle.set(k, (dupSettle.get(k) || 0) + 1);
}
const dupSettleList = [...dupSettle.entries()].filter(([, n]) => n > 1);
if (dupSettleList.length) {
  console.log("\n⚠ Duplikat transaksi settle:");
  for (const [k, n] of dupSettleList) console.log(" ", k, "→", n);
} else {
  console.log("\n✓ Tidak ada duplikat settle tx (desc+report sama)");
}

const pending = pendingReports(reports, txs);
const verify = reportsAwaitingVerify(reports, txs);
const ready = reportsReadyToSettle(reports, txs);
console.log("\n--- Owner/admin lihat ---");
console.log("Menunggu verifikasi:", verify.map((r) => `${r.outlet} ${r.date}`).join(", ") || "(kosong)");
console.log("Siap settle:", ready.map((r) => `${r.outlet} ${r.date}`).join(", ") || "(kosong)");
console.log("Pending total (filter ghost):", pending.length);

const hidden = reports.filter(
  (r) => (r.status === "submitted" || r.status === "admin_verified") && !pending.some((p) => p.id === r.id)
);
if (hidden.length) {
  console.log("\n⚠ Laporan submitted/admin_verified TIDAK muncul di pending:");
  for (const r of hidden) {
    console.log(`  ${r.outlet} ${r.date} ${r.status} settleTx=${reportHasSettleTxs(r.id, txs)}`);
  }
}
