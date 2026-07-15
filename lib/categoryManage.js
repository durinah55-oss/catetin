// lib/categoryManage.js — tambah/hapus kategori aman (tanpa rusak transaksi lama)

export function createCategoryId() {
  return `c${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
}

export function categoryNameTaken(categories, name, type, { excludeId } = {}) {
  const n = (name || "").trim().toLowerCase();
  if (!n) return false;
  return (categories || []).some(
    (c) =>
      c.id !== excludeId &&
      (c.name || "").trim().toLowerCase() === n &&
      (c.type || "out") === (type || "out")
  );
}

export function categoryUsedByTransactions(categoryId, transactions) {
  return (transactions || []).some((t) => t?.categoryId === categoryId);
}

/** Kategori yang boleh dikelola user saat ini (sama filter Kelola Kategori). */
export function manageableCategories(categories, user, txType) {
  const role = user?.role || "kasir";
  const canManageAll = role === "owner" || role === "admin";
  return (categories || []).filter((c) => {
    if (txType && c.type !== txType) return false;
    if (canManageAll) return true;
    if (c.role !== role) return false;
    if (role === "kasir" && c.outlet && c.outlet !== user.outlet) return false;
    return true;
  });
}

export function canEditCategory(cat, user) {
  const role = user?.role || "kasir";
  if (role === "owner" || role === "admin") return true;
  return cat?.role === role;
}

function defaultCategoryMeta(user, type) {
  if (user?.role === "purchasing") return { role: "purchasing", outlet: null };
  if (user?.role === "kasir") return { role: "kasir", outlet: user.outlet || null };
  return { role: null, outlet: null };
}

/** Tambah kategori baru — return { ok, error?, id? } */
export function buildNewCategory({ name, type, user, categories }) {
  const trimmed = (name || "").trim();
  if (!trimmed) return { ok: false, error: "Nama kategori wajib diisi." };
  if (categoryNameTaken(categories, trimmed, type)) {
    return { ok: false, error: `Kategori "${trimmed}" sudah ada.` };
  }
  const meta = defaultCategoryMeta(user, type);
  const sortBase = (categories || []).filter((c) => c.type === type).length;
  const id = createCategoryId();
  return {
    ok: true,
    id,
    category: {
      id,
      name: trimmed,
      type,
      active: true,
      ...meta,
      sort: (sortBase + 1) * 10,
    },
  };
}

/** Hapus/nonaktifkan — transaksi lama tetap aman. Return { mode: "removed"|"hidden", name } */
export function removeCategoryPlan(category, transactions) {
  if (!category) return { ok: false, error: "Kategori tidak ditemukan." };
  const used = categoryUsedByTransactions(category.id, transactions);
  if (used) {
    return { ok: true, mode: "hidden", name: category.name };
  }
  return { ok: true, mode: "removed", name: category.name };
}

export function applyRemoveCategory(draft, categoryId) {
  const cat = draft.categories.find((c) => c.id === categoryId);
  const plan = removeCategoryPlan(cat, draft.transactions);
  if (!plan.ok) return plan;
  if (plan.mode === "hidden") {
    cat.active = false;
  } else {
    draft.categories = draft.categories.filter((c) => c.id !== categoryId);
  }
  return plan;
}
