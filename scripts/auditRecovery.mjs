#!/usr/bin/env node
/**
 * Audit post-recovery NF3 — setara query #3, #11, #12 di recovery-check.sql
 *
 *   node scripts/auditRecovery.mjs
 *
 * Env: .env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const CANONICAL_ID =
  process.env.NEXT_PUBLIC_CANONICAL_BUSINESS_ID ||
  "e23ed572-234c-4995-acad-fa6bff7c58d2";

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function fmt(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib di .env.local");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("\n=== NF3 Recovery Audit ===\n");
console.log(`Canonical business_id: ${CANONICAL_ID}\n`);

// #11 — bisnis F&B
const { data: fnbBiz, error: fnbErr } = await sb
  .from("businesses")
  .select("id, slug, name, type, created_at")
  .eq("type", "fnb")
  .order("created_at");

if (fnbErr) {
  console.error("Gagal baca businesses:", fnbErr.message);
  process.exit(1);
}

const bizIds = (fnbBiz || []).map((b) => b.id);
const { data: states } = bizIds.length
  ? await sb.from("app_state").select("business_id, updated_at, data").in("business_id", bizIds)
  : { data: [] };

const stateByBiz = new Map((states || []).map((s) => [s.business_id, s]));

const { data: members } = bizIds.length
  ? await sb
      .from("business_members")
      .select("business_id, role, outlet, active, user_id")
      .in("business_id", bizIds)
  : { data: [] };

const memberCount = new Map();
for (const m of members || []) {
  if (!m.active) continue;
  memberCount.set(m.business_id, (memberCount.get(m.business_id) || 0) + 1);
}

console.log("--- #11 Bisnis F&B (duplikat?) ---");
if (!fnbBiz?.length) {
  console.log("(tidak ada bisnis type fnb)");
} else {
  for (const b of fnbBiz) {
    const st = stateByBiz.get(b.id);
    const tx = st?.data?.transactions?.length ?? 0;
    const canonical = b.id === CANONICAL_ID ? " ← CANONICAL" : " ⚠ DUPLIKAT?";
    console.log(
      `  ${b.slug} | ${b.name} | tx=${fmt(tx)} | anggota=${memberCount.get(b.id) || 0}${canonical}`
    );
    console.log(`    id=${b.id}`);
  }
}

// #12 — anggota per F&B
const userIds = [...new Set((members || []).map((m) => m.user_id).filter(Boolean))];
const { data: profiles } = userIds.length
  ? await sb.from("profiles").select("id, email").in("id", userIds)
  : { data: [] };
const emailById = new Map((profiles || []).map((p) => [p.id, p.email]));

console.log("\n--- #12 Anggota bisnis F&B ---");
const bizSlug = new Map((fnbBiz || []).map((b) => [b.id, b.slug]));
for (const b of fnbBiz || []) {
  const rows = (members || []).filter((m) => m.business_id === b.id && m.active);
  if (!rows.length) {
    console.log(`  ${b.slug}: (tidak ada anggota aktif)`);
    continue;
  }
  console.log(`  ${b.slug} (${b.id === CANONICAL_ID ? "canonical" : "non-canonical"}):`);
  for (const m of rows) {
    console.log(
      `    ${m.role.padEnd(12)} ${(m.outlet || "-").padEnd(6)} ${emailById.get(m.user_id) || m.user_id}`
    );
  }
}

// #3 — laporan omset 20–21 Jun
const { data: canonState, error: canonErr } = await sb
  .from("app_state")
  .select("updated_at, data")
  .eq("business_id", CANONICAL_ID)
  .maybeSingle();

if (canonErr) {
  console.error("\nGagal baca app_state canonical:", canonErr.message);
  process.exit(1);
}

const reports = (canonState?.data?.dailyReports || []).filter(
  (r) => r?.date >= "2026-06-20"
);
reports.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (a.outlet || "").localeCompare(b.outlet || ""));

console.log("\n--- #3 Laporan omset (>= 20 Jun 2026) ---");
console.log(`  app_state updated_at: ${canonState?.updated_at || "?"}`);
console.log(`  total transaksi: ${fmt(canonState?.data?.transactions?.length)}`);

if (!reports.length) {
  console.log("  ⚠ Belum ada laporan omset >= 20 Jun");
} else {
  for (const r of reports) {
    console.log(
      `  ${r.date} ${(r.outlet || "?").padEnd(4)} status=${(r.status || "?").padEnd(10)} total=Rp${fmt(r.total)}`
    );
  }
  const jun21 = reports.filter((r) => r.date === "2026-06-21");
  const outlets = new Set(jun21.map((r) => r.outlet));
  const expected = ["KBU", "KSM", "SMT"];
  const missing = expected.filter((o) => !outlets.has(o));
  if (missing.length) {
    console.log(`  ⚠ Outlet 21 Jun belum lengkap: ${missing.join(", ")}`);
  } else {
    console.log("  ✓ Tiga outlet 21 Jun (KBU, KSM, SMT) sudah ada");
  }
}

// #10 ringkas — duplikat ID transaksi
const txs = canonState?.data?.transactions || [];
const byId = new Map();
for (const t of txs) {
  if (!t?.id) continue;
  if (!byId.has(t.id)) byId.set(t.id, []);
  byId.get(t.id).push(t);
}
const dupes = [...byId.entries()].filter(([, arr]) => arr.length > 1);
console.log("\n--- #10 ID transaksi duplikat ---");
console.log(dupes.length ? `  ⚠ ${dupes.length} id duplikat (dedupe saat load)` : "  ✓ Tidak ada id duplikat");

console.log("\n=== Selesai ===\n");
