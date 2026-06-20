// app/api/pair/route.js — Web pairing HP ↔ PC

import { getSupabaseAdmin } from "../../../lib/supabaseAdmin.js";

export async function POST(req) {
  try {
    const sb = getSupabaseAdmin();
    const { userId, businessId } = await req.json();
    const code = "WARUNG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data, error } = await sb.from("web_sessions").insert({
      user_id: userId, business_id: businessId, pair_code: code,
    }).select().single();
    if (error) throw error;
    return Response.json({ code, sessionId: data.id });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const sb = getSupabaseAdmin();
    const code = new URL(req.url).searchParams.get("code")?.trim().toUpperCase();
    if (!code) return Response.json({ error: "code required" }, { status: 400 });

    const { data } = await sb.from("web_sessions")
      .select("id, user_id, business_id, approved, expires_at")
      .eq("pair_code", code).single();

    if (!data) return Response.json({ error: "Kode tidak ditemukan" }, { status: 404 });
    if (new Date(data.expires_at) < new Date())
      return Response.json({ error: "Kode sudah kadaluarsa" }, { status: 410 });

    await sb.from("web_sessions").update({ approved: true }).eq("id", data.id);
    return Response.json({ ok: true, userId: data.user_id, businessId: data.business_id });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const sb = getSupabaseAdmin();
    const { code } = await req.json();
    const pairCode = String(code || "").trim().toUpperCase();
    const { data } = await sb.from("web_sessions")
      .select("approved").eq("pair_code", pairCode)
      .gt("expires_at", new Date().toISOString()).single();
    return Response.json({ approved: data?.approved ?? false });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
