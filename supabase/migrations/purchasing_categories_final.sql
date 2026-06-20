-- ============================================================
-- NF3 Purchasing — Update Kategori Final
-- Business: Nusa Food
-- business_id: e23ed572-234c-4995-acad-fa6bff7c58d2
-- ============================================================
-- Yang dilakukan:
-- 1. Tambah kolom accounting_group ke categories
-- 2. Tambah kolom description (panduan singkat untuk staf)
-- 3. Hapus kategori purchasing lama yang tidak sesuai
-- 4. Insert 13 kategori purchasing final
-- ============================================================


-- ------------------------------------------------------------
-- 1. Tambah kolom baru ke categories
-- ------------------------------------------------------------

alter table public.categories
  add column if not exists accounting_group text default null,
  add column if not exists description      text default null;

comment on column public.categories.accounting_group is
  'Kelompok akuntansi: hpp | beban_operasional | aset | pribadi | lain';

comment on column public.categories.description is
  'Panduan singkat untuk staf purchasing';


-- ------------------------------------------------------------
-- 2. Hapus kategori purchasing lama + bentrok nama "Lain-lain"
-- ------------------------------------------------------------

delete from public.categories
where business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2'
  and role = 'purchasing';

-- Hindari bentrok unique (business_id, type, name) saat insert "Lain-lain" purchasing
delete from public.categories
where business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2'
  and type = 'out'
  and lower(trim(name)) = 'lain-lain'
  and coalesce(role, '') <> 'purchasing';


-- ------------------------------------------------------------
-- 3. Insert 13 kategori purchasing final
-- ------------------------------------------------------------

insert into public.categories
  (business_id, name, type, icon, color, role, active, sort, accounting_group, description)
values

  -- HPP (Harga Pokok Produksi)
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Bahan Baku', 'out', 'shopping-bag', '#1D9E75',
    'purchasing', true, 1, 'hpp',
    'Ayam, beras, sayur, bumbu, susu, kopi, minyak. Bisa habis untuk membuat menu.'
  ),
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Kemasan', 'out', 'box', '#0F6E56',
    'purchasing', true, 2, 'hpp',
    'Cup, mangkuk, plastik, paper bag, sendok takeaway. Dipakai membungkus pesanan.'
  ),
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Gas LPG', 'out', 'flame', '#D85A30',
    'purchasing', true, 3, 'hpp',
    'Pembelian tabung gas LPG untuk memasak.'
  ),

  -- Beban Operasional
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Listrik, Air & Internet', 'out', 'bolt', '#378ADD',
    'purchasing', true, 4, 'beban_operasional',
    'Tagihan listrik, air, WiFi, token listrik.'
  ),
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Gaji & Upah', 'out', 'users', '#085041',
    'purchasing', true, 5, 'beban_operasional',
    'Gaji staf, upah harian, tunjangan.'
  ),
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Sewa Tempat', 'out', 'building', '#5F5E5A',
    'purchasing', true, 6, 'beban_operasional',
    'Sewa ruko, kontrakan outlet, sewa tempat usaha.'
  ),
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Kebutuhan Operasional', 'out', 'settings', '#7F77DD',
    'purchasing', true, 7, 'beban_operasional',
    'Sabun, tisu, alat kebersihan, ATK, galon, kebutuhan outlet sehari-hari.'
  ),
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Transport & Ongkos Belanja', 'out', 'truck', '#BA7517',
    'purchasing', true, 8, 'beban_operasional',
    'Bensin, parkir, ongkir, ongkos mengambil barang.'
  ),
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Peralatan & Perbaikan', 'out', 'tools', '#993C1D',
    'purchasing', true, 9, 'beban_operasional',
    'Pisau, baskom, gelas, kabel, servis kompor, servis keran. Barang kecil dipakai berulang.'
  ),
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Promosi', 'out', 'speakerphone', '#D4537E',
    'purchasing', true, 10, 'beban_operasional',
    'Iklan, cetak banner, endorse, diskon promosi.'
  ),

  -- Aset
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Pembelian Aset', 'out', 'device-laptop', '#534AB7',
    'purchasing', true, 11, 'aset',
    'Kulkas, freezer, AC, mesin kopi, laptop, tablet, meja besar. Barang mahal dan tahan lama.'
  ),

  -- Pribadi
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Keperluan Owner', 'out', 'user', '#888780',
    'purchasing', true, 12, 'pribadi',
    'Pengambilan atau pembelian untuk kebutuhan pribadi owner. Bukan biaya usaha.'
  ),

  -- Lain-lain
  (
    'e23ed572-234c-4995-acad-fa6bff7c58d2',
    'Lain-lain', 'out', 'dots', '#B4B2A9',
    'purchasing', true, 13, 'lain',
    'Wajib isi keterangan di kolom catatan.'
  )

on conflict do nothing;


-- ------------------------------------------------------------
-- 4. CEK HASIL
-- ------------------------------------------------------------

select
  sort,
  name,
  accounting_group,
  description
from public.categories
where business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2'
  and role = 'purchasing'
order by sort;
