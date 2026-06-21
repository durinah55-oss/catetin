// lib/purchasingAiContext.js — ringkas transaksi purchasing untuk konteks AI (sempit, bukan seluruh app_state)

import { isPurchasingTx, formatRupiah } from "./purchasingExpense.js";
import { localISO } from "./laporanKeuangan.js";

const MAX_TOP_ITEMS = 12;
const MAX_TOP_SUPPLIERS = 8;
const MAX_TOP_CATEGORIES = 8;
const MAX_RECENT_TX = 8;
const MAX_ITEM_PURCHASES = 80;

const QUERY_STOP = new Set([
  "apa", "yang", "di", "ke", "dari", "dan", "atau", "the", "ada", "berapa", "harga",
  "terakhir", "beli", "mana", "siapa", "supplier", "kapan", "dimana", "dmn", "brp",
]);

function questionTokens(question) {
  return String(question || "")
    .toLowerCase()
    .split(/[^a-z0-9\u00C0-\u024F]+/i)
    .filter((t) => t.length >= 2 && !QUERY_STOP.has(t));
}

function scoreItemMatch(name, q, tokens) {
  const n = name.toLowerCase();
  let score = 0;
  if (q.length >= 4 && n.includes(q)) score += 25;

  let matched = 0;
  for (const t of tokens) {
    if (n.includes(t)) matched++;
  }
  score += matched * 6;

  if (tokens.length >= 2) {
    if (matched === tokens.length) score += 18;
    else if (matched < 2) score -= 15;
  } else if (tokens.length === 1 && matched === 1) {
    score += 4;
  }

  return score;
}

function scoreWithAliases(p, q, tokens) {
  let score = scoreItemMatch(p.item, q, tokens);
  if (p.aliases?.length) {
    for (const alias of p.aliases) {
      score = Math.max(score, scoreItemMatch(alias, q, tokens));
    }
  }
  return score;
}

/** Cari pembelian item yang cocok dengan pertanyaan (termasuk alias approved) */
export function searchItemPurchases(context, question) {
  const items = context?.itemPurchases || [];
  const q = String(question || "").toLowerCase().trim();
  const tokens = questionTokens(q);

  const scored = items
    .map((p) => ({ ...p, score: scoreWithAliases(p, q, tokens) }))
    .filter((p) => p.score >= 8);

  const byGroup = new Map();
  for (const p of scored) {
    const g = p.canonicalGroup || p.item.toLowerCase();
    const prev = byGroup.get(g);
    if (!prev || p.score > prev.score || p.date > prev.date) byGroup.set(g, p);
  }

  return [...byGroup.values()].sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
}

function isoOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localISO(d);
}

function itemsDetailFromTx(t) {
  const items = t.meta?.items || [];
  if (items.length) {
    return items
      .filter((i) => i?.name)
      .map((i) => {
        const qty = Number(i.qty) || 0;
        const unitPrice = Number(i.unitPrice) || 0;
        const subtotal = Math.round(Number(i.subtotal) || qty * unitPrice || 0);
        return {
          name: String(i.name).trim().toLowerCase(),
          displayName: String(i.name).trim(),
          subtotal,
          unitPrice: unitPrice || null,
          qty: qty || null,
          unit: i.unit || null,
        };
      });
  }
  const desc = (t.desc || t.description || "").trim();
  if (desc) {
    return [{
      name: desc.toLowerCase(),
      displayName: desc,
      subtotal: Math.round(Number(t.amount) || 0),
      unitPrice: null,
      qty: null,
      unit: null,
    }];
  }
  return [];
}

function bumpMap(map, key, amount) {
  if (!key) return;
  const prev = map.get(key) || { total: 0, count: 0 };
  prev.total += amount;
  prev.count += 1;
  map.set(key, prev);
}

/**
 * Bangun snapshot purchasing yang ringkas — hanya dari transaksi purchasing.
 */
export function buildPurchasingAiContext({ transactions = [], categories = [], days = 30, outlet = "all" } = {}) {
  const end = localISO(new Date());
  const start = isoOffset(-(days - 1));

  const catMap = Object.fromEntries((categories || []).map((c) => [c.id, c.name]));

  const txs = (transactions || [])
    .filter((t) => {
      if (!isPurchasingTx(t)) return false;
      if (t.date < start || t.date > end) return false;
      if (outlet && outlet !== "all" && t.outlet !== outlet) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));

  const totalSpend = txs.reduce((s, t) => s + (t.amount || 0), 0);
  const byCategory = new Map();
  const byOutlet = new Map();
  const bySupplier = new Map();
  const byItem = new Map();
  /** @type {Map<string, object>} */
  const itemLast = new Map();

  for (const t of txs) {
    const amt = t.amount || 0;
    const catName = catMap[t.categoryId] || catMap[t.category_id] || "Tanpa kategori";
    bumpMap(byCategory, catName, amt);
    bumpMap(byOutlet, t.outlet || "—", amt);
    if (t.supplier) bumpMap(bySupplier, t.supplier, amt);

    for (const it of itemsDetailFromTx(t)) {
      bumpMap(byItem, it.name, it.subtotal || amt);
      if (!itemLast.has(it.name)) {
        itemLast.set(it.name, {
          item: it.displayName,
          date: t.date,
          supplier: t.supplier || "—",
          outlet: t.outlet || "—",
          txAmount: amt,
          unitPrice: it.unitPrice,
          qty: it.qty,
          unit: it.unit,
          lineSubtotal: it.subtotal,
        });
      }
    }
  }

  const topN = (map, n, labelKey = "name") =>
    [...map.entries()]
      .map(([name, v]) => ({ [labelKey]: name, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, n);

  const itemPurchases = [...itemLast.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_ITEM_PURCHASES);

  const recent = txs.slice(0, MAX_RECENT_TX).map((t) => ({
    date: t.date,
    outlet: t.outlet || "—",
    amount: t.amount,
    supplier: t.supplier || null,
    category: catMap[t.categoryId] || catMap[t.category_id] || "—",
    items: (t.meta?.items || []).slice(0, 5).map((i) => i.name).filter(Boolean),
    note: (t.desc || "").slice(0, 80) || null,
  }));

  return {
    scope: "purchasing_only",
    period: { from: start, to: end, days },
    outletFilter: outlet === "all" ? "Semua outlet" : outlet,
    summary: {
      transactionCount: txs.length,
      totalSpend,
      totalSpendLabel: formatRupiah(totalSpend),
      avgPerTx: txs.length ? Math.round(totalSpend / txs.length) : 0,
    },
    byCategory: topN(byCategory, MAX_TOP_CATEGORIES),
    byOutlet: topN(byOutlet, 5),
    bySupplier: topN(bySupplier, MAX_TOP_SUPPLIERS),
    topItems: topN(byItem, MAX_TOP_ITEMS),
    itemPurchases,
    recentTransactions: recent,
  };
}

function formatItemAnswer(p) {
  const pricePart = p.unitPrice
    ? `harga satuan ${formatRupiah(p.unitPrice)}${p.qty ? ` (${p.qty} ${p.unit || "pcs"})` : ""}`
    : `total transaksi ${formatRupiah(p.txAmount)}`;
  return `${p.item}: terakhir ${p.date} dari **${p.supplier}** (outlet ${p.outlet}), ${pricePart}.`;
}

/** Pertanyaan yang bisa dijawab dari data tanpa memanggil Claude */
export function shouldAnswerLocally(context, question) {
  const q = String(question || "").trim();
  if (!q) return false;
  if (searchItemPurchases(context, q).length > 0) return true;
  if (/supplier.*(terbesar|banyak|top)|supplier mana.*(paling|terbesar)/i.test(q) && context?.bySupplier?.length) {
    return true;
  }
  if (/outlet.*(tinggi|terbesar|banyak|paling)|outlet mana/i.test(q) && context?.byOutlet?.length) {
    return true;
  }
  if (
    /(total|berapa).*(belanja|purchasing|pengeluaran)|pengeluaran purchasing/i.test(q) &&
    (context?.summary?.transactionCount ?? 0) > 0
  ) {
    return true;
  }
  return false;
}

/** Snapshot minimal untuk prompt Claude — bukan seluruh itemPurchases */
export function compactPurchasingContextForAi(context, question) {
  const matches = searchItemPurchases(context, question);
  const compact = {
    scope: context.scope,
    period: context.period,
    outletFilter: context.outletFilter,
    summary: context.summary,
    byCategory: (context.byCategory || []).slice(0, 5),
    byOutlet: (context.byOutlet || []).slice(0, 3),
    bySupplier: (context.bySupplier || []).slice(0, 5),
    topItems: (context.topItems || []).slice(0, 6),
    recentTransactions: (context.recentTransactions || []).slice(0, 4),
  };

  if (matches.length) {
    compact.matchedItems = matches.slice(0, 4).map((m) => ({
      item: m.item,
      date: m.date,
      supplier: m.supplier,
      outlet: m.outlet,
      unitPrice: m.unitPrice,
      qty: m.qty,
      unit: m.unit,
      txAmount: m.txAmount,
    }));
  } else {
    compact.recentItemBuys = (context.itemPurchases || []).slice(0, 12).map((p) => ({
      item: p.item,
      date: p.date,
      supplier: p.supplier,
      outlet: p.outlet,
      unitPrice: p.unitPrice,
    }));
  }

  return compact;
}

/** Jawaban lokal dari data — tanpa Claude */
export function fallbackPurchasingAdvice(context, question) {
  const q = String(question || "").trim();
  const s = context?.summary || {};
  const matches = searchItemPurchases(context, q);

  if (/supplier.*(terbesar|banyak|top)|supplier mana.*(paling|terbesar)/i.test(q) && context?.bySupplier?.length) {
    const top = context.bySupplier.slice(0, 3);
    return {
      answer: `Supplier pengeluaran terbesar (${context.period.from} s/d ${context.period.to}): ${top
        .map((x, i) => `${i + 1}. ${x.name} ${formatRupiah(x.total)} (${x.count} tx)`)
        .join("; ")}.`,
      highlights: top.map((x) => `${x.name}: ${formatRupiah(x.total)}`),
      actionHint: "",
      source: "local",
      question: q,
    };
  }

  if (/outlet.*(tinggi|terbesar|banyak|paling)|outlet mana/i.test(q) && context?.byOutlet?.length) {
    const top = context.byOutlet.slice(0, 3);
    return {
      answer: `Outlet belanja tertinggi (${context.period.from} s/d ${context.period.to}): ${top
        .map((x, i) => `${i + 1}. ${x.name} ${formatRupiah(x.total)} (${x.count} tx)`)
        .join("; ")}.`,
      highlights: top.map((x) => `${x.name}: ${formatRupiah(x.total)}`),
      actionHint: "",
      source: "local",
      question: q,
    };
  }

  if (
    /(total|berapa).*(belanja|purchasing|pengeluaran)|pengeluaran purchasing/i.test(q) &&
    (s.transactionCount ?? 0) > 0
  ) {
    return {
      answer: `Total pengeluaran purchasing ${context.period.from} s/d ${context.period.to}: ${s.totalSpendLabel} dari ${s.transactionCount} transaksi (rata-rata ${formatRupiah(s.avgPerTx)}/tx).`,
      highlights: [`${s.transactionCount} transaksi`, s.totalSpendLabel],
      actionHint: "",
      source: "local",
      question: q,
    };
  }

  if (matches.length) {
    const best = matches[0];
    const also = matches.slice(1, 3);
    let answer = formatItemAnswer(best).replace(/\*\*/g, "");
    if (/beli di mana|supplier|dari mana|siapa/i.test(q)) {
      answer = `${best.item} terakhir dibeli dari ${best.supplier} (${best.date}, outlet ${best.outlet}).`;
    } else if (/harga|berapa/i.test(q)) {
      answer = best.unitPrice
        ? `Harga terakhir ${best.item}: ${formatRupiah(best.unitPrice)} per ${best.unit || "pcs"} (${best.date}, ${best.supplier}). Total baris: ${formatRupiah(best.lineSubtotal || best.txAmount)}.`
        : `Pembelian terakhir ${best.item}: ${formatRupiah(best.txAmount)} (${best.date}, ${best.supplier}).`;
    }
    if (also.length) {
      answer += ` Varian serupa: ${also.map((x) => x.item).join(", ")}.`;
    }
    return {
      answer,
      highlights: matches.slice(0, 3).map((m) => `${m.item} → ${m.supplier} (${m.date})`),
      actionHint: matches.length > 1 ? "Bandingkan supplier varian serupa sebelum order berikutnya." : "",
      source: "local",
      question: q,
    };
  }

  const topSup = context?.bySupplier?.[0];
  const topOutlet = context?.byOutlet?.[0];
  let answer = `Dari ${s.transactionCount || 0} transaksi purchasing (${context?.period?.from} s/d ${context?.period?.to}), tidak ada item yang cocok dengan "${q}".`;
  if (topSup) answer += ` Supplier terbesar periode ini: ${topSup.name} (${formatRupiah(topSup.total)}).`;
  if (topOutlet) answer += ` Outlet terbesar: ${topOutlet.name}.`;
  answer += " Coba sebut nama barang lebih spesifik, atau perluas periode ke 90 hari.";

  return {
    answer,
    highlights: [
      topSup ? `Supplier: ${topSup.name}` : null,
      topOutlet ? `Outlet: ${topOutlet.name}` : null,
    ].filter(Boolean),
    source: "local",
    question: q,
  };
}

export const PURCHASING_QUICK_PROMPTS = [
  "ayam paha fillet beli di mana?",
  "berapa harga terakhir gas ijo?",
  "thermal gede supplier siapa?",
  "Supplier mana pengeluaran terbesar?",
  "Outlet mana belanjanya paling tinggi?",
];
