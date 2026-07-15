/** Format error Supabase / PostgREST / JS untuk respons API & UI. */
export function formatApiError(e, fallback = "Terjadi kesalahan") {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  if (e.message && typeof e.message === "string") return e.message;
  if (e.error_description) return String(e.error_description);
  if (e.code && e.details) return `${e.code}: ${e.details}`;
  if (e.hint && e.message) return `${e.message} (${e.hint})`;
  try {
    const s = JSON.stringify(e);
    if (s && s !== "{}") return s;
  } catch { /* ignore */ }
  return fallback;
}
