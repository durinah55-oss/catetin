// lib/actionToast.js — notifikasi singkat aksi simpan/hapus/upload

const listeners = new Set();

/** @param {'success'|'error'|'info'} tone */
export function showActionToast(message, tone = "success") {
  const payload = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    message: String(message || "").trim(),
    tone,
  };
  if (!payload.message) return payload.id;
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* ignore */
    }
  });
  return payload.id;
}

export function subscribeActionToast(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
