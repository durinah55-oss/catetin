#!/usr/bin/env node
/**
 * Paksa status revisi KBU 21 Jun + notif ke kasir (recovery sekali jalan).
 *   node scripts/fixKbuRevision21.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRevisionRequestMessage } from "../lib/staffMessages.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const BIZ = "e23ed572-234c-4995-acad-fa6bff7c58d2";
const REPORT_ID = "dr1782078708796";
const NOTE = "ulang";

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

loadEnvLocal();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb.from("app_state").select("data").eq("business_id", BIZ).maybeSingle();
if (error) throw error;
if (!data?.data) throw new Error("app_state tidak ditemukan");

const doc = data.data;
const reports = doc.dailyReports || [];
const idx = reports.findIndex((r) => r.id === REPORT_ID);
if (idx < 0) throw new Error(`Laporan ${REPORT_ID} tidak ditemukan`);

const prev = reports[idx];
if (prev.status === "settled") throw new Error("Laporan sudah settled — hubungi owner");

const now = new Date().toISOString();
reports[idx] = {
  ...prev,
  status: "revision_requested",
  revisionNote: NOTE,
  revisionRequestedAt: now,
  revisionRequestedByRole: "admin",
  adminVerifiedAt: null,
  adminVerifiedBy: null,
  adminVerifyNote: null,
};

const msg = createRevisionRequestMessage({
  report: reports[idx],
  note: NOTE,
  author: { id: "recovery", name: "Admin Keuangan", role: "admin" },
});
doc.dailyReports = reports;
doc.staffMessages = [msg, ...(doc.staffMessages || [])];

const { error: upErr } = await sb.from("app_state").upsert({
  business_id: BIZ,
  data: doc,
  updated_at: now,
});
if (upErr) throw upErr;

console.log("OK — KBU 21 Jun → revision_requested + notif kasir");
console.log("  outlet:", prev.outlet, "date:", prev.date, "total:", prev.total);
