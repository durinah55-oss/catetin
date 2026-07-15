// lib/appStateRealtime.js — push perubahan app_state ke semua HP (ganti polling agresif)

import { supabase } from "./supabaseClient.js";

/**
 * Langganan UPDATE app_state untuk bisnis aktif.
 * @param {string} bizId
 * @param {(updatedAt: string | null) => void} onRemoteUpdate
 * @param {(status: string) => void} [onStatus]
 */
export function subscribeAppStateChanges(bizId, onRemoteUpdate, onStatus) {
  if (!bizId) return () => {};

  const channel = supabase
    .channel(`nf3-app-state-${bizId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "app_state",
        filter: `business_id=eq.${bizId}`,
      },
      (payload) => {
        onRemoteUpdate(payload?.new?.updated_at ?? null);
      }
    )
    .subscribe((status) => {
      onStatus?.(status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
