// lib/nfChannelReport.js — breakdown omzet per channel NF (marketplace vs direct, dll.)

import { filterTransactions } from "./laporanKeuangan.js";
import { nfCategoryById, normalizeNfCategoryId } from "./nfCategoryCatalog.js";
import { NF_CHANNEL_GROUPS, NF_MP_PLATFORMS } from "./nfSalesChannels.js";

function isRevenueKind(kind) {
  return kind === "revenue_net" || kind === "revenue_gross";
}

function sumAmount(txs) {
  return (txs || []).reduce((a, t) => a + (Number(t.amount) || 0), 0);
}

/**
 * Ringkasan omzet per channel kategori & grup (marketplace / direct / …).
 */
export function computeNfChannelBreakdown(transactions, categories, { start, end }) {
  const catMap = nfCategoryById(categories);
  const txs = filterTransactions(transactions, { start, end }).filter((t) => t.type === "in");

  const byCategory = {};
  const byGroup = {};
  const byStore = {};
  let totalRevenue = 0;
  let mpTotal = 0;
  let selfManagedTotal = 0;
  let capitalTotal = 0;

  for (const t of txs) {
    const cat = catMap.get(normalizeNfCategoryId(t.categoryId));
    const kind = cat?.nfKind;
    const amt = Number(t.amount) || 0;
    const group = cat?.channelGroup || null;

    if (kind === "capital_in") {
      capitalTotal += amt;
      continue;
    }
    if (!isRevenueKind(kind)) continue;

    totalRevenue += amt;
    const catId = cat?.id || t.categoryId || "unknown";
    byCategory[catId] = (byCategory[catId] || 0) + amt;

    const g = group || "other";
    byGroup[g] = (byGroup[g] || 0) + amt;

    if (g === "marketplace") mpTotal += amt;
    else if (["direct", "reseller", "maklon"].includes(g)) selfManagedTotal += amt;

    const storeId = t.meta?.storeId;
    if (storeId && g === "marketplace") {
      byStore[storeId] = (byStore[storeId] || 0) + amt;
    }
  }

  const categoryRows = Object.entries(byCategory)
    .map(([id, amount]) => {
      const cat = catMap.get(id);
      return {
        id,
        name: cat?.name || id,
        channelGroup: cat?.channelGroup || "other",
        platformId: cat?.platformId || null,
        amount,
        pct: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const groupRows = Object.entries(byGroup)
    .map(([id, amount]) => ({
      id,
      label: NF_CHANNEL_GROUPS[id]?.label || id,
      amount,
      pct: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
      settlesViaMp: NF_CHANNEL_GROUPS[id]?.settlesViaMp === true,
    }))
    .sort((a, b) => b.amount - a.amount);

  const mpPlatformRows = NF_MP_PLATFORMS.map((p) => {
    const amount = byCategory[p.categoryId] || 0;
    return {
      ...p,
      amount,
      pct: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
    };
  }).filter((r) => r.amount > 0);

  return {
    totalRevenue,
    mpTotal,
    selfManagedTotal,
    capitalTotal,
    mpDependencyPct: totalRevenue > 0 ? (mpTotal / totalRevenue) * 100 : 0,
    selfManagedPct: totalRevenue > 0 ? (selfManagedTotal / totalRevenue) * 100 : 0,
    categoryRows,
    groupRows,
    mpPlatformRows,
    byStore,
  };
}
