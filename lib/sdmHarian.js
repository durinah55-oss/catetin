// lib/sdmHarian.js — input SDM pagi outlet, rasio gaji/omset, saran AI

export const DEFAULT_DAILY_WAGE = 70000;
/** Target omset per orang per hari (Rp). Total harian = × jumlah SDM. */
export const DEFAULT_OMSET_PER_PERSON = 500000;
/** @deprecated — gunakan DEFAULT_OMSET_PER_PERSON */
export const DEFAULT_OMSET_TARGET = DEFAULT_OMSET_PER_PERSON;

export const OUTLETS = ["KBU", "KSM", "SMT"];

export const OUTLET_LABEL = { KBU: "KBU", KSM: "Kisamen", SMT: "Samtaro" };

/** Chip kendala operasional — pagi (kondisi awal shift). */
export const OPS_TAGS_MORNING = [
  { id: "cuaca_hujan", label: "Cuaca hujan" },
  { id: "sdm_kurang", label: "SDM kurang dari biasa" },
  { id: "stok_terbatas", label: "Stok bahan terbatas" },
  { id: "promo_hari_ini", label: "Ada promo khusus" },
  { id: "event_libur", label: "Libur / event dekat outlet" },
  { id: "mesin_gangguan", label: "Mesin/kompor gangguan" },
];

/** Chip kendala operasional — sore (setelah operasional). */
export const OPS_TAGS_EVENING = [
  { id: "antrian_panjang", label: "Antrian panjang" },
  { id: "edc_error", label: "EDC / QRIS gangguan" },
  { id: "stok_habis", label: "Menu habis lebih awal" },
  { id: "hujan_sore", label: "Hujan deras siang/sore" },
  { id: "sdm_pulang_awal", label: "SDM pulang lebih awal" },
  { id: "online_lambat", label: "Order online melambat" },
  { id: "komplain_pelanggan", label: "Ada komplain pelanggan" },
];

/** Patokan jumlah SDM tipikal per outlet (hint untuk kasir). */
export const SDM_HINT = {
  KBU: "Biasanya 9–13 orang (tergantung hari)",
  KSM: "Biasanya 5–6 orang",
  SMT: "Biasanya 1 orang",
};

export function parseHeadcountInput(raw) {
  const s = String(raw || "").trim();
  if (!s) return 0;
  if (s.includes("-")) {
    const [a, b] = s.split("-").map((x) => parseInt(x.replace(/\D/g, ""), 10)).filter(Boolean);
    if (a && b) return Math.round((a + b) / 2);
    return a || b || 0;
  }
  return Math.max(0, parseInt(s.replace(/\D/g, ""), 10) || 0);
}

export const STATUS_RULES = [
  { key: "bahaya", label: "BAHAYA", min: 20.0001, color: "#DC2626", bg: "#FEE2E2" },
  { key: "warning", label: "WARNING", min: 18, max: 20, color: "#D97706", bg: "#FEF3C7" },
  { key: "sehat", label: "SEHAT", min: 15, max: 18, color: "#16A34A", bg: "#DCFCE7" },
  { key: "aman", label: "AMAN", max: 14, color: "#0EA5E9", bg: "#E0F2FE" },
];

export function defaultOutletConfig() {
  return Object.fromEntries(
    OUTLETS.map((o) => [o, { omsetPerPerson: DEFAULT_OMSET_PER_PERSON, dailyWage: DEFAULT_DAILY_WAGE }])
  );
}

/** Merge config tersimpan + backward compat omsetTarget. */
export function hydrateOutletConfig(saved) {
  const factory = defaultOutletConfig();
  const out = {};
  OUTLETS.forEach((o) => {
    const s = saved?.[o] || {};
    out[o] = {
      omsetPerPerson: s.omsetPerPerson ?? s.omsetTarget ?? factory[o].omsetPerPerson,
      dailyWage: s.dailyWage ?? factory[o].dailyWage,
    };
  });
  return out;
}

export function factoryOutletConfig(outlet) {
  return { ...(defaultOutletConfig()[outlet] || { omsetPerPerson: DEFAULT_OMSET_PER_PERSON, dailyWage: DEFAULT_DAILY_WAGE }) };
}

export function getOutletConfig(outletConfig, outlet) {
  const cfg = outletConfig?.[outlet] || {};
  const perPerson = cfg.omsetPerPerson ?? cfg.omsetTarget ?? DEFAULT_OMSET_PER_PERSON;
  return {
    omsetPerPerson: perPerson,
    /** Alias — nilai per orang, bukan total harian */
    omsetTarget: perPerson,
    dailyWage: cfg.dailyWage ?? DEFAULT_DAILY_WAGE,
  };
}

/** Target omset harian = Rp per orang × jumlah SDM masuk. */
export function calcDailyOmsetTarget(headcount, outletConfig, outlet) {
  const cfg = getOutletConfig(outletConfig, outlet);
  const n = Math.max(0, Math.floor(+headcount || 0));
  if (n <= 0) return 0;
  return Math.round(n * cfg.omsetPerPerson);
}

export function formatTargetFormula(headcount, perPerson, cur = "IDR") {
  const fmt = (n) => new Intl.NumberFormat("id-ID").format(Math.round(n));
  const n = Math.max(0, Math.floor(+headcount || 0));
  if (n <= 0) return `${fmt(perPerson)}/orang × SDM`;
  return `${fmt(perPerson)}/org × ${n} SDM = Rp ${fmt(n * perPerson)}`;
}

export function opsTagsLabel(tagIds, tagList) {
  const map = Object.fromEntries((tagList || []).map((t) => [t.id, t.label]));
  return (tagIds || []).map((id) => map[id] || id).filter(Boolean);
}

export function calcSdmCost(headcount, dailyWage = DEFAULT_DAILY_WAGE) {
  const n = Math.max(0, Math.floor(+headcount || 0));
  const wage = Math.max(0, +dailyWage || DEFAULT_DAILY_WAGE);
  return Math.round(n * wage);
}

export function calcSdmRatio(sdmCost, targetOmset) {
  const target = Math.max(1, +targetOmset || 1);
  return (Math.max(0, +sdmCost || 0) / target) * 100;
}

/** Status rasio SDM vs target omset. */
export function sdmStatus(ratio) {
  const r = +ratio || 0;
  if (r > 20) return STATUS_RULES[0];
  if (r >= 18) return STATUS_RULES[1];
  if (r >= 15) return STATUS_RULES[2];
  return STATUS_RULES[3]; // < 14% dan 14–15% → AMAN
}

export function minOmsetForRatio(sdmCost, ratioPct = 14) {
  const pct = Math.max(0.01, +ratioPct || 14) / 100;
  return Math.ceil(Math.max(0, +sdmCost || 0) / pct);
}

export function buildSdmSnapshot({ headcount, dailyWage, targetOmset, omsetPerPerson, outlet }) {
  const n = parseHeadcountInput(headcount);
  const perPerson = Math.max(1, +omsetPerPerson || DEFAULT_OMSET_PER_PERSON);
  const target = Math.max(1, +targetOmset || calcDailyOmsetTarget(n, { [outlet]: { omsetPerPerson: perPerson } }, outlet));
  const sdmCost = calcSdmCost(n, dailyWage);
  const ratio = calcSdmRatio(sdmCost, target);
  const status = sdmStatus(ratio);
  const minOmsetAman = minOmsetForRatio(sdmCost, 14);
  const minOmsetSehat = minOmsetForRatio(sdmCost, 15);

  return {
    headcount: n,
    dailyWage: Math.max(0, +dailyWage || DEFAULT_DAILY_WAGE),
    omsetPerPerson: perPerson,
    sdmCost,
    targetOmset: target,
    ratio,
    ratioLabel: ratio.toFixed(2).replace(".", ",") + "%",
    status,
    minOmsetAman,
    minOmsetSehat,
    outlet,
  };
}

export function buildRatioExplanation(snapshot) {
  const { headcount, sdmCost, targetOmset, omsetPerPerson, ratioLabel, status } = snapshot;
  const fmt = (n) => new Intl.NumberFormat("id-ID").format(Math.round(n));
  const per = omsetPerPerson || DEFAULT_OMSET_PER_PERSON;
  return (
    `Hari ini ${headcount} SDM masuk (beban gaji ~Rp ${fmt(sdmCost)}). ` +
    `Target omset Rp ${fmt(targetOmset)} (${fmt(per)}/org × ${headcount} orang). ` +
    `Rasio gaji/omset ${ratioLabel} → status **${status.label}**.`
  );
}

/** Kasir submit laporan SDM pagi. */
export function submitSdmReport(state, { headcount, dailyWage, date, user, advice = null, opsTags = [], opsNote = "" }) {
  const outlet = user?.outlet;
  if (!outlet || !OUTLETS.includes(outlet)) throw new Error("Outlet kasir tidak valid.");

  const n = Math.floor(parseHeadcountInput(headcount));
  if (n <= 0) throw new Error("Isi jumlah SDM yang masuk hari ini.");

  const reports = state.sdmReports || [];
  const dup = reports.find((r) => r.outlet === outlet && r.date === date);
  if (dup) throw new Error(`SDM ${date} untuk ${outlet} sudah diinput.`);

  const cfg = getOutletConfig(state.outletConfig, outlet);
  const wage = dailyWage != null && dailyWage !== "" ? +dailyWage : cfg.dailyWage;
  const targetOmset = calcDailyOmsetTarget(n, state.outletConfig, outlet);
  const snapshot = buildSdmSnapshot({
    headcount: n,
    dailyWage: wage,
    targetOmset,
    omsetPerPerson: cfg.omsetPerPerson,
    outlet,
  });

  const report = {
    id: "sr" + Date.now(),
    date,
    outlet,
    kasirId: user.id,
    kasirName: user.name,
    ...snapshot,
    statusKey: snapshot.status.key,
    statusLabel: snapshot.status.label,
    submittedAt: new Date().toISOString(),
    opsTags: (opsTags || []).filter(Boolean),
    opsNote: String(opsNote || "").trim(),
    advice,
  };

  return { report };
}

export function todaySdmReport(reports, outlet, date) {
  return (reports || []).find((r) => r.outlet === outlet && r.date === date) || null;
}

/** Ringkasan penjualan outlet untuk konteks AI. */
export function outletSalesContext(state, outlet, days = 7) {
  const reports = (state.dailyReports || []).filter((r) => r.outlet === outlet);
  const recent = reports
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, days)
    .map((r) => ({
      date: r.date,
      total: r.total,
      cash: r.cash,
      qris: (r.qrisBca || 0) + (r.qrisBri || 0),
      gojek: r.gojek,
    }));

  const walletId = { KBU: "w_laci_kbu", KSM: "w_laci_ksm", SMT: "w_laci_smt" }[outlet];
  const txs = (state.transactions || []).filter(
    (t) => t.type === "in" && (t.walletId === walletId || t.desc?.includes(outlet))
  );
  const byCat = {};
  txs.forEach((t) => {
    const cat = (state.categories || []).find((c) => c.id === t.categoryId);
    const name = cat?.name || "Lainnya";
    byCat[name] = (byCat[name] || 0) + t.amount;
  });
  const topCategories = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({ name, total }));

  return { recentDailyTotals: recent, topCategories };
}

/** Saran offline jika API AI tidak tersedia. */
export function fallbackAdvice(ctx) {
  const {
    snapshot,
    actualOmset,
    underTarget,
    mode = "morning",
    operationalContext = {},
  } = ctx;
  const fmt = (n) => new Intl.NumberFormat("id-ID").format(Math.round(n));
  const tips = [];
  const upselling = [
    "Tawarkan upsize minuman atau tambahan topping saat pelanggan pesan makanan utama.",
    "Rekomendasikan paket combo (makan + minum) — margin combo biasanya lebih baik.",
    "Ingatkan pelanggan menu best seller hari ini di awal order.",
  ];
  const promoBest = [
    "Highlight 1–2 menu laris di display kasir / papan menu.",
    "Siapkan bundle promo jam makan siang untuk dorong ticket size.",
  ];
  const promoSlow = [
    "Buat promo diskon kecil untuk menu yang jarang keluar (mis. 10% off sebelum jam tutup).",
    "Cross-sell menu lambat dengan pairing ke menu populer.",
  ];

  const tagLabels = operationalContext.tagLabels || [];
  const opsNote = operationalContext.note || "";

  if (mode === "evening") {
    if (tagLabels.length || opsNote) {
      tips.push(`Kendala dilaporkan: ${[...tagLabels, opsNote].filter(Boolean).join("; ")}.`);
      if (tagLabels.some((t) => /hujan/i.test(t))) {
        tips.push("Besok siapkan opsi delivery/pickup lebih aktif dan perketat stok hangat di jam hujan.");
      }
      if (tagLabels.some((t) => /EDC|QRIS|gangguan/i.test(t))) {
        tips.push("Koordinasi dengan Admin NF3 cek mesin EDC; siapkan fallback tunai/transfer jelas ke pelanggan.");
      }
      if (tagLabels.some((t) => /habis|stok/i.test(t))) {
        tips.push("Review prep list besok — tambah buffer bahan menu yang sering habis.");
      }
    }
    if (underTarget && actualOmset != null) {
      tips.push(
        `Omset Rp ${fmt(actualOmset)} vs target Rp ${fmt(snapshot.targetOmset)}. Prioritaskan closing order & layanan cepat di jam sisa.`
      );
    } else if (actualOmset != null) {
      tips.push(`Omset Rp ${fmt(actualOmset)} — pertahankan ritme layanan dan catat menu laris untuk besok.`);
    }
    return {
      summary: underTarget
        ? `Closing hari ini di bawah target. Fokus perbaiki kendala operasional yang dilaporkan.`
        : `Closing hari ini sesuai target. Catat kendala untuk perbaikan shift berikutnya.`,
      ratioExplanation: "",
      underTargetAdvice: underTarget
        ? `Kurang Rp ${fmt(Math.max(0, snapshot.targetOmset - actualOmset))} dari target harian.`
        : "",
      operationalInsight: tagLabels.length || opsNote
        ? `Kendala: ${[...tagLabels, opsNote].filter(Boolean).join(" · ")}`
        : "",
      tips,
      upselling: mode === "evening" ? [] : upselling,
      promoBest: mode === "evening" ? tips.slice(0, 2) : promoBest,
      promoSlow: mode === "evening" ? [] : promoSlow,
    };
  }

  if (snapshot.status.key === "bahaya" || snapshot.status.key === "warning") {
    tips.push(
      `Rasio gaji ${snapshot.ratioLabel} — dorong omset minimal Rp ${fmt(snapshot.minOmsetAman)} agar status AMAN (<14%).`
    );
  } else {
    tips.push(`Rasio gaji ${snapshot.ratioLabel} — ${snapshot.status.label}. Pertahankan disiplin input & layanan.`);
  }

  if (tagLabels.length || opsNote) {
    tips.push(`Kondisi awal: ${[...tagLabels, opsNote].filter(Boolean).join("; ")}.`);
  }

  if (underTarget && actualOmset != null) {
    tips.push(
      `Omset hari ini Rp ${fmt(actualOmset)} masih di bawah target Rp ${fmt(snapshot.targetOmset)}. Fokus closing order & layanan cepat.`
    );
  }

  tips.push(`Alokasikan ${snapshot.headcount} SDM di jam sibuk (11:00–14:00 & 18:00–20:00).`);

  return {
    summary: buildRatioExplanation(snapshot),
    ratioExplanation: `(Biaya SDM Rp ${fmt(snapshot.sdmCost)} ÷ Target Omset Rp ${fmt(snapshot.targetOmset)}) × 100% = ${snapshot.ratioLabel}`,
    underTargetAdvice: underTarget
      ? `Omset belum capai target harian Rp ${fmt(snapshot.targetOmset)}. Prioritaskan upselling dan promo menu laris.`
      : "",
    operationalInsight: tagLabels.length || opsNote
      ? `Kondisi pagi: ${[...tagLabels, opsNote].filter(Boolean).join(" · ")}`
      : "",
    tips,
    upselling,
    promoBest,
    promoSlow,
  };
}
