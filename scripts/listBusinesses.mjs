#!/usr/bin/env node
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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: biz } = await sb.from("businesses").select("id, slug, name, type, created_at").order("created_at");
const { data: members } = await sb
  .from("business_members")
  .select("business_id, user_id, role, outlet, active, profiles(email)")
  .eq("active", true);
const { data: states } = await sb.from("app_state").select("business_id, data, updated_at");

for (const b of biz || []) {
  const mems = (members || []).filter((m) => m.business_id === b.id);
  const st = (states || []).find((s) => s.business_id === b.id);
  const txs = st?.data?.transactions?.length ?? 0;
  const wallets = st?.data?.wallets?.length ?? 0;
  console.log("\n---", b.name, `(${b.slug})`);
  console.log("  id:", b.id);
  console.log("  app_state:", st ? `${txs} txs, ${wallets} wallets` : "NONE");
  for (const m of mems) {
    console.log("  -", m.profiles?.email || m.user_id, m.role, m.outlet || "");
  }
}
