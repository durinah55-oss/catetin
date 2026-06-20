#!/usr/bin/env node
/** Pastikan kasir KBU/KSM/SMT di Nusa Food punya role & outlet benar di DB. */
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

const FIXES = [
  { email: "kopiburiumah@gmail.com", role: "kasir", outlet: "KBU" },
  { email: "ramenkisamen@gmail.com", role: "kasir", outlet: "KSM" },
  { email: "samtarospace@gmail.com", role: "kasir", outlet: "SMT" },
];

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

for (const f of FIXES) {
  const { data: prof } = await sb
    .from("profiles")
    .select("id")
    .ilike("email", f.email)
    .maybeSingle();
  if (!prof) {
    console.log("SKIP — profil tidak ada:", f.email);
    continue;
  }

  const { error } = await sb
    .from("business_members")
    .upsert(
      {
        business_id: CANONICAL,
        user_id: prof.id,
        role: f.role,
        outlet: f.outlet,
        active: true,
      },
      { onConflict: "business_id,user_id" }
    );

  if (error) {
    console.error("FAIL", f.email, error.message);
  } else {
    console.log("OK", f.email, "→", f.role, f.outlet || "");
  }
}

console.log("\nSelesai. Kasir logout/login ulang.");
