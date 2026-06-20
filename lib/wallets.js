// lib/wallets.js — katalog dompet, rename migrasi, urutan tampilan

/** Patch nama/warna dompet digital food (ID tetap — transaksi lama aman). */
export const FOOD_WALLET_PATCH = {
  w_pm: { name: "Shopee Food", color: "#EE4D2D", type: "digital" },
  w_nf: { name: "Grab Food", color: "#00B14F", type: "digital" },
};

export const DEFAULT_GO_FOOD_WALLET = {
  id: "w_gofood",
  name: "Go Food",
  type: "digital",
  outlet: null,
  color: "#00AA13",
  opening: 0,
  floor: 0,
  active: true,
  sort: 52,
};

/** Channel omset → dompet settle (food delivery). */
export const FOOD_CHANNEL_SETTLE = {
  shopee: "w_pm",
  shopefood: "w_pm",
  grab: "w_nf",
  grabfood: "w_nf",
  gofood: "w_gofood",
  ojek_online: "w_gofood",
};

export function sortWallets(wallets) {
  return [...(wallets || [])].sort((a, b) => {
    const sa = a.sort ?? 9999;
    const sb = b.sort ?? 9999;
    if (sa !== sb) return sa - sb;
    return (a.name || "").localeCompare(b.name || "", "id");
  });
}

/** Tambah Go Food, rename PM/NF, isi sort bila kosong. */
export function patchWalletCatalog(wallets) {
  const byId = new Map((wallets || []).map((w) => [w.id, { ...w }]));

  for (const [id, patch] of Object.entries(FOOD_WALLET_PATCH)) {
    const w = byId.get(id);
    if (w) Object.assign(w, patch);
  }

  if (!byId.has("w_gofood")) {
    byId.set("w_gofood", { ...DEFAULT_GO_FOOD_WALLET });
  }

  const list = [...byId.values()];
  list.forEach((w, i) => {
    if (w.sort == null || w.sort === undefined) w.sort = (i + 1) * 10;
  });
  return sortWallets(list);
}

/** Perbarui settleWallet channel food di data tersimpan. */
export function migrateReportChannelSettles(reportChannels) {
  if (!reportChannels || typeof reportChannels !== "object") return reportChannels;
  const out = { ...reportChannels };
  for (const outlet of Object.keys(out)) {
    const channels = out[outlet];
    if (!Array.isArray(channels)) continue;
    out[outlet] = channels.map((ch) => {
      if (ch?.role !== "channel") return ch;
      const target = FOOD_CHANNEL_SETTLE[ch.id];
      if (target && ch.settleWallet !== target) {
        return { ...ch, settleWallet: target };
      }
      return ch;
    });
  }
  return out;
}

export function settleWalletOptionsFromWallets(wallets) {
  const bank = sortWallets(wallets).filter((w) => w.type === "rekening" && w.active !== false);
  const digital = sortWallets(wallets).filter((w) =>
    w.active !== false && (w.type === "digital" || w.id === "w_gofood" || w.id === "w_pm" || w.id === "w_nf")
  );
  return [
    ...bank.map((w) => ({ id: w.id, label: w.name })),
    ...digital.map((w) => ({ id: w.id, label: w.name })),
  ];
}
