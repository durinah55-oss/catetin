// app/api/sdm-advice/route.js — saran AI rasio SDM & optimasi omset outlet

import { fallbackAdvice, opsTagsLabel, OPS_TAGS_MORNING, OPS_TAGS_EVENING } from "../../../lib/sdmHarian.js";

const MODEL = "claude-sonnet-4-6";

async function callClaude(body) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
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

function buildOpsBlock(operationalContext, mode) {
  const tags = operationalContext?.tagLabels?.length
    ? operationalContext.tagLabels
    : opsTagsLabel(
        operationalContext?.tags,
        mode === "evening" ? OPS_TAGS_EVENING : OPS_TAGS_MORNING
      );
  const note = operationalContext?.note || "";
  if (!tags.length && !note) return "Tidak ada kendala khusus dilaporkan.";
  return [...tags, note].filter(Boolean).join("; ");
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
    const {
      mode = "morning",
      outlet,
      snapshot,
      actualOmset,
      underTarget,
      salesContext = {},
      operationalContext = {},
    } = body;

    if (!snapshot?.headcount) {
      return Response.json({ error: "snapshot wajib" }, { status: 400 });
    }

    const ctx = {
      snapshot: {
        ...snapshot,
        status: snapshot.status || { key: snapshot.statusKey, label: snapshot.statusLabel },
      },
      actualOmset,
      underTarget: !!underTarget,
      mode,
      operationalContext,
    };

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(fallbackAdvice(ctx));
    }

    const fmt = (n) => new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
    const recent = (salesContext.recentDailyTotals || [])
      .slice(0, 5)
      .map((r) => `${r.date}: Rp ${fmt(r.total)}`)
      .join("; ") || "belum ada riwayat";

    const topCat = (salesContext.topCategories || [])
      .map((c) => `${c.name} (Rp ${fmt(c.total)})`)
      .join(", ") || "belum ada data kategori";

    const perPerson = snapshot.omsetPerPerson || 500000;
    const opsBlock = buildOpsBlock(operationalContext, mode);

    const eveningFocus = mode === "evening"
      ? `Mode AKHIR HARI untuk kasir outlet. Fokus pada kendala operasional & langkah praktis besok. Jangan ulangi penjelasan rasio SDM panjang.
Kendala operasional kasir: ${opsBlock}
${actualOmset != null ? `Omset closing: Rp ${fmt(actualOmset)} vs target Rp ${fmt(snapshot.targetOmset)}${underTarget ? " (DI BAWAH TARGET)" : " (capai/melebihi target)"}.` : ""}
Field "operationalInsight" wajib isi analisis singkat kendala. "upselling" boleh kosong [].`
      : `Mode PAGI setelah input SDM. Sesuaikan tips dengan kendala/kondisi awal shift.
Kondisi awal shift: ${opsBlock}`;

    const result = await callClaude({
      model: MODEL,
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `Kamu konsultan operasional F&B Indonesia (outlet warung/makan). Saran praktis untuk kasir outlet — bahasa Indonesia santai tapi profesional.

${eveningFocus}

Data hari ini — outlet ${outlet}:
- SDM masuk: ${snapshot.headcount} orang
- Biaya SDM: Rp ${fmt(snapshot.sdmCost)} (gaji harian Rp ${fmt(snapshot.dailyWage)}/orang)
- Target omset harian: Rp ${fmt(snapshot.targetOmset)} (= Rp ${fmt(perPerson)}/org × ${snapshot.headcount} SDM)
- Rasio gaji/omset: ${snapshot.ratioLabel || snapshot.ratio + "%"}
- Status rasio: ${snapshot.statusLabel || snapshot.status?.label}
- Omset minimum agar AMAN (<14%): Rp ${fmt(snapshot.minOmsetAman)}
- Riwayat omset: ${recent}
- Kategori penjualan: ${topCat}

Balas HANYA JSON tanpa markdown:
{
  "summary": "<1-2 kalimat kesimpulan relevan mode pagi/sore>",
  "ratioExplanation": "<rumus singkat jika pagi; string kosong jika sore>",
  "underTargetAdvice": "<jika omset di bawah target; kosong jika tidak relevan>",
  "operationalInsight": "<analisis kendala operasional berdasarkan input kasir — WAJIB jika ada kendala>",
  "tips": ["<tip praktis 1>", "<tip 2>"],
  "upselling": ["<saran upselling — pagi saja>"],
  "promoBest": ["<promo/menu laris>"],
  "promoSlow": ["<jual menu lambat — pagi saja>"]
}`,
      }],
    });

    return Response.json(result);
  } catch (e) {
    console.error("SDM advice error:", e);
    if (body?.snapshot) {
      return Response.json(fallbackAdvice({
        snapshot: body.snapshot,
        actualOmset: body.actualOmset,
        underTarget: body.underTarget,
        mode: body.mode,
        operationalContext: body.operationalContext,
      }));
    }
    return Response.json({ error: "Gagal memproses saran", detail: String(e) }, { status: 500 });
  }
}
