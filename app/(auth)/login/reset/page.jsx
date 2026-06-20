"use client";
// Alias lama → /reset-password (pertahankan link bookmark)

import { useEffect } from "react";

export default function LoginResetRedirect() {
  useEffect(() => {
    window.location.replace(`/reset-password${window.location.search}${window.location.hash}`);
  }, []);
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F0F0F8", color: "#6B7280" }}>
      Mengalihkan…
    </div>
  );
}
