#!/usr/bin/env node
/** Tandai laporan submitted → settled jika transaksi settle sudah ada di app_state. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { reconcileDailyReports } from "../lib/kasirHarian.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}

const bizId = process.argv[2] || "e23ed572-234c-4995-acad-fa6bff7c58d2";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await sb
  .from("app_state")
  .select("data")
  .eq("business_id", bizId)
  .maybeSingle();

if (error || !data?.data) {
  console.error(error?.message || "app_state not found");
  process.exit(1);
}

const doc = data.data;
const before = doc.dailyReports || [];
const after = reconcileDailyReports(before, doc.transactions || []);
const fixed = after.filter((r, i) => r.status !== before[i]?.status);

console.log("Laporan diperbaiki:", fixed.length);
for (const r of fixed) {
  console.log(" -", r.outlet, r.date, "→ settled");
}

if (!fixed.length) {
  console.log("Tidak ada yang perlu diperbaiki.");
  process.exit(0);
}

doc.dailyReports = after;
const { error: saveErr } = await sb.from("app_state").upsert(
  { business_id: bizId, data: doc, updated_at: new Date().toISOString() },
  { onConflict: "business_id" }
);

if (saveErr) {
  console.error(saveErr.message);
  process.exit(1);
}

console.log("✅ Disimpan ke Supabase.");
