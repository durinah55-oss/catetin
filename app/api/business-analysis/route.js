// app/api/business-analysis/route.js — rekomendasi keputusan owner/admin dari data operasional

import Anthropic from "@anthropic-ai/sdk";
import {
  getPeriodComparison,
  groupTransactionsByDayOfWeek,
} from "../../../lib/analysisDateLogic.js";
import {
  fallbackBusinessAdvice,
  packAnalysisForAi,
} from "../../../lib/businessAnalysis.js";

const MODEL = "claude-haiku-4-5-20251001";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildDataContextString(packed) {
  const fmt = (n) => `Rp${Math.round(n || 0).toLocaleString("id-ID")}`;
  const lines = [];

  lines.push(
    `KPI: omset total ${fmt(packed.kpis?.totalOmset)}, capai target ${packed.kpis?.globalAchievement ?? "—"}%, ${packed.kpis?.pairedDays ?? 0} hari paired SDM, ${packed.kpis?.underTargetDays ?? 0} hari under target`
  );
  lines.push(
    `Pelanggan: ${packed.kpis?.totalComplaints ?? 0} komplain, ${packed.kpis?.totalQuestions ?? 0} pertanyaan, ${packed.kpis?.wellDoneDays ?? 0} hari well-done`
  );

  for (const st of packed.outlets || []) {
    const parts = [
      st.label,
      st.avgOmset ? `omset rata ${fmt(st.avgOmset)}` : null,
      st.avgAchievement != null ? `target ${st.avgAchievement}%` : null,
      st.avgSdmRatio != null ? `rasio SDM ${st.avgSdmRatio?.toFixed?.(1) ?? st.avgSdmRatio}%` : null,
      st.complaints ? `${st.complaints} komplain` : null,
      st.questions ? `${st.questions} tanya` : null,
      st.reviewAvg != null ? `review ${st.reviewAvg.toFixed(1)}★` : null,
    ].filter(Boolean);
    lines.push(`  ${parts.join(" · ")}`);
    if (st.topComplaints?.length) lines.push(`    komplain top: ${st.topComplaints.join("; ")}`);
    if (st.topQuestions?.length) lines.push(`    tanya top: ${st.topQuestions.join("; ")}`);
  }

  const insightLines = (packed.ruleInsights || [])
    .slice(0, 8)
    .map((i) => `  [${i.tone}] ${i.title}: ${i.body}`);
  if (insightLines.length) {
    lines.push("Sinyal rule-based:");
    lines.push(...insightLines);
  }

  return lines.join("\n");
}

function buildSystemPrompt(packed, periodComp, dailyData, role) {
  const dataContext = buildDataContextString(packed);

  return `Kamu adalah analis bisnis F&B internal NF (Nusa Food), Cirebon.
Audiens: ${role === "owner" ? "owner/pemilik" : "Admin NF3"} — butuh rekomendasi KEPUTUSAN praktis, bukan teori panjang.
Bahasa: Indonesia, singkat, langsung ke poin.

PENTING — Cara membandingkan data F&B yang benar:
- JANGAN bandingkan Sabtu dengan Kamis atau tanggal berbeda
- SELALU bandingkan hari yang sama: Sabtu ini vs Sabtu minggu lalu
- Weekend (Sabtu/Minggu) omset lebih tinggi dari weekday — ini normal
- Hari libur nasional = pola seperti weekend
- Kalau naik di weekend tapi turun di weekday — analisis terpisah

Periode analisis:
- Periode ini: ${periodComp.current.label}
- Pembanding: ${periodComp.compare.label}
- ${periodComp.note}

Data per outlet (omset, SDM, komplain):
${dataContext}

Data per hari (omset type=in vs hari yang sama minggu lalu):
${dailyData}

Berikan sintesis komplain, pertanyaan, omset vs target SDM, rasio gaji, review Google.
Prioritaskan keputusan yang bisa dijalankan minggu ini.

Balas HANYA JSON valid tanpa markdown:
{
  "source": "ai",
  "executiveSummary": "<2-4 kalimat kondisi bisnis + arah keputusan>",
  "healthScore": <1-10>,
  "healthLabel": "Sehat|Waspada|Kritis",
  "decisions": [
    {
      "priority": "tinggi|sedang|rendah",
      "title": "<judul keputusan>",
      "action": "<langkah konkret 1-2 kalimat>",
      "reason": "<dasar data singkat>",
      "outlet": "<KBU|KSM|SMT|null>"
    }
  ],
  "outletFocus": { "KBU": "<fokus singkat atau kosong>", "KSM": "...", "SMT": "..." },
  "risks": ["<risiko 1>", "..."],
  "opportunities": ["<peluang 1>", "..."]
}

Minimal 3 decisions jika data cukup. Maks 6 decisions.`;
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
    const { analysis, financeInsights = [], role = "owner", transactions = [] } = body;

    if (!analysis?.period) {
      return Response.json({ error: "analysis wajib" }, { status: 400 });
    }

    const packed = packAnalysisForAi(analysis, financeInsights);
    const periodeHari = analysis.period.days || 7;
    const periodComp = getPeriodComparison(periodeHari);
    const dailyData = groupTransactionsByDayOfWeek(transactions, periodComp.current, periodComp.compare);
    const systemPrompt = buildSystemPrompt(packed, periodComp, dailyData, role);

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(fallbackBusinessAdvice(analysis, financeInsights));
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: periodeHari >= 90 ? 700 : 600,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: "Berikan analisis dan rekomendasi berdasarkan data di atas.",
        },
      ],
    });

    const raw =
      response.content[0]?.type === "text"
        ? response.content[0].text.replace(/```json|```/g, "").trim()
        : "";

    const result = JSON.parse(raw);
    return Response.json({ ...result, source: result.source || "ai", model: response.model });
  } catch (e) {
    console.error("Business analysis AI error:", e);
    if (body?.analysis) {
      return Response.json(fallbackBusinessAdvice(body.analysis, body.financeInsights || []));
    }
    return Response.json({ error: "Gagal analisis AI", detail: String(e) }, { status: 500 });
  }
}
