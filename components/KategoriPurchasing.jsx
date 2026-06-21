// ============================================================
// components/KategoriPurchasing.jsx
// Kelola kategori purchasing — overlay di NF3App
// Hanya owner/admin yang bisa akses
// ============================================================
// Integrasi di NF3App.jsx:
//
// 1. Import:
//    import KategoriPurchasing from "../../../components/KategoriPurchasing";
//
// 2. Tambah menu di PengaturanScreen (dekat Kelola Kategori):
//    {canDo(role, "kelolaKategoriSemua") && (
//      <SRow icon={ShoppingBag} label="Kategori Purchasing"
//        sub="Kelola kategori belanja purchasing"
//        onClick={() => setOverlay("kategoriPurchasing")} chev />
//    )}
//
// 3. Tambah overlay renderer:
//    {overlay === "kategoriPurchasing" && canDo(user.role, "kelolaKategoriSemua") && (
//      <KategoriPurchasing s={view} mutate={mutate} onClose={() => setOverlay(null)} />
//    )}
// ============================================================

"use client";

import { useState } from "react";
import { canDo } from "../lib/rbac";
import { PURCHASING_FINAL_NAMES } from "../lib/purchasingCategories";

// ------------------------------------------------------------
// Warna pilihan
// ------------------------------------------------------------
const COLOR_OPTIONS = [
  { hex: "#1D9E75", label: "Hijau tua" },
  { hex: "#0F6E56", label: "Hijau gelap" },
  { hex: "#378ADD", label: "Biru" },
  { hex: "#7F77DD", label: "Ungu" },
  { hex: "#D85A30", label: "Oranye" },
  { hex: "#BA7517", label: "Amber" },
  { hex: "#993C1D", label: "Coklat" },
  { hex: "#E24B4A", label: "Merah" },
  { hex: "#5F5E5A", label: "Abu" },
  { hex: "#888780", label: "Abu muda" },
];

// Icon pilihan (Tabler icon names)
const ICON_OPTIONS = [
  "shopping-bag", "basket", "flame", "box", "bolt",
  "truck", "tools-kitchen-2", "building", "users",
  "settings", "dots", "cash", "receipt", "package",
  "salad", "meat", "fish", "bottle", "droplet",
];

// ------------------------------------------------------------
// Form tambah / edit kategori
// ------------------------------------------------------------
function CatForm({ initial, onSave, onCancel }) {
  const [name,  setName]  = useState(initial?.name  || "");
  const [icon,  setIcon]  = useState(initial?.icon  || "shopping-bag");
  const [color, setColor] = useState(initial?.color || "#1D9E75");

  const canSubmit = name.trim() !== "";

  return (
    <div style={styles.formCard}>
      {/* Nama */}
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Nama kategori <span style={{ color: "#e24b4a" }}>*</span></label>
        <input
          style={styles.inp}
          placeholder="Misal: Bumbu & Rempah"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
      </div>

      {/* Warna */}
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Warna</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {COLOR_OPTIONS.map(c => (
            <button
              key={c.hex}
              title={c.label}
              onClick={() => setColor(c.hex)}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: c.hex, border: "none", cursor: "pointer",
                outline: color === c.hex ? `3px solid ${c.hex}` : "none",
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>

      {/* Icon */}
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Icon</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ICON_OPTIONS.map(ic => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              style={{
                ...styles.iconPill,
                background: icon === ic ? color : "var(--color-background-secondary, #f9f9f9)",
                borderColor: icon === ic ? color : "#e0e0e0",
                color: icon === ic ? "#fff" : "#888",
              }}
            >
              <i className={`ti ti-${ic}`} style={{ fontSize: 16 }} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Preview</label>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 20, background: color + "22", border: `0.5px solid ${color}` }}>
          <i className={`ti ti-${icon}`} style={{ fontSize: 15, color }} aria-hidden="true" />
          <span style={{ fontSize: 13, fontWeight: 500, color }}>{name || "Nama kategori"}</span>
        </div>
      </div>

      {/* Aksi */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          style={{ ...styles.btnPrimary, flex: 1, opacity: canSubmit ? 1 : 0.4 }}
          disabled={!canSubmit}
          onClick={() => onSave({ name: name.trim(), icon, color })}
        >
          {initial ? "Simpan perubahan" : "Tambah kategori"}
        </button>
        <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={onCancel}>
          Batal
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Baris kategori
// ------------------------------------------------------------
function CatRow({ cat, onEdit, onToggle, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div style={{ ...styles.catRow, opacity: cat.active === false ? 0.45 : 1 }}>
      {/* Icon + nama */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: (cat.color || "#888") + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className={`ti ti-${cat.icon || "dots"}`} style={{ fontSize: 17, color: cat.color || "#888" }} aria-hidden="true" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{cat.name}</div>
          {cat.active === false && (
            <div style={{ fontSize: 11, color: "#aaa" }}>Nonaktif</div>
          )}
        </div>
      </div>

      {/* Aksi */}
      {confirmDel
        ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#e24b4a" }}>Hapus?</span>
            <button style={styles.actionBtn} onClick={() => onDelete(cat.id)}>Ya</button>
            <button style={styles.actionBtn} onClick={() => setConfirmDel(false)}>Tidak</button>
          </div>
        )
        : (
          <div style={{ display: "flex", gap: 4 }}>
            <button style={styles.actionBtn} onClick={() => onEdit(cat)} title="Edit">
              <i className="ti ti-edit" style={{ fontSize: 15 }} aria-hidden="true" />
            </button>
            <button
              style={{ ...styles.actionBtn, color: cat.active === false ? "#1D9E75" : "#888" }}
              onClick={() => onToggle(cat.id)}
              title={cat.active === false ? "Aktifkan" : "Nonaktifkan"}
            >
              <i className={`ti ti-${cat.active === false ? "eye" : "eye-off"}`} style={{ fontSize: 15 }} aria-hidden="true" />
            </button>
            <button
              style={{ ...styles.actionBtn, color: "#e24b4a" }}
              onClick={() => setConfirmDel(true)}
              title="Hapus"
            >
              <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true" />
            </button>
          </div>
        )
      }
    </div>
  );
}

// ------------------------------------------------------------
// KOMPONEN UTAMA
// ------------------------------------------------------------
export default function KategoriPurchasing({ s, mutate, onClose }) {
  const role = s.currentUser?.role || "kasir";

  // Guard — hanya owner/admin
  if (!canDo(role, "kelolaKategoriSemua")) {
    return (
      <div style={styles.overlay}>
        <div style={styles.sheet}>
          <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
            Hanya owner/admin yang bisa mengakses halaman ini.
          </div>
        </div>
      </div>
    );
  }

  // Ambil kategori purchasing dari app_state
  const cats = (s.categories || []).filter(c =>
    c.type === "out" && c.role === "purchasing"
    && PURCHASING_FINAL_NAMES.has((c.name || "").trim().toLowerCase())
  ).sort((a, b) => (a.sort || 0) - (b.sort || 0));

  const [showForm, setShowForm] = useState(false);
  const [editCat,  setEditCat]  = useState(null); // null = tambah baru, object = edit

  // ------------------------------------------------------------
  // CRUD — semua lewat mutate → app_state (pola CatScreen NF3)
  // ------------------------------------------------------------
  function handleAdd(fields) {
    mutate(d => {
      const maxSort = Math.max(0, ...d.categories.filter(c => c.role === "purchasing").map(c => c.sort || 0));
      d.categories.push({
        id:     "c" + Date.now(),
        type:   "out",
        role:   "purchasing",
        active: true,
        sort:   maxSort + 1,
        ...fields,
      });
    });
    setShowForm(false);
  }

  function handleEdit(fields) {
    mutate(d => {
      const idx = d.categories.findIndex(c => c.id === editCat.id);
      if (idx >= 0) d.categories[idx] = { ...d.categories[idx], ...fields };
    });
    setEditCat(null);
  }

  function handleToggle(id) {
    mutate(d => {
      const c = d.categories.find(x => x.id === id);
      if (c) c.active = c.active === false ? true : false;
    });
  }

  function handleDelete(id) {
    mutate(d => {
      d.categories = d.categories.filter(c => c.id !== id);
    });
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.sheet}>

        {/* Header */}
        <div style={styles.header}>
          <button style={styles.iconBtn} onClick={onClose} aria-label="Tutup">
            <i className="ti ti-arrow-left" aria-hidden="true" />
          </button>
          <span style={styles.headerTitle}>Kategori purchasing</span>
          <div style={{ width: 32 }} />
        </div>

        <div style={styles.body}>

          {/* Form tambah / edit */}
          {(showForm || editCat) && (
            <CatForm
              initial={editCat}
              onSave={editCat ? handleEdit : handleAdd}
              onCancel={() => { setShowForm(false); setEditCat(null); }}
            />
          )}

          {/* Info */}
          {!showForm && !editCat && (
            <div style={styles.infoBox}>
              <i className="ti ti-info-circle" style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: 12, lineHeight: 1.5 }}>
                Hanya 13 kelompok akuntansi resmi (Bahan Baku, Kemasan, dll.). Nama barang seperti &quot;ayam pentung&quot; dicatat di <b>detail item</b> transaksi, bukan di sini.
              </span>
            </div>
          )}

          {/* Daftar kategori */}
          {cats.length === 0 && !showForm && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#bbb" }}>
              <i className="ti ti-tag-off" style={{ fontSize: 32, display: "block", marginBottom: 8 }} aria-hidden="true" />
              <div style={{ fontSize: 13 }}>Kelompok belanja belum dimuat — refresh app atau hubungi admin.</div>
            </div>
          )}

          {cats.map(cat => (
            <CatRow
              key={cat.id}
              cat={cat}
              onEdit={c => { setEditCat(c); setShowForm(false); }}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}

          {/* Tombol tambah di bawah kalau sudah ada kategori */}
          {cats.length > 0 && !showForm && !editCat && (
            <button
              style={styles.addBtn}
              onClick={() => { setEditCat(null); setShowForm(true); }}
            >
              <i className="ti ti-plus" aria-hidden="true" /> Tambah kategori
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// STYLES
// ------------------------------------------------------------
const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 999,
  },
  sheet: {
    background: "#fff", borderRadius: "16px 16px 0 0",
    width: "100%", maxWidth: 480, maxHeight: "88vh",
    display: "flex", flexDirection: "column",
  },
  header: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "14px 16px", borderBottom: "0.5px solid #f0f0f0", flexShrink: 0,
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: 500 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    border: "0.5px solid #e0e0e0", background: "#f9f9f9",
    fontSize: 16, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  body: { overflowY: "auto", padding: "12px 16px 24px", flex: 1 },
  infoBox: {
    display: "flex", alignItems: "flex-start", gap: 8,
    background: "#E6F1FB", border: "0.5px solid #85B7EB",
    borderRadius: 8, padding: "10px 12px",
    color: "#0C447C", marginBottom: 12,
  },
  formCard: {
    background: "#f9f9f9", borderRadius: 12,
    border: "0.5px solid #e0e0e0", padding: 14, marginBottom: 14,
  },
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: 500, color: "#888", display: "block", marginBottom: 5 },
  inp: {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: "0.5px solid #e0e0e0", background: "#fff",
    fontSize: 13, color: "#1a1a1a", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  },
  iconPill: {
    width: 36, height: 36, borderRadius: 8,
    border: "0.5px solid #e0e0e0", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  catRow: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 0", borderBottom: "0.5px solid #f5f5f5",
  },
  actionBtn: {
    width: 30, height: 30, borderRadius: 6,
    border: "0.5px solid #e0e0e0", background: "#f9f9f9",
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", color: "#888", fontSize: 13,
  },
  addBtn: {
    width: "100%", padding: 10, marginTop: 12,
    borderRadius: 8, border: "0.5px dashed #ccc",
    background: "transparent", fontSize: 13, color: "#888",
    cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnPrimary: {
    width: "100%", padding: 11, borderRadius: 8,
    background: "#185FA5", border: "none",
    color: "#fff", fontSize: 13, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnSecondary: {
    width: "100%", padding: 11, borderRadius: 8,
    background: "transparent", border: "0.5px solid #ddd",
    color: "#333", fontSize: 13, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  },
};
