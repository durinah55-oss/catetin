"use client";
// app/(app)/settings/purchasing-aliases/page.jsx — route standalone (tetap dalam BusinessProvider)

import { useApp } from "../../../../components/layout/BusinessProvider";
import PurchasingAliasesReview from "../../../../components/PurchasingAliasesReview";

export default function PurchasingAliasesPage() {
  const { bizId, s, session, loading } = useApp();

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Memuat…</div>
    );
  }

  return (
    <PurchasingAliasesReview
      bizId={bizId}
      session={session}
      role={s?.currentUser?.role}
    />
  );
}
