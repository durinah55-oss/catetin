// lib/purchasingItemAliases.js — lookup alias barang yang sudah di-approve

function norm(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** @param {Array<{canonical_name:string, alias_name:string}>} rows */
export function buildAliasIndex(rows) {
  const nameToCanonical = new Map();
  const groups = new Map();

  for (const row of rows || []) {
    const canon = norm(row.canonical_name);
    const alias = norm(row.alias_name);
    if (!canon || !alias) continue;

    nameToCanonical.set(canon, canon);
    nameToCanonical.set(alias, canon);

    if (!groups.has(canon)) groups.set(canon, new Set());
    groups.get(canon).add(canon);
    groups.get(canon).add(alias);
  }

  return { nameToCanonical, groups };
}

/** Tambah alias ke konteks AI + perluas itemPurchases dengan canonicalGroup */
export function enrichPurchasingContextWithAliases(context, aliasRows) {
  if (!context || !aliasRows?.length) return context;

  const { nameToCanonical, groups } = buildAliasIndex(aliasRows);
  const aliasList = aliasRows.map((r) => ({
    canonical: r.canonical_name,
    alias: r.alias_name,
  }));

  const itemPurchases = (context.itemPurchases || []).map((p) => {
    const key = norm(p.item);
    const canonicalGroup = nameToCanonical.get(key) || key;
    const aliases = groups.has(canonicalGroup)
      ? [...groups.get(canonicalGroup)]
      : [key];
    return { ...p, canonicalGroup, aliases };
  });

  return {
    ...context,
    itemPurchases,
    approvedAliases: aliasList,
  };
}

/** Resolve nama item ke canonical untuk scoring pencarian */
export function canonicalForItemName(name, nameToCanonical) {
  const key = norm(name);
  return nameToCanonical?.get(key) || key;
}
