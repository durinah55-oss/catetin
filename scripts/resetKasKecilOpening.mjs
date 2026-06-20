#!/usr/bin/env node
/** Reset opening w_kas_kecil ke 0 di app_state */
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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bizId = process.argv[2] || "e23ed572-234c-4995-acad-fa6bff7c58d2";

if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const sb = createClient(url, key);
const { data, error } = await sb
  .from("app_state")
  .select("data, updated_at")
  .eq("business_id", bizId)
  .maybeSingle();

if (error || !data?.data) {
  console.error(error?.message || "app_state not found");
  process.exit(1);
}

const doc = data.data;
const wallets = doc.wallets || [];
const idx = wallets.findIndex((w) => w.id === "w_kas_kecil");
if (idx < 0) {
  console.error("w_kas_kecil not found");
  process.exit(1);
}

const prev = wallets[idx].opening ?? 0;
wallets[idx] = { ...wallets[idx], opening: 0 };
doc.wallets = wallets;

const { error: saveErr } = await sb.from("app_state").upsert(
  { business_id: bizId, data: doc, updated_at: new Date().toISOString() },
  { onConflict: "business_id" }
);

if (saveErr) {
  console.error(saveErr.message);
  process.exit(1);
}

console.log(`✅ Kas Kecil opening: ${prev.toLocaleString("id-ID")} → 0`);
console.log("   Business:", bizId);
console.log("   Transaksi kas kecil di cloud:", (doc.transactions || []).filter((t) => (t.walletId || t.wallet_id) === "w_kas_kecil").length);
