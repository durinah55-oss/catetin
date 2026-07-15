// lib/nfPurchasingSearch.js — cari riwayat belanja NF (lokal, tanpa AI)

const STOP = new Set([
  "apa", "yang", "di", "ke", "dari", "dan", "atau", "the", "ada", "berapa", "harga",
  "terakhir", "beli", "mana", "siapa", "kapan", "dimana", "dmn", "brp", "belanja",
]);

function tokens(query) {
  return String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9\u00C0-\u024F]+/i)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function scoreTx(t, q, toks, catName) {
  const desc = String(t?.desc || "").toLowerCase();
  const cat = String(catName || "").toLowerCase();
  const hay = `${desc} ${cat}`;
  let score = 0;
  if (q.length >= 3 && hay.includes(q)) score += 20;
  let matched = 0;
  for (const tok of toks) {
    if (hay.includes(tok)) matched++;
  }
  score += matched * 5;
  if (toks.length >= 2 && matched === toks.length) score += 12;
  return score;
}

/** Filter transaksi keluar milik purchasing NF, urut relevansi lalu tanggal. */
export function searchNfPurchasingTransactions(transactions, categories, query, { limit = 30 } = {}) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return [];
  const toks = tokens(q);
  const catById = new Map((categories || []).map((c) => [c.id, c?.name || ""]));

  const rows = (transactions || [])
    .filter((t) => t && t.type === "out")
    .map((t) => {
      const catName = catById.get(t.categoryId) || "";
      return { t, score: scoreTx(t, q, toks, catName), catName };
    })
    .filter((row) => row.score >= 5)
    .sort((a, b) => b.score - a.score || String(b.t.date || "").localeCompare(String(a.t.date || "")));

  return rows.slice(0, limit).map((row) => ({
    ...row.t,
    _catName: row.catName,
    _score: row.score,
  }));
}

export const NF_BELANJA_QUICK_SEARCH = [
  "shopee",
  "tokopedia",
  "packing",
  "ongkir",
  "modal",
];
