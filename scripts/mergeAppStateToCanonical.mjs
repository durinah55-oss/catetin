#!/usr/bin/env node
/**
 * Gabungkan app_state dari bisnis duplikat → Nusa Food (canonical).
 * Usage:
 *   node scripts/mergeAppStateToCanonical.mjs <sourceBusinessId>        # dry-run
 *   node scripts/mergeAppStateToCanonical.mjs <sourceBusinessId> --apply
 */
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

const CANONICAL =
  process.env.NEXT_PUBLIC_CANONICAL_BUSINESS_ID ||
  "e23ed572-234c-4995-acad-fa6bff7c58d2";
const sourceId = process.argv[2];
const apply = process.argv.includes("--apply");

if (!sourceId) {
  console.error("Usage: node scripts/mergeAppStateToCanonical.mjs <sourceBusinessId> [--apply]");
  process.exit(1);
}
if (sourceId === CANONICAL) {
  console.error("Source sama dengan canonical — tidak perlu merge.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const sb = createClient(url, key);

async function loadState(bizId) {
  const { data, error } = await sb
    .from("app_state")
    .select("data, updated_at")
    .eq("business_id", bizId)
    .maybeSingle();
  if (error) throw error;
  return data?.data || null;
}

const [srcDoc, tgtDoc] = await Promise.all([loadState(sourceId), loadState(CANONICAL)]);

if (!srcDoc) {
  console.log("Source tidak punya app_state — tidak ada yang digabung.");
  process.exit(0);
}

const srcTx = srcDoc.transactions || [];
const tgtTx = tgtDoc?.transactions || [];
const tgtIds = new Set(tgtTx.map((t) => t.id));
const newTx = srcTx.filter((t) => t.id && !tgtIds.has(t.id));

console.log("=== Merge app_state ===");
console.log("Source:", sourceId);
console.log("Target (Nusa Food):", CANONICAL);
console.log("Transaksi source:", srcTx.length);
console.log("Transaksi target:", tgtTx.length);
console.log("Transaksi baru (akan ditambah):", newTx.length);

if (!apply) {
  console.log("\nDry-run. Tambahkan --apply untuk simpan ke Nusa Food.");
  process.exit(0);
}

const merged = {
  ...(tgtDoc || srcDoc),
  transactions: [...tgtTx, ...newTx],
  wallets: tgtDoc?.wallets?.length ? tgtDoc.wallets : srcDoc.wallets,
  categories: tgtDoc?.categories?.length ? tgtDoc.categories : srcDoc.categories,
  profile: {
    ...(tgtDoc?.profile || {}),
    ...(srcDoc.profile || {}),
    name: "Nusa Food",
  },
};

const { error: saveErr } = await sb.from("app_state").upsert(
  { business_id: CANONICAL, data: merged, updated_at: new Date().toISOString() },
  { onConflict: "business_id" }
);

if (saveErr) {
  console.error(saveErr.message);
  process.exit(1);
}

console.log(`\n✅ ${newTx.length} transaksi digabung ke Nusa Food. Total sekarang: ${merged.transactions.length}`);
