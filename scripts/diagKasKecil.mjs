#!/usr/bin/env node
/** Diagnosa saldo w_kas_kecil dari app_state Supabase */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const bizId = process.argv[2] || "e23ed572-234c-4995-acad-fa6bff7c58d2";

if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const sb = createClient(url, key);

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

const { data, error } = await sb
  .from("app_state")
  .select("data, updated_at")
  .eq("business_id", bizId)
  .maybeSingle();

if (error) {
  console.error(error.message);
  process.exit(1);
}

const doc = data?.data || {};
const wallets = doc.wallets || [];
const txs = doc.transactions || [];
const w = wallets.find((x) => x.id === "w_kas_kecil");

console.log("\n=== Kas Kecil Diagnostic ===");
console.log("Business:", bizId);
console.log("Cloud updated_at:", data?.updated_at);
console.log("Total transactions:", txs.length);

if (!w) {
  console.log("w_kas_kecil NOT FOUND in wallets");
  process.exit(0);
}

console.log("\nWallet w_kas_kecil:");
console.log("  name:", w.name);
console.log("  opening:", w.opening);
console.log("  floor:", w.floor);

const kasTxs = txs.filter((t) => resolveWalletId(t) === "w_kas_kecil");
const kasTxsStrict = txs.filter((t) => t.walletId === "w_kas_kecil");
const kasTxsSnake = txs.filter((t) => !t.walletId && t.wallet_id === "w_kas_kecil");
const nullWalletPurch = txs.filter(
  (t) => !resolveWalletId(t) && (t.module === "purchasing" || String(t.source || "").startsWith("purchasing"))
);

console.log("\nTransactions for w_kas_kecil:");
console.log("  with walletId (resolved):", kasTxs.length);
console.log("  walletId camelCase only:", kasTxsStrict.length);
console.log("  wallet_id snake only:", kasTxsSnake.length);

let sumOut = 0,
  sumIn = 0;
for (const t of kasTxs) {
  if (t.type === "in") sumIn += t.amount || 0;
  else if (t.type === "out") sumOut += t.amount || 0;
}

console.log("  sum in:", sumIn.toLocaleString("id-ID"));
console.log("  sum out:", sumOut.toLocaleString("id-ID"));
console.log("  net txs:", (sumIn - sumOut).toLocaleString("id-ID"));

const bal = walletBalance("w_kas_kecil", wallets, txs);
const balStrict = walletBalance("w_kas_kecil", wallets, txs.map((t) => ({ ...t, walletId: t.walletId })));

console.log("\nComputed balance (with wallet_id fallback):", bal.toLocaleString("id-ID"));
console.log("Computed balance (walletId only, no fallback):", balStrict.toLocaleString("id-ID"));
console.log("If opening only (no txs):", (w.opening || 0).toLocaleString("id-ID"));

console.log("\nPurchasing txs WITHOUT walletId:", nullWalletPurch.length);
if (nullWalletPurch.length) {
  const sumNull = nullWalletPurch.reduce((s, t) => s + (t.amount || 0), 0);
  console.log("  total nominal (not counted in any wallet):", sumNull.toLocaleString("id-ID"));
  console.log("  sample sources:", [...new Set(nullWalletPurch.slice(0, 5).map((t) => t.source))]);
}

const manualPurch = kasTxs.filter((t) => t.module === "purchasing" || String(t.source || "").startsWith("purchasing"));
console.log("\nPurchasing module txs ON w_kas_kecil:", manualPurch.length);
console.log("  sum out:", manualPurch.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0).toLocaleString("id-ID"));

const adjustTxs = kasTxs.filter((t) => String(t.source || "").includes("Sesuaikan") || /penyesuaian/i.test(t.desc || ""));
console.log("\nAdjustment txs on kas kecil:", adjustTxs.length);
for (const t of adjustTxs) {
  console.log(`  ${t.date} ${t.type} ${t.amount} — ${t.desc}`);
}
