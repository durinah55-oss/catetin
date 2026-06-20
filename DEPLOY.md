# Deploy NF3 — Panduan Lengkap

Dari nol sampai dua bisnis (F&B + NF Nusa Fishing) jalan di server sendiri.

## Estimasi waktu
30–45 menit jika sudah punya akun Supabase dan Vercel.

---

## 1. Supabase — Setup Database

### Buat Project
1. Buka [supabase.com](https://supabase.com) → New project
2. Nama: `nf3` · Region: Singapore (ap-southeast-1)
3. Catat: **Project URL** dan **Anon Key** (Settings → API)

### Jalankan Schema
1. Supabase Dashboard → SQL Editor → New query
2. Paste isi `supabase/schema.sql` → Run
3. Harus muncul: `Success. No rows returned`

### Aktifkan Auth
1. Authentication → Providers → Email → Enable
2. Authentication → URL Configuration:
   - Site URL: `https://catatin.nusafishing.com` (domain rika)
   - Redirect URLs: tambah `https://catatin.nusafishing.com/**`

---

## 2. Next.js — Setup Project

```bash
npx create-next-app@latest nf3 --app --js --no-tailwind --no-eslint
cd nf3
npm install @supabase/supabase-js
```

### Salin file dari paket ini:
```
backend/lib/              →  lib/
backend/app/(auth)/       →  app/(auth)/
backend/app/(app)/        →  app/(app)/
backend/components/       →  components/
nf3.jsx            →  app/(app)/dashboard/NF3App.jsx
```

### .env.local
```
NEXT_PUBLIC_SUPABASE_URL=https://odugkllatrpxjerrjjxo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_s-t0U7kxfBwKKPxdbnDlAw_9H1lLKUM
ANTHROPIC_API_KEY=sb_publishable_s-t0U7kxfBwKKPxdbnDlAw_9H1lLKUM
```

### app/(app)/dashboard/page.jsx
```jsx
"use client";
import { useApp } from "../../../components/layout/BusinessProvider";
import NF3App from "./NF3App";

export default function Dashboard() {
  const { s, mutate, ...actions } = useApp();
  if (!s) return null;
  // Pass s dan actions ke NF3App
  // Ganti window.storage dengan actions dari useApp()
  return <NF3App s={s} mutate={mutate} actions={actions} />;
}
```

### app/layout.jsx
```jsx
import BusinessProvider from "../components/layout/BusinessProvider";
export default function RootLayout({ children }) {
  return (
    <html><body>
      <BusinessProvider>{children}</BusinessProvider>
    </body></html>
  );
}
```

---

## 3. Daftar & Seed Data

### Daftar akun Sam
1. Buka app yang sudah deploy → `/login`
2. Pilih "Daftar" → email: `sampriatna@gmail.com`
3. Konfirmasi email

### Seed bisnis
1. Supabase → SQL Editor
2. Paste `supabase/seed.sql` → Run
3. Harus muncul: `NOTICE: Seed selesai. F&B id: ..., NF id: ...`

Setelah seed, Sam punya:
- Bisnis **NF F&B** dengan 11 dompet + 13 kategori
- Bisnis **NF Nusa Fishing** dengan 4 dompet + 12 kategori
- Switch bisnis via bar ungu di atas app

---

## 4. Undang Staf

### Cara undang kasir KBU
1. Login sebagai Sam → Settings → Undang Staf
2. Isi: email kasir, role = Kasir, outlet = KBU
3. Salin link yang muncul → kirim via WhatsApp
4. Kasir buka link → daftar → langsung terhubung ke F&B, outlet KBU

### Apa yang kasir lihat
- Hanya Laci KBU (dompet outlet sendiri)
- Tidak bisa lihat rekening bank (BCA, BRI, dll)
- Tidak bisa transfer antar dompet
- Tidak bisa kelola dompet/kategori

---

## 5. Deploy ke Vercel

```bash
git init && git add . && git commit -m "init"
```

1. [vercel.com](https://vercel.com) → New Project → Import repo
2. Environment Variables: tambah 3 var dari `.env.local`
3. Deploy → dapat URL `https://nf3.vercel.app`
4. Update Supabase Auth → Site URL ke URL Vercel

### Domain custom (opsional)
Vercel → Domains → tambah `catatin.nusafishing.com`
Ikuti instruksi DNS.

---

## 6. Adaptasi NF3App ke useApp()

File `nf3.jsx` saat ini pakai `window.storage` dan `mutate` lokal.
Ganti bagian ini:

### Sebelum (window.storage):
```js
useEffect(() => { loadState().then(setS); }, []);
useEffect(() => { if (s) saveState(s); }, [s]);
const mutate = useCallback((fn) => setS(...), []);
const addTx = (d) => mutate(...);
```

### Sesudah (useApp):
```js
// Hapus loadState/saveState/mutate lokal
// s dan actions sudah ada dari BusinessProvider
const { s, addTransaction, upsertWallet, ...rest } = useApp();
```

Tabel pemetaan lengkap di `nextjs/SETUP.md`.

---

## Struktur akhir yang berjalan

```
catatin.nusafishing.com
├── /login              — login & daftar
├── /login?invite=TOKEN — staf terima undangan
├── /onboarding         — setup bisnis pertama kali
└── /dashboard?biz=ID   — app utama
      ├── [switch bar]  — NF F&B | NF Nusa Fishing
      ├── Beranda        — dompet + transaksi sesuai role
      ├── Laporan        — P&L per bisnis
      ├── Analisis       — insight otomatis
      └── Profil/Settings
            ├── Undang Staf   (owner/admin)
            ├── Kelola Dompet (owner/admin)
            └── Kelola Kategori (owner/admin)
```

---

## Catatan keamanan

- `ANTHROPIC_API_KEY` hanya di server (tidak ada prefix `NEXT_PUBLIC_`)
- RLS Supabase otomatis blokir akses lintas bisnis
- Rekening bank (`owner_only: true`) hanya muncul untuk Sam
- Token undangan expired otomatis setelah 7 hari
- PIN hash disimpan, bukan plaintext
