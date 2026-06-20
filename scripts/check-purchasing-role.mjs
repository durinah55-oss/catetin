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

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: prof } = await sb
  .from("profiles")
  .select("id,email,name")
  .eq("email", "nf3.crb@gmail.com")
  .maybeSingle();

if (!prof) {
  console.log("NO_PROFILE nf3.crb@gmail.com");
  process.exit(1);
}

const { data: mem } = await sb
  .from("business_members")
  .select("role,outlet,active,business_id")
  .eq("user_id", prof.id);

console.log(JSON.stringify({ email: prof.email, name: prof.name, members: mem }, null, 2));
