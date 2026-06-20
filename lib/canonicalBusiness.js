// Bisnis utama NF3 — semua staf & owner harus pakai ini agar dompet/transaksi nyambung.

export const CANONICAL_BUSINESS_ID =
  process.env.NEXT_PUBLIC_CANONICAL_BUSINESS_ID ||
  "e23ed572-234c-4995-acad-fa6bff7c58d2";

export const CANONICAL_SLUG = "nusa-food";

/** Nama tampilan seragam di UI (NF3 = nama produk, Nusa Food = entitas bisnis). */
export const CANONICAL_DISPLAY_NAME = "Nusa Food";

export function isCanonicalBusiness(biz) {
  if (!biz) return false;
  return biz.id === CANONICAL_BUSINESS_ID || biz.slug === CANONICAL_SLUG;
}

export function findCanonicalInList(list) {
  if (!list?.length) return null;
  return (
    list.find((b) => b.id === CANONICAL_BUSINESS_ID) ||
    list.find((b) => b.slug === CANONICAL_SLUG) ||
    null
  );
}

/** Satu bisnis di UI jika user sudah anggota Nusa Food — hindari switch ke duplikat F&B/NF3. */
export function filterBusinessesForUi(list) {
  if (!list?.length) return list;
  const canonical = findCanonicalInList(list);
  if (canonical) return [canonical];
  return list;
}

export function resolveBusinessDisplayName(biz) {
  if (isCanonicalBusiness(biz)) return CANONICAL_DISPLAY_NAME;
  return biz?.name || CANONICAL_DISPLAY_NAME;
}

/**
 * Pilih bisnis aktif: Nusa Food selalu di atas duplikat owner/F&B/NF3.
 * ?biz= hanya dihormati jika user belum punya keanggotaan canonical.
 */
export function pickDefaultBusinessId(list, { bizParam, storedId } = {}) {
  if (!list?.length) return null;

  const canonical = findCanonicalInList(list);
  const hasCanonical = !!canonical;

  if (bizParam && list.some((b) => b.id === bizParam)) {
    if (!hasCanonical || bizParam === canonical.id) return bizParam;
    return canonical.id;
  }

  if (hasCanonical) return canonical.id;

  if (storedId && list.some((b) => b.id === storedId)) return storedId;

  const asStaff = list.filter((b) => b.role !== "owner");
  if (asStaff.length) return asStaff[0].id;

  return list[0].id;
}
