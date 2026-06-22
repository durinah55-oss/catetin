#!/usr/bin/env node
/** Hapus tx Settle Admin duplikat — simpan satu per report+jenis (recovery). */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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

function settleKey(t) {
  const ch = t.reportChannelId || (t.type === "transfer" ? "trf" : "in");
  return `${t.dailyReportId}|${t.type}|${ch}|${t.toWalletId || t.walletId || ""}`;
}

loadEnvLocal();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb.from("app_state").select("data").eq("business_id", BIZ).maybeSingle();
if (error) throw error;
const doc = data.data;
const txs = doc.transactions || [];

const groups = new Map();
for (const t of txs) {
  if (!/settle admin/i.test(t.source || "") || !t.dailyReportId) continue;
  const k = settleKey(t);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(t);
}

const removeIds = new Set();
for (const [, list] of groups) {
  if (list.length <= 1) continue;
  list.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
  for (const t of list.slice(1)) removeIds.add(t.id);
}

if (!removeIds.size) {
  console.log("OK — tidak ada duplikat settle tx");
  process.exit(0);
}

doc.deletedTransactionIds = [...new Set([...(doc.deletedTransactionIds || []), ...removeIds])].slice(-1000);
doc.transactions = txs.filter((t) => !removeIds.has(t.id));

const now = new Date().toISOString();
const { error: upErr } = await sb.from("app_state").upsert({
  business_id: BIZ,
  data: doc,
  updated_at: now,
});
if (upErr) throw upErr;

console.log("OK — hapus", removeIds.size, "tx settle duplikat");
console.log("  ids:", [...removeIds].slice(0, 8).join(", "), removeIds.size > 8 ? "..." : "");
