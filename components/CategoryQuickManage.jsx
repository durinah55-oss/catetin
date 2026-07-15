"use client";

import { useState } from "react";
import { Plus, X, Settings2 } from "lucide-react";
import {
  buildNewCategory,
  applyRemoveCategory,
  canEditCategory,
  manageableCategories,
} from "../lib/categoryManage.js";

export default function CategoryQuickManage({
  categories,
  transactions,
  user,
  txType,
  catId,
  onSelectCat,
  mutate,
  onNotify,
  compact = false,
}) {
  const role = user?.role || "kasir";
  const canManage = ["owner", "admin", "kasir", "purchasing"].includes(role);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!canManage) return null;

  const managed = manageableCategories(categories, user, txType).filter((c) => c.active !== false);

  const addCat = () => {
    const built = buildNewCategory({ name, type: txType, user, categories });
    if (!built.ok) {
      onNotify?.(built.error, "error");
      return;
    }
    mutate((d) => {
      d.categories.push(built.category);
    });
    onSelectCat?.(built.category.id);
    setName("");
    onNotify?.(`Kategori "${built.category.name}" ditambahkan.`, "success");
  };

  const removeCat = (id) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat || !canEditCategory(cat, user)) return;
    let plan;
    let nextId = catId;
    mutate((d) => {
      plan = applyRemoveCategory(d, id);
      if (catId === id) {
        nextId = manageableCategories(d.categories, user, txType)[0]?.id || "";
      }
    });
    if (!plan?.ok) {
      onNotify?.(plan?.error || "Gagal menghapus.", "error");
      return;
    }
    if (catId === id) onSelectCat?.(nextId);
    onNotify?.(
      plan.mode === "hidden"
        ? `"${plan.name}" disembunyikan — transaksi lama tetap ada.`
        : `"${plan.name}" dihapus.`,
      "success"
    );
  };

  return (
    <div style={{ marginTop: compact ? 4 : 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 10px",
          borderRadius: 999,
          border: `1px solid ${open ? "var(--brand)" : "var(--line)"}`,
          background: open ? "var(--brand-soft)" : "var(--surface)",
          color: open ? "var(--brand)" : "var(--ink3)",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <Settings2 size={12} />
        {open ? "Selesai atur" : "Atur kategori"}
      </button>

      {open && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "var(--surface2)",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--ink3)", marginBottom: 10, lineHeight: 1.45 }}>
            Tap <b>×</b> untuk hapus. Yang sudah dipakai transaksi hanya disembunyikan — tidak error.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {managed.map((c) => (
              <span
                key={c.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "5px 8px 5px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  color: "var(--ink2)",
                  maxWidth: "100%",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}
                </span>
                {canEditCategory(c, user) && (
                  <button
                    type="button"
                    onClick={() => removeCat(c.id)}
                    title="Hapus kategori"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 99,
                      border: "none",
                      background: "var(--out-soft)",
                      color: "var(--out)",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </span>
            ))}
            {managed.length === 0 && (
              <span style={{ fontSize: 12, color: "var(--ink3)" }}>Belum ada kategori aktif.</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCat()}
              placeholder="Nama kategori baru"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                fontSize: 13,
                color: "var(--ink)",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={addCat}
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                border: "none",
                background: "var(--brand)",
                color: "#fff",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
