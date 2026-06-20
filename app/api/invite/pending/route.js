// GET /api/invite/pending — cek undangan aktif untuk email user login

import { createClient } from "@supabase/supabase-js";

function sbAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server env belum lengkap");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function sbUser(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export async function GET(req) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return Response.json({ error: "Sesi login tidak ditemukan." }, { status: 401 });
    }

    const userClient = sbUser(token);
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user?.email) {
      return Response.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const email = authData.user.email.trim().toLowerCase();
    const admin = sbAdmin();

    const { data: invites, error: invErr } = await admin
      .from("invites")
      .select("id, role, outlet, email, business:businesses(name)")
      .eq("accepted", false)
      .gt("expires_at", new Date().toISOString());

    if (invErr) throw invErr;

    const pending = (invites || []).filter(
      (i) => i.email && i.email.trim().toLowerCase() === email
    );

    return Response.json({
      count: pending.length,
      invites: pending.map((i) => ({
        role: i.role,
        outlet: i.outlet,
        businessName: i.business?.name || null,
      })),
    });
  } catch (e) {
    console.error("[api/invite/pending]", e);
    return Response.json({ error: e.message || String(e) }, { status: 500 });
  }
}
