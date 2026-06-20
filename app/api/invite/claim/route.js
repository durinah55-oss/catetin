// POST /api/invite/claim — klaim undangan pending by email user login (staf tanpa ?invite=)

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

export async function POST(req) {
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
    const uid = authData.user.id;
    const admin = sbAdmin();

    const { data: invites, error: invErr } = await admin
      .from("invites")
      .select("id, business_id, role, outlet, email")
      .eq("accepted", false)
      .gt("expires_at", new Date().toISOString());

    if (invErr) throw invErr;

    const mine = (invites || []).filter(
      (i) => i.email && i.email.trim().toLowerCase() === email
    );

    const members = [];
    for (const inv of mine) {
      const { data: member, error: memErr } = await admin
        .from("business_members")
        .upsert(
          {
            business_id: inv.business_id,
            user_id: uid,
            role: inv.role,
            outlet: inv.outlet,
            active: true,
          },
          { onConflict: "business_id,user_id" }
        )
        .select("id, business_id, role, outlet, active, user_id")
        .single();

      if (memErr) throw memErr;
      members.push(member);

      await admin.from("invites").update({ accepted: true }).eq("id", inv.id);
    }

    return Response.json({ ok: true, members, claimed: members.length });
  } catch (e) {
    console.error("[api/invite/claim]", e);
    return Response.json({ error: e.message || String(e) }, { status: 500 });
  }
}
