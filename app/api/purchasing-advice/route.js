// app/api/purchasing-advice/route.js — Asisten Purchasing (read-only, konteks sempit)

import { fallbackPurchasingAdvice } from "../../../lib/purchasingAiContext.js";
import { enrichPurchasingContextWithAliases } from "../../../lib/purchasingItemAliases.js";
import { sbAdmin, sbUser } from "../../../lib/purchasingAliasesAuth.js";

async function loadApprovedAliases(admin, businessId) {
  const { data, error } = await admin
    .from("purchasing_item_aliases")
    .select("canonical_name, alias_name")
    .eq("business_id", businessId);
  if (error && !/does not exist/i.test(error.message || "")) throw error;
  return data || [];
}

const MODEL = "claude-sonnet-4-6";

async function requirePurchasingAccess(req, businessId) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return { error: Response.json({ error: "Sesi login tidak ditemukan." }, { status: 401 }) };
  }

  const userClient = sbUser(token);
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData?.user) {
    return { error: Response.json({ error: "Sesi tidak valid." }, { status: 401 }) };
  }

  if (!businessId) {
    return { error: Response.json({ error: "businessId wajib." }, { status: 400 }) };
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
  const role = member?.role;
  const allowed = role === "purchasing" || role === "owner" || role === "admin";
  if (!allowed) {
    return { error: Response.json({ error: "Hanya purchasing/owner/admin." }, { status: 403 }) };
  }

  return { user: authData.user, role };
}

async function callClaude(context, question, role) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 900,
      messages: [{
        role: "user",
        content: `Kamu asisten purchasing F&B warung/kafe Indonesia. Jawab HANYA berdasarkan data JSON di bawah. Jangan mengarang angka di luar data. Jika pertanyaan di luar scope purchasing atau data tidak cukup, katakan jujur.

Aturan:
- Bahasa Indonesia, singkat & praktis (max ~200 kata jawaban)
- Fokus kendala belanja: item, supplier, outlet, kategori, pola pengeluaran
- Jangan bahas omset kasir, SDM outlet, atau keuangan non-purchasing
- Role penanya: ${role}

Data purchasing (ringkas, ${context.period?.days || 30} hari):
${JSON.stringify(context, null, 0)}

Pertanyaan: ${question}

Balas HANYA JSON tanpa markdown:
{
  "answer": "<jawaban utuh>",
  "highlights": ["<poin penting 1>", "<poin 2>"],
  "actionHint": "<1 langkah praktis opsional, atau string kosong>"
}`,
      }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  const raw = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .replace(/```json|```/g, "")
    .trim();
  return JSON.parse(raw);
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
    const { businessId, question, context } = body;

    if (!question?.trim()) {
      return Response.json({ error: "Pertanyaan wajib diisi." }, { status: 400 });
    }
    if (!context?.scope || context.scope !== "purchasing_only") {
      return Response.json({ error: "Konteks purchasing tidak valid." }, { status: 400 });
    }

    const auth = await requirePurchasingAccess(req, businessId);
    if (auth.error) return auth.error;

    const q = question.trim();
    const admin = sbAdmin();
    const aliasRows = await loadApprovedAliases(admin, businessId);
    const enriched = enrichPurchasingContextWithAliases(context, aliasRows);

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(fallbackPurchasingAdvice(enriched, q));
    }

    const result = await callClaude(enriched, q, auth.role);
    return Response.json({ ...result, source: "ai", question: q });
  } catch (e) {
    console.error("Purchasing advice error:", e);
    if (body?.context) {
      const aliasRows = body.businessId
        ? await loadApprovedAliases(sbAdmin(), body.businessId).catch(() => [])
        : [];
      const enriched = enrichPurchasingContextWithAliases(body.context, aliasRows);
      return Response.json(fallbackPurchasingAdvice(enriched, body.question || ""));
    }
    return Response.json({ error: "Gagal memproses pertanyaan", detail: String(e) }, { status: 500 });
  }
}
