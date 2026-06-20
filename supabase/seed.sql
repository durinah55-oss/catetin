-- ============================================================================
-- NF3 — Seed Data
-- ----------------------------------------------------------------------------
-- PRASYARAT:
--   1. schema.sql sudah dijalankan.
--   2. User "Sam" sudah DAFTAR lewat halaman /login (Supabase Auth).
--      Ganti email di bawah ini dengan email Sam yang sebenarnya.
--
-- Jalankan SELURUH file ini di Supabase Dashboard → SQL Editor.
-- Aman dijalankan ulang: pakai ON CONFLICT DO NOTHING di mana relevan.
-- ============================================================================

do $$
declare
  v_owner   uuid;
  v_fnb     uuid;
  v_fishing uuid;
  v_w_kas   uuid;
  v_w_bank  uuid;
  v_c_jual  uuid;
  v_c_bahan uuid;
  -- >>> GANTI email ini dengan email Sam <<<
  v_email   text := 'sam@nusafishing.com';
begin
  select id into v_owner from auth.users where email = v_email limit 1;
  if v_owner is null then
    raise exception 'User % belum terdaftar. Daftar dulu lewat /login, lalu jalankan seed ini.', v_email;
  end if;

  -- pastikan profile ada
  insert into public.profiles (id, name, email)
  values (v_owner, 'Sam', v_email)
  on conflict (id) do update set name = excluded.name;

  -- ── BISNIS 1: NF F&B ──────────────────────────────────────────────────────
  select id into v_fnb from public.businesses where slug = 'nf-fnb';
  if v_fnb is null then
    insert into public.businesses (slug, name, type, owner_id)
    values ('nf-fnb', 'NF F&B', 'fnb', v_owner)
    returning id into v_fnb;

    insert into public.business_members (business_id, user_id, role)
    values (v_fnb, v_owner, 'owner');

    insert into public.wallets (business_id, name, type, icon, color, opening_balance, sort) values
      (v_fnb, 'Kas Laci',       'cash',    '💵', '#16A34A', 500000,  0),
      (v_fnb, 'Bank BCA',       'bank',    '🏦', '#2563EB', 5000000, 1),
      (v_fnb, 'QRIS / E-Wallet','ewallet', '📱', '#7C3AED', 250000,  2);

    insert into public.categories (business_id, name, type, sort) values
      (v_fnb, 'Penjualan',    'in', 0),
      (v_fnb, 'Lain-lain',    'in', 1),
      (v_fnb, 'Bahan Baku',   'out', 0),
      (v_fnb, 'Gaji',         'out', 1),
      (v_fnb, 'Sewa',         'out', 2),
      (v_fnb, 'Listrik & Air','out', 3),
      (v_fnb, 'Operasional',  'out', 4),
      (v_fnb, 'Lain-lain',    'out', 5);
  end if;

  -- ── BISNIS 2: NF Nusa Fishing ─────────────────────────────────────────────
  select id into v_fishing from public.businesses where slug = 'nf-nusa-fishing';
  if v_fishing is null then
    insert into public.businesses (slug, name, type, owner_id)
    values ('nf-nusa-fishing', 'NF Nusa Fishing', 'ecommerce', v_owner)
    returning id into v_fishing;

    insert into public.business_members (business_id, user_id, role)
    values (v_fishing, v_owner, 'owner');

    insert into public.wallets (business_id, name, type, icon, color, opening_balance, sort) values
      (v_fishing, 'Kas',             'cash',    '💵', '#16A34A', 300000,   0),
      (v_fishing, 'Bank Mandiri',    'bank',    '🏦', '#2563EB', 12000000, 1),
      (v_fishing, 'Saldo Marketplace','ewallet','📱', '#F97316', 1800000,  2);

    insert into public.categories (business_id, name, type, sort) values
      (v_fishing, 'Penjualan',      'in', 0),
      (v_fishing, 'Ongkir',         'in', 1),
      (v_fishing, 'Modal / Kulakan','out', 0),
      (v_fishing, 'Packing',        'out', 1),
      (v_fishing, 'Ongkir',         'out', 2),
      (v_fishing, 'Iklan',          'out', 3),
      (v_fishing, 'Lain-lain',      'out', 4);
  end if;

  -- ── DATA CONTOH transaksi NF F&B (hanya jika belum ada) ───────────────────
  if not exists (select 1 from public.transactions where business_id = v_fnb) then
    select id into v_w_kas  from public.wallets    where business_id = v_fnb and type = 'cash' limit 1;
    select id into v_w_bank from public.wallets    where business_id = v_fnb and type = 'bank' limit 1;
    select id into v_c_jual from public.categories where business_id = v_fnb and name = 'Penjualan' limit 1;
    select id into v_c_bahan from public.categories where business_id = v_fnb and name = 'Bahan Baku' limit 1;

    insert into public.transactions
      (business_id, wallet_id, category_id, type, amount, description, occurred_at, created_by) values
      (v_fnb, v_w_kas,  v_c_jual,  'in',  750000, 'Penjualan harian',        current_date,        v_owner),
      (v_fnb, v_w_kas,  v_c_bahan, 'out', 320000, 'Belanja bahan ke pasar',  current_date,        v_owner),
      (v_fnb, v_w_bank, v_c_jual,  'in',  1200000,'Transfer pesanan catering',current_date - 1,   v_owner),
      (v_fnb, v_w_kas,  v_c_bahan, 'out', 180000, 'Beli gas + minyak',       current_date - 2,    v_owner);
  end if;

  raise notice 'Seed selesai. NF F&B = %, NF Nusa Fishing = %', v_fnb, v_fishing;
end $$;
