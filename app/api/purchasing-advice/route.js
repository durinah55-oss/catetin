// app/api/purchasing-advice/route.js — Asisten Purchasing (read-only, konteks sempit)

import Anthropic from "@anthropic-ai/sdk";
import {
  compactPurchasingContextForAi,
  fallbackPurchasingAdvice,
  shouldAnswerLocally,
} from "../../../lib/purchasingAiContext.js";
import { enrichPurchasingContextWithAliases } from "../../../lib/purchasingItemAliases.js";
import { sbAdmin, sbUser } from "../../../lib/purchasingAliasesAuth.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

const STATIC_SYSTEM = `Kamu asisten purchasing F&B warung/kafe Indonesia.
Jawab HANYA dari data JSON di user message. Jangan mengarang angka.
Bahasa Indonesia, singkat (max ~150 kata).
Fokus: item, supplier, outlet, kategori, pola pengeluaran.
Jangan bahas omset kasir, SDM, atau keuangan non-purchasing.
Balas HANYA JSON tanpa markdown:
{"answer":"<jawaban>","highlights":["poin1"],"actionHint":"<opsional atau kosong>"}`;

async function loadApprovedAliases(admin, businessId) {
  const { data, error } = await admin
    .from("purchasing_item_aliases")
    .select("canonical_name, alias_name")
    .eq("business_id", businessId);
  if (error && !/does not exist/i.test(error.message || "")) throw error;
  return data || [];
}

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

async function callClaude(compactContext, question, role) {
  const userContent = `Role penanya: ${role}
Data purchasing (${compactContext.period?.days || 30} hari):
${JSON.stringify(compactContext)}

Pertanyaan: ${question}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: [{ type: "text", text: STATIC_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }],
  });

  const raw = (response.content || [])
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

    if (shouldAnswerLocally(enriched, q)) {
      return Response.json({ ...fallbackPurchasingAdvice(enriched, q), question: q });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(fallbackPurchasingAdvice(enriched, q));
    }

    const compact = compactPurchasingContextForAi(enriched, q);
    const result = await callClaude(compact, q, auth.role);
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
