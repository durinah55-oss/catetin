"use client";

import { useEffect, useState } from "react";
import { subscribeActionToast } from "../lib/actionToast";

const TONE = {
  success: { bg: "#ECFDF5", border: "#A7F3D0", color: "#047857" },
  error: { bg: "#FEF2F2", border: "#FECACA", color: "#B91C1C" },
  info: { bg: "#EFF6FF", border: "#BFDBFE", color: "#1D4ED8" },
};

export default function ActionToast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timer;
    return subscribeActionToast((t) => {
      clearTimeout(timer);
      setToast(t);
      timer = setTimeout(() => setToast(null), t.durationMs ?? 3200);
    });
  }, []);

  if (!toast) return null;
  const style = TONE[toast.tone] || TONE.info;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 96,
        zIndex: 9999,
        maxWidth: 360,
        width: "calc(100% - 32px)",
        padding: "12px 16px",
        borderRadius: 14,
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1.45,
        boxShadow: "0 8px 24px rgba(0,0,0,.12)",
        pointerEvents: "none",
      }}
    >
      {toast.message}
    </div>
  );
}
