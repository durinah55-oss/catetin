-- NF3 — kolom hide_balance untuk dompet (rekening bank dll.)
-- Jalankan di Supabase SQL Editor jika pakai tabel wallets normalisasi.
-- Dashboard NF3 saat ini juga menyimpan flag yang sama di app_state.data.wallets[].hide_balance

alter table public.wallets
  add column if not exists hide_balance boolean not null default false;

comment on column public.wallets.hide_balance is
  'Jika true: staf purchasing boleh pilih dompet & transaksi mengurangi saldo, tapi UI tidak menampilkan angka saldo.';

-- Opsional: tandai rekening bank existing (sesuaikan name/type bisnis Anda)
-- update public.wallets set hide_balance = true where type = 'bank';
