-- ============================================================
-- NF3 Purchasing — Migration Fixed
-- Business: Nusa Food
-- business_id: e23ed572-234c-4995-acad-fa6bff7c58d2
-- ============================================================
-- CATATAN: Insert kategori purchasing diganti oleh
-- purchasing_categories_final.sql — jangan jalankan bagian 4 jika final sudah dijalankan.
-- ============================================================


-- ------------------------------------------------------------
-- 1. ALTER TABLE transactions (kolom baru purchasing)
-- ------------------------------------------------------------

alter table public.transactions
  add column if not exists supplier    text,
  add column if not exists receipt_url text,
  add column if not exists module      text
    check (module in ('purchasing', 'kasir', 'settle') or module is null),
  add column if not exists meta        jsonb default '{}';


-- ------------------------------------------------------------
-- 2. ALTER TABLE categories (tambah kolom role)
-- ------------------------------------------------------------

alter table public.categories
  add column if not exists role text default null;

comment on column public.categories.role is
  'Modul yang pakai kategori ini: purchasing | kasir | null (semua)';


-- ------------------------------------------------------------
-- 3. INDEX
-- ------------------------------------------------------------

create index if not exists idx_transactions_module
  on public.transactions (business_id, module)
  where module is not null;

create index if not exists idx_transactions_outlet
  on public.transactions (business_id, outlet)
  where outlet is not null;


-- ------------------------------------------------------------
-- 4. INSERT kategori purchasing — Nusa Food
-- ------------------------------------------------------------

insert into public.categories
  (business_id, name, type, icon, color, role, active, sort)
values
  ('e23ed572-234c-4995-acad-fa6bff7c58d2', 'Bahan baku',        'out', 'shopping-bag',    '#1D9E75', 'purchasing', true, 1),
  ('e23ed572-234c-4995-acad-fa6bff7c58d2', 'Belanja pasar',     'out', 'basket',          '#0F6E56', 'purchasing', true, 2),
  ('e23ed572-234c-4995-acad-fa6bff7c58d2', 'Gas LPG',           'out', 'flame',           '#D85A30', 'purchasing', true, 3),
  ('e23ed572-234c-4995-acad-fa6bff7c58d2', 'Kemasan & alat',    'out', 'box',             '#BA7517', 'purchasing', true, 4),
  ('e23ed572-234c-4995-acad-fa6bff7c58d2', 'Listrik & air',     'out', 'bolt',            '#378ADD', 'purchasing', true, 5),
  ('e23ed572-234c-4995-acad-fa6bff7c58d2', 'Transport belanja', 'out', 'truck',           '#7F77DD', 'purchasing', true, 6),
  ('e23ed572-234c-4995-acad-fa6bff7c58d2', 'Perlengkapan dapur','out', 'tools-kitchen-2', '#993C1D', 'purchasing', true, 7),
  ('e23ed572-234c-4995-acad-fa6bff7c58d2', 'Sewa tempat',       'out', 'building',        '#5F5E5A', 'purchasing', true, 8),
  ('e23ed572-234c-4995-acad-fa6bff7c58d2', 'Gaji & upah',       'out', 'users',           '#085041', 'purchasing', true, 9),
  ('e23ed572-234c-4995-acad-fa6bff7c58d2', 'Operasional',       'out', 'settings',        '#888780', 'purchasing', true, 10),
  ('e23ed572-234c-4995-acad-fa6bff7c58d2', 'Lain-lain',         'out', 'dots',            '#B4B2A9', 'purchasing', true, 11)
on conflict do nothing;


-- ------------------------------------------------------------
-- 5. CEK HASIL
-- ------------------------------------------------------------

-- Cek kolom baru di transactions:
select column_name, data_type
from information_schema.columns
where table_name = 'transactions'
  and column_name in ('supplier','receipt_url','module','meta');

-- Cek kategori purchasing berhasil masuk:
select name, icon, color, role, sort
from public.categories
where business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2'
  and role = 'purchasing'
order by sort;
