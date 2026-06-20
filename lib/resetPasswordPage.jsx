"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabaseClient";
import { resetPasswordUrl } from "./appUrl.js";

export function resetPasswordRedirectUrl() {
  return resetPasswordUrl();
}

/** Tangkap token recovery dari hash/query di URL mana pun → arahkan ke /reset-password */
export function redirectRecoveryTokensIfPresent() {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  if (path === "/reset-password" || path === "/login/reset") return false;

  const hash = window.location.hash || "";
  const search = window.location.search || "";
  const isRecoveryHash = hash.includes("access_token") || hash.includes("type=recovery");
  const isRecoveryCode = search.includes("code=");

  if (isRecoveryHash || isRecoveryCode) {
    window.location.replace(`/reset-password${search}${hash}`);
    return true;
  }
  return false;
}

function ResetInner() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    const finishCheck = (ok, errorMsg) => {
      if (cancelled) return;
      if (errorMsg) setErr(errorMsg);
      setReady(ok);
      setChecking(false);
    };

    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            finishCheck(false, translateError(error.message));
            return;
          }
          window.history.replaceState({}, "", window.location.pathname);
          finishCheck(true, "");
          return;
        }

        const hash = window.location.hash.replace(/^#/, "");
        if (hash) {
          const hp = new URLSearchParams(hash);
          const access_token = hp.get("access_token");
          const refresh_token = hp.get("refresh_token");
          const type = hp.get("type");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            window.history.replaceState({}, "", window.location.pathname);
            if (error) {
              finishCheck(false, translateError(error.message));
              return;
            }
            if (type && type !== "recovery") {
              finishCheck(false, "Link tidak valid untuk reset password.");
              return;
            }
            finishCheck(true, "");
            return;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          finishCheck(true, "");
          return;
        }

        finishCheck(false, "");
      } catch (e) {
        finishCheck(false, e.message || "Gagal memverifikasi link reset.");
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) {
        setReady(true);
        setChecking(false);
        setErr("");
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (password.length < 6) {
      setErr("Password minimal 6 karakter.");
      return;
    }
    if (password !== password2) {
      setErr("Konfirmasi password tidak sama.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMsg("Password berhasil diubah. Mengalihkan ke dashboard…");
      setTimeout(() => router.replace("/dashboard"), 1200);
    } catch (e2) {
      setErr(translateError(e2.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F0F0F8", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: "#4F46E5" }}>NF3</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>Password baru</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: 28, border: "1px solid #E8E8F0" }}>
          {checking ? (
            <div style={{ textAlign: "center", color: "#6B7280", fontSize: 14, padding: "20px 0" }}>
              Memverifikasi link…
            </div>
          ) : !ready ? (
            <>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16, lineHeight: 1.5 }}>
                {err || "Buka link reset dari email Supabase, atau minta link baru di halaman login."}
              </p>
              <button type="button" onClick={() => router.push("/login?forgot=1")}
                style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", marginBottom: 10,
                  background: "#6366F1", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                Minta link reset password
              </button>
              <button type="button" onClick={() => router.push("/login")}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #E8E8F0",
                  background: "#fff", color: "#6B7280", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                ← Kembali ke login
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 18, lineHeight: 1.5 }}>
                Masukkan password baru untuk akun Anda.
              </p>
              <Field label="Password baru">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter" style={inp} required minLength={6} autoFocus />
              </Field>
              <Field label="Ulangi password">
                <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Ketik ulang password" style={inp} required minLength={6} />
              </Field>
              {err && <Banner color="#B91C1C" bg="#FEE2E2">{err}</Banner>}
              {msg && <Banner color="#15803D" bg="#DCFCE7">{msg}</Banner>}
              <button type="submit" disabled={loading}
                style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", marginTop: 4,
                  background: "#6366F1", color: "#fff", fontWeight: 700, fontSize: 15,
                  cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Menyimpan…" : "Simpan password →"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F0F0F8", color: "#6B7280" }}>
        Memuat…
      </div>
    }>
      <ResetInner />
    </Suspense>
  );
}

function translateError(m = "") {
  if (/session expired|invalid.*token|otp_expired/i.test(m)) {
    return "Link sudah kadaluarsa. Minta link reset baru dari halaman login.";
  }
  if (/password should be at least/i.test(m)) return "Password minimal 6 karakter.";
  return m;
}

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      color: "#9CA3AF", marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);

const Banner = ({ color, bg, children }) => (
  <div style={{ padding: "10px 14px", borderRadius: 10, background: bg, color, fontSize: 13, marginBottom: 14 }}>
    {children}
  </div>
);

const inp = {
  width: "100%", padding: "12px 14px", borderRadius: 12,
  border: "1px solid #E8E8F0", background: "#F9F9FC",
  fontSize: 14, color: "#1A1A2E", outline: "none", boxSizing: "border-box",
};
