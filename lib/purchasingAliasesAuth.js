import { createClient } from "@supabase/supabase-js";

export function sbAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server env belum lengkap");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function sbUser(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export function bearerToken(req) {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

export async function requireOwnerAdmin(req, businessId) {
  const token = bearerToken(req);
  if (!token) {
    return { error: Response.json({ error: "Sesi login tidak ditemukan." }, { status: 401 }) };
  }
  if (!businessId) {
    return { error: Response.json({ error: "businessId wajib." }, { status: 400 }) };
  }

  const userClient = sbUser(token);
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData?.user) {
    return { error: Response.json({ error: "Sesi tidak valid." }, { status: 401 }) };
  }

  const admin = sbAdmin();
  const { data: member, error: memErr } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", authData.user.id)
    .eq("active", true)
    .maybeSingle();

  if (memErr) throw memErr;
  if (!member || !["owner", "admin"].includes(member.role)) {
    return { error: Response.json({ error: "Hanya owner/admin yang boleh akses." }, { status: 403 }) };
  }

  return { user: authData.user, admin, role: member.role };
}
