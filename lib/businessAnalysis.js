// lib/businessAnalysis.js — analisis usaha dari omset, SDM, sosmed (komplain/tanya/review)

import { OUTLETS, OUTLET_LABEL, opsTagsLabel, OPS_TAGS_MORNING, OPS_TAGS_EVENING } from "./sdmHarian.js";
import { STAR_KEYS, DM_PLATFORMS, SOCIAL_PLATFORMS } from "./sosmedReport.js";

export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoOffset(days, base = todayISO()) {
  const [y, mo, da] = base.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + days);
  return todayISO(dt);
}

export function inPeriod(date, from, to) {
  return date >= from && date <= to;
}

function fmt(n) {
  return new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
}

function pct(n, d = 1) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function sumDm(report) {
  return Object.values(report?.dm || {}).reduce((a, b) => a + (+b || 0), 0);
}

function sumComments(report) {
  return Object.values(report?.comments || {}).reduce((a, b) => a + (+b || 0), 0);
}

function googleBreakdown(reports) {
  let good = 0;
  let bad = 0;
  let total = 0;
  reports.forEach((r) => {
    (STAR_KEYS || []).forEach(({ key }) => {
      const n = +(r.googleReviews?.[key] || 0);
      const star = parseInt(String(key).replace("star", ""), 10);
      total += n;
      if (star >= 4) good += n;
      if (star <= 2) bad += n;
    });
  });
  return { good, bad, total };
}

function avgReviewScore(reports) {
  let weighted = 0;
  let total = 0;
  reports.forEach((r) => {
    (STAR_KEYS || []).forEach(({ key }) => {
      const n = +(r.googleReviews?.[key] || 0);
      const star = parseInt(String(key).replace("star", ""), 10);
      weighted += star * n;
      total += n;
    });
  });
  return total ? weighted / total : null;
}

export function topRepeatedLines(items, limit = 5) {
  const count = {};
  (items || []).forEach((line) => {
    const k = String(line || "").trim().toLowerCase();
    if (!k) return;
    count[k] = (count[k] || 0) + 1;
  });
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([text, n]) => ({ text, count: n }));
}

function joinDaysWithData(dailyReports, sdmReports, sosmedReports, outlet, from, to) {
  const dates = new Set();
  [dailyReports, sdmReports, sosmedReports].forEach((list) => {
    (list || [])
      .filter((r) => r.outlet === outlet && inPeriod(r.date, from, to))
      .forEach((r) => dates.add(r.date));
  });
  return [...dates].sort();
}

/** Analisis per outlet + insight gabungan untuk tab Analisis Usaha. */
export function buildBusinessAnalysis(state, options = {}) {
  const days = Math.max(1, options.days || 7);
  const to = options.to || todayISO();
  const from = isoOffset(-(days - 1), to);

  const dailyReports = state?.dailyReports || [];
  const sdmReports = state?.sdmReports || [];
  const sosmedReports = state?.sosmedReports || [];
  const voidLogs = state?.voidLogs || [];

  const insights = [];
  const outletStats = {};

  let totalOmset = 0;
  let totalTarget = 0;
  let pairedDays = 0;
  let underTargetDays = 0;
  let allComplaints = [];
  let allQuestions = [];
  let wellDoneDays = 0;
  let sosmedReportDays = 0;

  OUTLETS.forEach((outlet) => {
    const label = OUTLET_LABEL[outlet] || outlet;
    const daily = dailyReports.filter((r) => r.outlet === outlet && inPeriod(r.date, from, to));
    const sdm = sdmReports.filter((r) => r.outlet === outlet && inPeriod(r.date, from, to));
    const sosmed = sosmedReports.filter((r) => r.outlet === outlet && inPeriod(r.date, from, to) && r.submittedAt);

    const omsetTotal = daily.reduce((a, r) => a + (+r.total || 0), 0);
    const omsetDays = daily.length;
    const avgOmset = omsetDays ? omsetTotal / omsetDays : 0;

    let targetSum = 0;
    let achieveSum = 0;
    let achieveCount = 0;
    let underOutlet = 0;
    const paired = [];

    daily.forEach((dr) => {
      const sdmDay = sdm.find((s) => s.date === dr.date);
      const target = +(dr.dailyTargetAtSubmit || sdmDay?.targetOmset || 0);
      if (target > 0) {
        paired.push({ date: dr.date, total: dr.total, target, sdm: sdmDay });
        targetSum += target;
        achieveSum += (+dr.total || 0) / target;
        achieveCount += 1;
        totalOmset += +dr.total || 0;
        totalTarget += target;
        pairedDays += 1;
        if (+dr.total < target) {
          underOutlet += 1;
          underTargetDays += 1;
        }
      }
    });

    const avgAchievement = achieveCount ? pct(achieveSum, achieveCount) : null;
    const avgSdmRatio = sdm.length
      ? sdm.reduce((a, r) => a + (+r.ratio || 0), 0) / sdm.length
      : null;
    const sdmWarningDays = sdm.filter((r) => r.statusKey === "bahaya" || r.statusKey === "warning").length;

    const complaints = sosmed.flatMap((r) => r.complaints || []);
    const questions = sosmed.flatMap((r) => r.topQuestions || []);
    allComplaints.push(...complaints.map((c) => ({ outlet, text: c })));
    allQuestions.push(...questions.map((q) => ({ outlet, text: q })));

    const wellDone = sosmed.filter((r) => r.wellDone).length;
    wellDoneDays += wellDone;
    sosmedReportDays += sosmed.length;

    const dmTotal = sosmed.reduce((a, r) => a + sumDm(r), 0);
    const commentTotal = sosmed.reduce((a, r) => a + sumComments(r), 0);
    const unrepliedDays = sosmed.filter((r) =>
      SOCIAL_PLATFORMS.some((p) => (+r.comments?.[p.key] || 0) > 0 && !r.replied?.[p.key])
    ).length;

    const reviews = googleBreakdown(sosmed);
    const reviewAvg = avgReviewScore(sosmed);

    const voidCount = voidLogs.filter(
      (v) => v.outlet === outlet && inPeriod(v.date, from, to)
    ).length;

    const opsIssues = sdm.flatMap((r) => [
      ...opsTagsLabel(r.opsTags, OPS_TAGS_MORNING),
      ...opsTagsLabel(r.opsTags, OPS_TAGS_EVENING),
      r.opsNote,
    ]).filter(Boolean);

    outletStats[outlet] = {
      outlet,
      label,
      omsetTotal,
      omsetDays,
      avgOmset,
      avgAchievement,
      avgSdmRatio,
      sdmWarningDays,
      sdmDays: sdm.length,
      complaintCount: complaints.length,
      questionCount: questions.length,
      wellDoneDays: wellDone,
      sosmedDays: sosmed.length,
      dmTotal,
      commentTotal,
      unrepliedDays,
      reviewAvg,
      reviewGood: reviews.good,
      reviewBad: reviews.bad,
      voidCount,
      topComplaints: topRepeatedLines(complaints, 3),
      topQuestions: topRepeatedLines(questions, 3),
      dataDays: joinDaysWithData(dailyReports, sdmReports, sosmedReports, outlet, from, to).length,
      paired,
    };

    if (achieveCount >= 2 && avgAchievement != null && avgAchievement < 85) {
      insights.push({
        id: `omset_low_${outlet}`,
        category: "omset_sdm",
        outlet,
        tone: "warn",
        title: `${label}: omset di bawah target`,
        body: `${days} hari terakhir rata-rata capai ${avgAchievement}% target (Rp ${fmt(avgOmset)}/hari). ${underOutlet} hari di bawah target SDM.`,
      });
    }

    if (sdmWarningDays >= 2) {
      insights.push({
        id: `sdm_ratio_${outlet}`,
        category: "omset_sdm",
        outlet,
        tone: "danger",
        title: `${label}: rasio SDM tinggi`,
        body: `${sdmWarningDays} hari rasio gaji/omset WARNING/BAHAYA. Rata-rata ${avgSdmRatio?.toFixed(1).replace(".", ",")}% — pertimbangkan efisiensi SDM atau dorong omset.`,
      });
    }

    if (complaints.length >= 2) {
      const top = topRepeatedLines(complaints, 1)[0];
      insights.push({
        id: `komplain_${outlet}`,
        category: "pelanggan",
        outlet,
        tone: "warn",
        title: `${label}: ${complaints.length} komplain (${days} hari)`,
        body: top
          ? `Tema berulang: "${top.text}" (${top.count}×).${avgAchievement != null && avgAchievement < 90 ? " Omset juga di bawah target — perlu perbaikan layanan." : ""}`
          : "Review komplain harian sosmed & tindak lanjuti ke tim outlet.",
      });
    }

    if (questions.length >= 3) {
      const top = topRepeatedLines(questions, 2).map((q) => `"${q.text}" (${q.count}×)`).join(", ");
      insights.push({
        id: `tanya_${outlet}`,
        category: "pelanggan",
        outlet,
        tone: "info",
        title: `${label}: pertanyaan pelanggan sering`,
        body: `Top pertanyaan: ${top}. Pertimbangkan FAQ di bio/story atau SOP jawaban kasir.`,
      });
    }

    if (reviews.bad >= 2 && reviews.bad >= reviews.good) {
      insights.push({
        id: `review_bad_${outlet}`,
        category: "pelanggan",
        outlet,
        tone: "danger",
        title: `${label}: review Google lemah`,
        body: `${reviews.bad} review bintang 1–2 vs ${reviews.good} bintang 4–5 (${days} hari).${reviewAvg ? ` Rata-rata ${reviewAvg.toFixed(1)}★.` : ""} Prioritaskan follow-up & perbaikan layanan.`,
      });
    }

    if (wellDone >= 2 && complaints.length === 0) {
      insights.push({
        id: `well_done_${outlet}`,
        category: "pelanggan",
        outlet,
        tone: "ok",
        title: `${label}: feedback positif`,
        body: `${wellDone} hari dengan tanda Well-done ✅ tanpa komplain tercatat. Pertahankan standar layanan.`,
      });
    }

    if (unrepliedDays >= 2) {
      insights.push({
        id: `reply_${outlet}`,
        category: "pelanggan",
        outlet,
        tone: "warn",
        title: `${label}: komentar belum dibalas`,
        body: `${unrepliedDays} hari ada komentar IG/FB/TikTok yang belum ditandai "sudah dibalas". Respons cepat bantu citra outlet.`,
      });
    }

    const komplainOps = opsIssues.filter((t) => /komplain/i.test(t)).length;
    if (komplainOps >= 1 && complaints.length >= 1) {
      insights.push({
        id: `ops_komplain_${outlet}`,
        category: "operasional",
        outlet,
        tone: "warn",
        title: `${label}: komplain operasional + pelanggan`,
        body: "SDM melaporkan kendala komplain pelanggan sekaligus ada input komplain sosmed — koordinasi supervisor hari itu.",
      });
    }

    if (voidCount >= 3) {
      insights.push({
        id: `void_${outlet}`,
        category: "operasional",
        outlet,
        tone: "info",
        title: `${label}: void/cancel sering`,
        body: `${voidCount} void/cancel ${days} hari terakhir. Cek pola (menu habis, salah input, antrian).`,
      });
    }
  });

  const globalAchievement = pairedDays ? pct(totalOmset, totalTarget) : null;

  if (pairedDays >= 3 && globalAchievement != null && globalAchievement < 88) {
    insights.push({
      id: "omset_global",
      category: "omset_sdm",
      tone: "warn",
      title: "Omset gabungan di bawah target SDM",
      body: `Semua outlet: ${globalAchievement}% dari target ${days} hari (${underTargetDays}/${pairedDays} hari under). Fokus jam sibuk & promo menu laris.`,
    });
  }

  const topGlobalComplaints = topRepeatedLines(allComplaints.map((c) => c.text), 3);
  const topGlobalQuestions = topRepeatedLines(allQuestions.map((q) => q.text), 3);

  if (allComplaints.length === 0 && allQuestions.length === 0 && sosmedReportDays === 0) {
    insights.push({
      id: "no_sosmed",
      category: "pelanggan",
      tone: "info",
      title: "Belum ada laporan sosmed",
      body: "Isi Daily Report Sosmed (komplain, pertanyaan, review) agar analisis suara pelanggan muncul di sini.",
    });
  }

  if (pairedDays === 0 && sdmReports.filter((r) => inPeriod(r.date, from, to)).length === 0) {
    insights.push({
      id: "no_sdm_omset",
      category: "omset_sdm",
      tone: "info",
      title: "Belum ada data omset + SDM",
      body: "Kasir perlu input SDM pagi & Laporan Omset harian supaya perbandingan omset vs beban SDM bisa dianalisis.",
    });
  }

  return {
    period: { from, to, days },
    kpis: {
      totalOmset,
      globalAchievement,
      pairedDays,
      underTargetDays,
      totalComplaints: allComplaints.length,
      totalQuestions: allQuestions.length,
      wellDoneDays,
      sosmedReportDays,
    },
    outletStats,
    customerVoice: {
      topComplaints: topGlobalComplaints,
      topQuestions: topGlobalQuestions,
    },
    insights,
  };
}

/** Ringkas data untuk prompt AI (hemat token). */
export function packAnalysisForAi(biz, extraInsights = []) {
  const outlets = Object.values(biz.outletStats || {}).map((st) => ({
    outlet: st.outlet,
    label: st.label,
    avgOmset: st.avgOmset,
    avgAchievement: st.avgAchievement,
    avgSdmRatio: st.avgSdmRatio,
    sdmWarningDays: st.sdmWarningDays,
    complaints: st.complaintCount,
    questions: st.questionCount,
    reviewAvg: st.reviewAvg,
    topComplaints: (st.topComplaints || []).map((c) => c.text),
    topQuestions: (st.topQuestions || []).map((q) => q.text),
  }));

  return {
    period: biz.period,
    kpis: biz.kpis,
    outlets,
    customerVoice: biz.customerVoice,
    ruleInsights: [...(biz.insights || []), ...(extraInsights || [])].slice(0, 12).map((i) => ({
      title: i.title,
      body: i.body,
      tone: i.tone,
      outlet: i.outlet,
    })),
  };
}

/** Cadangan jika API key tidak ada atau Claude gagal. */
export function fallbackBusinessAdvice(biz, extraInsights = []) {
  const insights = [...(biz.insights || []), ...(extraInsights || [])];
  const danger = insights.filter((i) => i.tone === "danger").length;
  const warn = insights.filter((i) => i.tone === "warn").length;
  let healthScore = 8;
  if (danger >= 2) healthScore = 4;
  else if (danger >= 1 || warn >= 3) healthScore = 5;
  else if (warn >= 1) healthScore = 6;
  if (biz.kpis.globalAchievement != null && biz.kpis.globalAchievement < 80) healthScore = Math.min(healthScore, 5);
  if (biz.kpis.totalComplaints >= 5) healthScore = Math.min(healthScore, 5);

  const healthLabel = healthScore >= 7 ? "Sehat" : healthScore >= 5 ? "Waspada" : "Kritis";

  const decisions = [];
  const priorityOrder = { danger: 0, warn: 1, info: 2, ok: 3 };
  insights
    .slice()
    .sort((a, b) => (priorityOrder[a.tone] ?? 9) - (priorityOrder[b.tone] ?? 9))
    .slice(0, 5)
    .forEach((i) => {
      decisions.push({
        priority: i.tone === "danger" ? "tinggi" : i.tone === "warn" ? "sedang" : "rendah",
        title: i.title,
        action: i.body.split(".")[0] + ".",
        reason: i.body,
        outlet: i.outlet || null,
      });
    });

  if (decisions.length === 0) {
    decisions.push({
      priority: "rendah",
      title: "Pertahankan disiplin input",
      action: "Pastikan kasir isi SDM pagi, omset sore, dan sosmed setiap hari.",
      reason: "Data lengkap = analisis & keputusan lebih akurat.",
      outlet: null,
    });
  }

  const outletFocus = {};
  Object.values(biz.outletStats || {}).forEach((st) => {
    if (st.dataDays === 0) return;
    const parts = [];
    if (st.avgAchievement != null && st.avgAchievement < 90) parts.push(`omset ${st.avgAchievement}% target`);
    if (st.complaintCount) parts.push(`${st.complaintCount} komplain`);
    if (st.sdmWarningDays) parts.push(`rasio SDM tinggi ${st.sdmWarningDays} hari`);
    if (parts.length) outletFocus[st.outlet] = `${st.label}: fokus ${parts.join(", ")}.`;
  });

  const risks = insights.filter((i) => i.tone === "danger" || i.tone === "warn").map((i) => i.title).slice(0, 4);
  const opportunities = [];
  if (biz.kpis.wellDoneDays > 0) opportunities.push(`${biz.kpis.wellDoneDays} hari feedback positif — dokumentasikan praktik baik tim.`);
  Object.values(biz.outletStats || {}).forEach((st) => {
    if (st.avgAchievement != null && st.avgAchievement >= 95) {
      opportunities.push(`${st.label} capai target konsisten — pertimbangkan duplikasi SOP ke outlet lain.`);
    }
  });
  if (!opportunities.length) opportunities.push("Tingkatkan input harian agar AI bisa memberi saran lebih spesifik.");

  const summaryParts = [
    `Periode ${biz.period.days} hari (${biz.period.from}–${biz.period.to}).`,
    biz.kpis.globalAchievement != null ? `Omset vs target SDM: ${biz.kpis.globalAchievement}%.` : null,
    biz.kpis.totalComplaints ? `${biz.kpis.totalComplaints} komplain tercatat.` : null,
    `${insights.length} sinyal operasional terdeteksi.`,
    `Status usaha: ${healthLabel}.`,
  ].filter(Boolean);

  return {
    source: "fallback",
    executiveSummary: summaryParts.join(" "),
    healthScore,
    healthLabel,
    decisions,
    outletFocus,
    risks,
    opportunities,
  };
}
