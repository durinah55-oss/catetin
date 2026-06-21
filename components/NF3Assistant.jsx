"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { readStoredSession } from "../lib/authBootstrap";

const ACCENT = {
  KBU: "#C47D0E",
  KSM: "#883224",
  SMT: "#1F6F8B",
  GUDANG: "#5C4D3C",
  semua: "#3B6D11",
};

const SUGGESTIONS = {
  owner: [
    "Outlet mana pengeluaran terbesar bulan ini?",
    "Bandingkan KBU vs KSM 30 hari terakhir",
    "Item apa yang paling sering dibeli?",
  ],
  keuangan: [
    "Total pengeluaran semua outlet bulan ini?",
    "Supplier mana yang paling banyak transaksi?",
    "Rekap per outlet 3 bulan terakhir?",
  ],
  purchasing: [
    "Item apa yang paling sering dibeli bulan ini?",
    "Supplier mana yang paling banyak dipakai?",
    "Pengeluaran purchasing bulan ini berapa?",
  ],
  kasir: [
    "Transaksi terbaru outlet saya apa?",
    "Total pengeluaran outlet saya bulan ini?",
    "Ada transaksi masuk hari ini?",
  ],
};

const ROLE_LABEL = {
  owner: "Owner",
  keuangan: "Keuangan",
  purchasing: "Purchasing",
  kasir: "Kasir",
  admin: "Keuangan",
};

export default function NF3Assistant({ role, outlet, businessId, sessionToken, bottomOffset = 88 }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [txCount, setTxCount] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const assistantRole = role === "admin" ? "keuangan" : role;
  const accent = ACCENT[outlet] ?? ACCENT["semua"];
  const suggestions = SUGGESTIONS[assistantRole] ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: `Halo! Isun NF3 Assistant siap bantu ${ROLE_LABEL[assistantRole] || assistantRole}${outlet !== "semua" ? ` outlet ${outlet}` : ""}. Mau tanya apa?`,
        },
      ]);
    }
  }, [open, assistantRole, outlet, messages.length]);

  const sendMessage = useCallback(
    async (text) => {
      const content = (text ?? input).trim();
      if (!content || loading) return;

      const newMessages = [...messages, { role: "user", content }];
      setMessages(newMessages);
      setInput("");
      setLoading(true);

      try {
        const token = sessionToken || readStoredSession()?.access_token;
        if (!token) throw new Error("Sesi login tidak ditemukan.");

        const apiMessages = newMessages
          .filter((m) => !(m.role === "assistant" && /NF3 Assistant siap bantu/i.test(m.content)))
          .slice(-6);

        const res = await fetch("/api/nf3-assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: apiMessages,
            role: assistantRole,
            outlet,
            businessId,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal menghubungi AI");

        if (data.txCount !== undefined) setTxCount(data.txCount);

        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: data.message ?? "Maaf, ada kesalahan. Coba lagi.",
          },
        ]);
      } catch (e) {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: e.message || "Koneksi AI gagal. Cek jaringan dan coba lagi.",
          },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [messages, input, loading, businessId, sessionToken, assistantRole, outlet]
  );

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    setMessages([]);
    setTimeout(() => {
      setMessages([
        {
          role: "assistant",
          content: "Chat direset. Ada yang bisa dibantu lagi?",
        },
      ]);
    }, 100);
  }

  const pos = { bottom: bottomOffset, right: 24 };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka NF3 Assistant"
          style={{
            position: "fixed",
            ...pos,
            width: 50,
            height: 50,
            borderRadius: "50%",
            background: accent,
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 999,
          }}
        >
          ✦
        </button>
      )}

      {open && (
        <div
          style={{
            position: "fixed",
            ...pos,
            width: 360,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: 580,
            borderRadius: 16,
            background: "#fff",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 999,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              background: accent,
              color: "#fff",
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>NF3 Assistant</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>
                {ROLE_LABEL[assistantRole] || assistantRole} · {outlet === "semua" ? "Semua Outlet" : outlet}
                {txCount !== null && (
                  <span style={{ marginLeft: 6, opacity: 0.7 }}>· {txCount} transaksi</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={clearChat} title="Reset chat" style={headerBtnStyle}>
                ↺
              </button>
              <button type="button" onClick={() => setOpen(false)} title="Tutup" style={headerBtnStyle}>
                ×
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 12px 4px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: "#f7f7f5",
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "84%",
                    padding: "9px 12px",
                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: msg.role === "user" ? accent : "#fff",
                    color: msg.role === "user" ? "#fff" : "#1a1a1a",
                    fontSize: 13,
                    lineHeight: 1.55,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "14px 14px 14px 4px",
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#999",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
                  }}
                >
                  Sedang cek data...
                </div>
              </div>
            )}

            {messages.length === 1 && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    style={{
                      background: "#fff",
                      border: `1px solid ${accent}35`,
                      borderRadius: 10,
                      padding: "8px 12px",
                      fontSize: 12,
                      color: accent,
                      cursor: "pointer",
                      textAlign: "left",
                      lineHeight: 1.4,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderTop: "1px solid #eee",
              background: "#fff",
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              flexShrink: 0,
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Tanya sesuatu..."
              rows={1}
              style={{
                flex: 1,
                border: "1px solid #e0e0e0",
                borderRadius: 10,
                padding: "8px 11px",
                fontSize: 13,
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1.5,
                maxHeight: 80,
                overflowY: "auto",
                background: "#fafafa",
              }}
            />
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{
                background: input.trim() && !loading ? accent : "#d0d0d0",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                width: 36,
                height: 36,
                cursor: input.trim() && !loading ? "pointer" : "default",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              aria-label="Kirim pesan"
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const headerBtnStyle = {
  background: "rgba(255,255,255,0.2)",
  border: "none",
  color: "#fff",
  borderRadius: 8,
  width: 28,
  height: 28,
  cursor: "pointer",
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
