"use client";
// Root — tangkap token reset dari email (hash hilang jika langsung redirect server-side).

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { redirectRecoveryTokensIfPresent } from "../lib/resetPasswordPage.jsx";

export default function Root() {
  const router = useRouter();

  useEffect(() => {
    if (redirectRecoveryTokensIfPresent()) return;
    router.replace("/dashboard");
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F0F0F8", color: "#6B7280", fontSize: 14 }}>
      Memuat NF3…
    </div>
  );
}
