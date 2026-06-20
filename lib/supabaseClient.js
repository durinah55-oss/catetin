// lib/supabaseClient.js
// Klien Supabase untuk dipakai di browser (client components).
// Memakai publishable/anon key — aman di browser, dilindungi RLS.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "[NF3] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi di .env.local"
  );
}

// Lock no-op: hindari deadlock navigator.locks yang bikin getSession()
// & query menggantung selamanya di sebagian browser/dev (HMR multi-mount).
const noopLock = async (_name, _acquireTimeout, fn) => fn();

export const supabase = createClient(url || "", anonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // login pakai password, bukan redirect/magic-link
    lock: noopLock,
  },
});
