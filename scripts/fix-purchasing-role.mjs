import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    })
);

const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error("SUPABASE_SERVICE_ROLE_KEY tidak ada di .env.local");
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "nf3.crb@gmail.com";
const BIZ = "41ad9f91-4d89-4a69-9ccf-987f5a0b8550";

const { data: prof } = await sb.from("profiles").select("id").eq("email", EMAIL).maybeSingle();
if (!prof) {
  console.error("Profil tidak ditemukan:", EMAIL);
  process.exit(1);
}

const { error } = await sb
  .from("business_members")
  .update({ role: "purchasing", outlet: null, active: true })
  .eq("business_id", BIZ)
  .eq("user_id", prof.id);

if (error) {
  console.error("Gagal update:", error.message);
  process.exit(1);
}

await sb.from("profiles").update({ name: "Purchasing NF3" }).eq("id", prof.id);

const { data: check } = await sb
  .from("business_members")
  .select("role,outlet,active")
  .eq("business_id", BIZ)
  .eq("user_id", prof.id)
  .single();

console.log("OK — nf3.crb@gmail.com sekarang:", check);
