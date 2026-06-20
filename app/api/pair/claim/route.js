// POST /api/pair/claim — PC tukar kode yang sudah di-approve jadi sesi Supabase.

import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin.js";

export async function POST(req) {
  try {
    const sbAdmin = getSupabaseAdmin();
    const { code } = await req.json();
    const pairCode = String(code || "").trim().toUpperCase();
    if (!pairCode) return Response.json({ error: "Kode wajib diisi" }, { status: 400 });

    const { data: ws, error: wsErr } = await sbAdmin
      .from("web_sessions")
      .select("id, user_id, business_id, approved, expires_at")
      .eq("pair_code", pairCode)
      .single();

    if (wsErr || !ws) return Response.json({ error: "Kode tidak ditemukan" }, { status: 404 });
    if (!ws.approved) return Response.json({ error: "Kode belum di-approve dari PC" }, { status: 400 });
    if (new Date(ws.expires_at) < new Date()) {
      return Response.json({ error: "Kode sudah kadaluarsa" }, { status: 410 });
    }

    const { data: userRes, error: userErr } = await sbAdmin.auth.admin.getUserById(ws.user_id);
    if (userErr || !userRes?.user?.email) {
      return Response.json({ error: "Akun HP tidak ditemukan" }, { status: 404 });
    }

    const email = userRes.user.email;

    const { data: linkData, error: linkErr } = await sbAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr) throw linkErr;

    const tokenHash = linkData?.properties?.hashed_token;
    if (!tokenHash) throw new Error("Gagal generate token sesi");

    const { data: sessionData, error: verifyErr } = await sbAdmin.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    if (verifyErr) throw verifyErr;

    const session = sessionData?.session;
    if (!session?.access_token) throw new Error("Sesi tidak valid");

    await sbAdmin.from("web_sessions").delete().eq("id", ws.id);

    return Response.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      businessId: ws.business_id,
    });
  } catch (e) {
    console.error("[pair/claim]", e);
    return Response.json({ error: e.message || String(e) }, { status: 500 });
  }
}
