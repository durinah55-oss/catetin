"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { searchNfPurchasingTransactions, NF_BELANJA_QUICK_SEARCH } from "../lib/nfPurchasingSearch";

function Card({ children, style }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, ...style }}>
      {children}
    </div>
  );
}

export default function NfBelanjaSearch({ transactions, categories, wallets, currency, onClose, fmtMoney, shortDate, walletLabel }) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchNfPurchasingTransactions(transactions, categories, query, { limit: 40 }),
    [transactions, categories, query]
  );

  const walletName = (id) => walletLabel?.(id) || wallets?.find((w) => w.id === id)?.name || "Dompet";

  return (
    <div style={{ padding: "0 0 24px" }}>
      <div style={{ padding: "12px 16px 8px" }}>
        <div style={{ fontSize: 13, color: "var(--ink3)", lineHeight: 1.45 }}>
          Cari dari keterangan & kategori belanja Anda. Isi deskripsi saat catat supaya mudah ditemukan lagi.
        </div>
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface2)" }}>
          <Search size={18} color="var(--ink3)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Contoh: beli dimana packing, shopee, ongkir…"
            autoFocus
            style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: "var(--ink)", outline: "none" }}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", padding: 0 }}>
              <X size={16} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {NF_BELANJA_QUICK_SEARCH.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setQuery(chip)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 10px",
                borderRadius: 99,
                border: "1px solid var(--line)",
                background: query === chip ? "var(--brand-soft)" : "var(--surface)",
                color: query === chip ? "var(--brand)" : "var(--ink3)",
                cursor: "pointer",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {!query.trim() && (
          <div style={{ textAlign: "center", color: "var(--ink3)", fontSize: 13, padding: "28px 12px" }}>
            Ketik nama barang, toko, atau kategori
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--ink3)", fontSize: 13, padding: "28px 12px" }}>
            Tidak ada belanja cocok. Coba kata lain atau cek deskripsi transaksi.
          </div>
        )}
        {results.map((t) => (
          <Card key={t.id} style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{t.desc || t._catName || "Belanja"}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4 }}>
                  {t._catName || "Pengeluaran"} · {walletName(t.walletId)} · {shortDate(t.date)}
                </div>
              </div>
              <div className="money" style={{ fontWeight: 800, fontSize: 14, color: "var(--out-text)", whiteSpace: "nowrap" }}>
                −{fmtMoney(t.amount, currency)}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
