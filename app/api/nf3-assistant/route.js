// app/api/nf3-assistant/route.js — NF3 Assistant chat + prompt caching

import Anthropic from "@anthropic-ai/sdk";
import { bearerToken, sbAdmin, sbUser } from "../../../lib/purchasingAliasesAuth.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function requireAssistantMember(req, businessId) {
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
    .select("role, outlet")
    .eq("business_id", businessId)
    .eq("user_id", authData.user.id)
    .eq("active", true)
    .maybeSingle();

  if (memErr) throw memErr;
  if (!member?.role) {
    return { error: Response.json({ error: "Bukan anggota bisnis ini." }, { status: 403 }) };
  }

  return { user: authData.user, member, admin };
}

function mapAssistantRole(role) {
  if (role === "admin") return "keuangan";
  return role;
}

function assistantOutlet(member) {
  if (member.role === "kasir" && member.outlet) return member.outlet;
  return "semua";
}

async function fetchTransactions(admin, businessId, assistantRole, outlet) {
  const { data, error } = await admin
    .from("app_state")
    .select("data")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    console.error("NF3 Assistant app_state error:", error.message);
    return { txs: [], dataLoadError: true };
  }

  let txs = data?.data?.transactions || [];

  if (assistantRole === "kasir" && outlet && outlet !== "semua") {
    txs = txs.filter((t) => (t.outlet || "").toUpperCase() === outlet.toUpperCase());
  } else if (assistantRole === "purchasing") {
    txs = txs.filter((t) => t.module === "purchasing");
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  txs = txs.filter((t) => t.date && new Date(t.date) >= cutoff);
  txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { txs, dataLoadError: false };
}

function buildDataContext(txs, assistantRole) {
  if (!txs.length) {
    return "Data transaksi: belum ada data dalam 90 hari terakhir.";
  }

  const byOutlet = {};
  const byMonth = {};
  const bySupplier = {};
  const byItem = {};

  for (const t of txs) {
    const o = t.outlet ?? "UNKNOWN";
    if (!byOutlet[o]) byOutlet[o] = { in: 0, out: 0, count: 0 };
    if (t.type === "in") byOutlet[o].in += t.amount || 0;
    else byOutlet[o].out += t.amount || 0;
    byOutlet[o].count++;

    const month = (t.date || "").slice(0, 7);
    if (month) {
      byMonth[month] = (byMonth[month] ?? 0) + (t.type === "out" ? (t.amount || 0) : 0);
    }

    if (t.supplier) {
      bySupplier[t.supplier] = (bySupplier[t.supplier] ?? 0) + (t.amount || 0);
    }
    if (t.desc) {
      byItem[t.desc] = (byItem[t.desc] ?? 0) + (t.amount || 0);
    }
  }

  const fmt = (n) => `Rp${Number(n).toLocaleString("id-ID")}`;

  const outletSummary = Object.entries(byOutlet)
    .map(([o, v]) => `  ${o}: pemasukan ${fmt(v.in)} | pengeluaran ${fmt(v.out)} | ${v.count} transaksi`)
    .join("\n");

  const monthSummary = Object.entries(byMonth)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 3)
    .map(([m, v]) => `  ${m}: ${fmt(v)}`)
    .join("\n");

  const topItems = Object.entries(byItem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([item, v]) => `  ${item}: ${fmt(v)}`)
    .join("\n");

  const topSuppliers =
    assistantRole !== "kasir"
      ? Object.entries(bySupplier)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([s, v]) => `  ${s}: ${fmt(v)}`)
          .join("\n")
      : "";

  const recent = txs
    .slice(0, 10)
    .map(
      (t) =>
        `  [${t.date}] ${t.outlet} | ${t.type === "out" ? "keluar" : "masuk"} ${fmt(t.amount)} | ${t.desc || "-"}${t.supplier ? ` (${t.supplier})` : ""}`
    )
    .join("\n");

  return `
=== DATA TRANSAKSI NF (90 hari terakhir, total ${txs.length} transaksi) ===

Per outlet:
${outletSummary}

Pengeluaran per bulan (3 bulan terakhir):
${monthSummary}

10 item terbanyak dibeli:
${topItems}

${topSuppliers ? `Top supplier:\n${topSuppliers}\n` : ""}
10 transaksi terbaru:
${recent}
=== END DATA ===
`.trim();
}

function buildSystemPrompt(assistantRole, outlet, dataContext) {
  return `Kamu adalah NF3 Assistant, asisten AI internal tim Nusa Food (NF) — bisnis F&B multi-outlet di Cirebon.
Bahasa: Indonesia kasual, singkat, langsung ke poin.

Outlet:
- KBU (Kopi Buri Umah) — resto penyetan, bebek goreng & nasi daun jeruk
- KSM (Kisamen) — resto ramen, "Spicy Ramen, Smooth Matcha"
- SMT (Samtaro Express) — takeaway kopi & dimsum, no dine-in
- Gudang Central — pusat purchasing & stok

Sesi aktif:
- Role: ${assistantRole}
- Outlet: ${outlet}

Aturan akses:
- owner → semua outlet, semua data, boleh analisis & perbandingan
- keuangan → semua transaksi & kas, TIDAK memberi saran strategis
- purchasing → data pembelian, supplier, stok, reorder saja
- kasir → HANYA data outlet ${outlet} sendiri, tolak akses outlet lain

Cara menjawab:
- Jawab berdasarkan DATA di bawah — jangan mengarang angka
- Kalau data tidak ada: "Data ini belum tersedia."
- Singkat, langsung ke fakta atau angka
- Untuk owner: boleh tambah insight 1-2 kalimat
- Untuk kasir: tolak pertanyaan outlet lain dengan sopan

Batasan:
- Tidak membahas gaji atau data pribadi karyawan
- Tidak menjawab di luar konteks bisnis NF

${dataContext}`;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { messages, businessId } = body;

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "Messages tidak valid" }, { status: 400 });
    }
    if (!businessId) {
      return Response.json({ error: "businessId diperlukan" }, { status: 400 });
    }

    const access = await requireAssistantMember(req, businessId);
    if (access.error) return access.error;

    const assistantRole = mapAssistantRole(access.member.role);
    const outlet = assistantOutlet(access.member);
    const { txs, dataLoadError } = await fetchTransactions(
      access.admin,
      businessId,
      assistantRole,
      outlet
    );

    const dataContext = dataLoadError
      ? "Data tidak dapat dimuat saat ini."
      : buildDataContext(txs, assistantRole);

    const systemPrompt = buildSystemPrompt(assistantRole, outlet, dataContext);

    const model =
      assistantRole === "owner" || assistantRole === "keuangan"
        ? "claude-sonnet-4-6"
        : "claude-haiku-4-5-20251001";

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY belum dikonfigurasi." }, { status: 503 });
    }

    const chatMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await anthropic.messages.create({
      model,
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: chatMessages,
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return Response.json({
      message: text,
      model: response.model,
      txCount: txs.length,
    });
  } catch (error) {
    console.error("NF3 Assistant error:", error);
    return Response.json({ error: "Gagal menghubungi AI" }, { status: 500 });
  }
}
