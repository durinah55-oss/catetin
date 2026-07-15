// Kelola 13 kategori purchasing resmi — icon, warna, sembunyikan/tampilkan.
// Dirender di dalam Sheet NF3App (z-index sama overlay lain).

"use client";

import { useState } from "react";
import { Pencil, Eye, EyeOff, Trash2, Check, X } from "lucide-react";
import { canDo } from "../lib/rbac";
import { PURCHASING_FINAL_NAMES } from "../lib/purchasingCategories";
import { applyRemoveCategory } from "../lib/categoryManage.js";

const COLOR_OPTIONS = [
  "#1D9E75", "#0F6E56", "#378ADD", "#7F77DD", "#D85A30",
  "#BA7517", "#993C1D", "#E24B4A", "#5F5E5A", "#888780",
];

const ICON_OPTIONS = [
  "shopping-bag", "basket", "flame", "box", "bolt",
  "truck", "tools-kitchen-2", "building", "users",
  "settings", "dots", "cash", "receipt", "package",
];

function CatForm({ initial, onSave, onCancel }) {
  const [icon, setIcon] = useState(initial?.icon || "shopping-bag");
  const [color, setColor] = useState(initial?.color || "#1D9E75");
  const [description, setDescription] = useState(initial?.description || "");

  return (
    <div style={{ background: "var(--surface2)", borderRadius: 14, border: "1px solid var(--line)", padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>{initial?.name}</div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 6 }}>Warna</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {COLOR_OPTIONS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => setColor(hex)}
              style={{
                width: 28, height: 28, borderRadius: "50%", background: hex, border: "none", cursor: "pointer",
                outline: color === hex ? `3px solid ${hex}` : "none", outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 6 }}>Icon</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ICON_OPTIONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              style={{
                width: 36, height: 36, borderRadius: 8, cursor: "pointer",
                border: `1px solid ${icon === ic ? color : "var(--line)"}`,
                background: icon === ic ? color : "var(--surface)",
                color: icon === ic ? "#fff" : "var(--ink3)",
                display: "grid", placeItems: "center",
              }}
            >
              <i className={`ti ti-${ic}`} style={{ fontSize: 16 }} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 6 }}>Panduan staf</div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Contoh: ayam, beras, sayur…"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)",
            background: "var(--surface)", fontSize: 13, color: "var(--ink)", resize: "vertical", fontFamily: "inherit",
          }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button type="button" onClick={() => onSave({ icon, color, description: description.trim() })}
          style={{ padding: 12, borderRadius: 12, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
          Simpan
        </button>
        <button type="button" onClick={onCancel}
          style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontWeight: 600, cursor: "pointer" }}>
          Batal
        </button>
      </div>
    </div>
  );
}

function CatRow({ cat, onEdit, onToggle, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--line)", opacity: cat.active === false ? 0.5 : 1 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cat.color || "#888"}22`, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <i className={`ti ti-${cat.icon || "dots"}`} style={{ fontSize: 17, color: cat.color || "#888" }} aria-hidden="true" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{cat.name}</div>
        {cat.active === false && <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>Disembunyikan dari purchasing</div>}
        {cat.description && <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2, lineHeight: 1.35 }}>{cat.description}</div>}
      </div>
      {confirmDel ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "var(--out-text)", fontWeight: 600 }}>Sembunyikan?</span>
          <button type="button" onClick={() => { onDelete(cat.id); setConfirmDel(false); }} style={actionBtn}><Check size={14} color="var(--out)" /></button>
          <button type="button" onClick={() => setConfirmDel(false)} style={actionBtn}><X size={14} /></button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button type="button" onClick={() => onEdit(cat)} title="Edit icon & warna" style={actionBtn}><Pencil size={14} /></button>
          <button type="button" onClick={() => onToggle(cat.id)} title={cat.active === false ? "Tampilkan" : "Sembunyikan"} style={actionBtn}>
            {cat.active === false ? <Eye size={14} color="var(--in)" /> : <EyeOff size={14} />}
          </button>
          <button type="button" onClick={() => setConfirmDel(true)} title="Sembunyikan / hapus" style={actionBtn}><Trash2 size={14} color="var(--out)" /></button>
        </div>
      )}
    </div>
  );
}

const actionBtn = {
  width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)",
  background: "var(--surface)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink3)",
};

export default function KategoriPurchasing({ s, mutate }) {
  const role = s.currentUser?.role || "kasir";

  if (!canDo(role, "kelolaKategoriSemua")) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--ink3)", fontSize: 14 }}>
        Hanya owner/admin yang bisa mengakses halaman ini.
      </div>
    );
  }

  const cats = (s.categories || [])
    .filter((c) => c.type === "out" && c.role === "purchasing" && PURCHASING_FINAL_NAMES.has((c.name || "").trim().toLowerCase()))
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));

  const [editCat, setEditCat] = useState(null);
  const [msg, setMsg] = useState("");

  function handleEdit(fields) {
    mutate((d) => {
      const idx = d.categories.findIndex((c) => c.id === editCat.id);
      if (idx >= 0) d.categories[idx] = { ...d.categories[idx], ...fields };
    });
    setEditCat(null);
    setMsg("Perubahan disimpan — menyinkron ke awan…");
  }

  function handleToggle(id) {
    mutate((d) => {
      const c = d.categories.find((x) => x.id === id);
      if (c) c.active = c.active === false ? true : false;
    });
    setMsg("");
  }

  function handleDelete(id) {
    let plan;
    mutate((d) => {
      plan = applyRemoveCategory(d, id);
    });
    setMsg(
      plan?.mode === "hidden"
        ? `"${plan.name}" disembunyikan — transaksi lama tetap aman.`
        : plan?.ok
          ? `"${plan.name}" dihapus.`
          : ""
    );
  }

  return (
    <div style={{ padding: "16px 16px 40px" }}>
      <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 14, padding: "12px 14px", background: "var(--brand-soft)", borderRadius: 12, lineHeight: 1.5 }}>
        13 kelompok belanja resmi untuk purchasing. Untuk <b>tambah/hapus kategori umum</b> pakai <b>Kelola Kategori</b> atau <b>Atur kategori</b> di Catat Transaksi.
      </div>

      {msg && (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "var(--in-soft)", color: "var(--in-text)", fontSize: 12 }}>
          {msg}
        </div>
      )}

      {editCat && (
        <CatForm
          initial={editCat}
          onSave={handleEdit}
          onCancel={() => setEditCat(null)}
        />
      )}

      {cats.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink3)", fontSize: 13 }}>
          Kategori belum dimuat — tarik refresh atau buka ulang app setelah sync.
        </div>
      ) : (
        cats.map((cat) => (
          <CatRow
            key={cat.id}
            cat={cat}
            onEdit={(c) => { setEditCat(c); setMsg(""); }}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))
      )}
    </div>
  );
}
