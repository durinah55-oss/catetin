-- ============================================================================
-- NF3 — Skema Database (Supabase / PostgreSQL)
-- Jalankan SELURUH file ini di: Supabase Dashboard → SQL Editor → New query.
-- Aman dijalankan ulang (idempotent): pakai IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

-- gen_random_uuid() tersedia lewat pgcrypto
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. PROFILES — cermin dari auth.users (data yang boleh dibaca antar anggota)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Auto-buat profile saat user baru daftar di Supabase Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. BUSINESSES — satu baris per bisnis (NF F&B, NF Nusa Fishing, dst)
-- ----------------------------------------------------------------------------
create table if not exists public.businesses (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  type        text not null default 'umkm',  -- fnb | ecommerce | umkm
  owner_id    uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. BUSINESS_MEMBERS — keanggotaan + peran + outlet
-- ----------------------------------------------------------------------------
create table if not exists public.business_members (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'kasir'
               check (role in ('owner','admin','kasir','purchasing')),
  outlet       text,
  active        boolean not null default true,
  joined_at     timestamptz not null default now(),
  unique (business_id, user_id)
);
create index if not exists idx_members_user on public.business_members(user_id);
create index if not exists idx_members_biz  on public.business_members(business_id);

-- ----------------------------------------------------------------------------
-- 4. WALLETS — dompet/kas (saldo berjalan dihitung dari opening + transaksi)
-- ----------------------------------------------------------------------------
create table if not exists public.wallets (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  name             text not null,
  type             text not null default 'cash',  -- cash | bank | ewallet
  icon             text,
  color            text,
  opening_balance  bigint not null default 0,      -- rupiah, tanpa sen
  active           boolean not null default true,
  hide_balance     boolean not null default false, -- UI purchasing: sembunyikan angka saldo
  sort             int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_wallets_biz on public.wallets(business_id);

-- ----------------------------------------------------------------------------
-- 5. CATEGORIES — kategori pemasukan/pengeluaran
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  name             text not null,
  type             text not null check (type in ('in','out')),
  icon             text,
  color            text,
  active           boolean not null default true,
  sort             int not null default 0,
  role             text default null,           -- purchasing | kasir | null (semua)
  accounting_group text default null,           -- hpp | beban_operasional | aset | pribadi | lain
  description      text default null,           -- panduan singkat untuk staf purchasing
  created_at       timestamptz not null default now(),
  unique (business_id, type, name)
);
create index if not exists idx_categories_biz on public.categories(business_id);

-- ----------------------------------------------------------------------------
-- 6. TRANSACTIONS — catatan kas
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  wallet_id    uuid references public.wallets(id) on delete set null,
  category_id  uuid references public.categories(id) on delete set null,
  type         text not null check (type in ('in','out')),
  amount       bigint not null check (amount > 0),  -- rupiah, tanpa sen
  description  text,
  occurred_at  date not null default current_date,
  outlet       text,
  source       text not null default 'manual',  -- manual | voice | receipt
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_tx_biz       on public.transactions(business_id);
create index if not exists idx_tx_biz_date  on public.transactions(business_id, occurred_at desc);

-- ----------------------------------------------------------------------------
-- 7. TRANSACTION_DRAFTS — hasil AI (voice/scan) yang menunggu konfirmasi
-- ----------------------------------------------------------------------------
create table if not exists public.transaction_drafts (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  type         text check (type in ('in','out')),
  category     text,           -- nama kategori (belum tentu cocok persis)
  amount       bigint,
  description  text,
  occurred_at  date,
  source       text not null default 'voice',  -- voice | receipt
  raw          jsonb,          -- payload mentah dari AI
  status       text not null default 'pending', -- pending | accepted | dismissed
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_drafts_biz on public.transaction_drafts(business_id, status);

-- ----------------------------------------------------------------------------
-- 8. INVITES — undangan staf (lewat link / email)
-- ----------------------------------------------------------------------------
create table if not exists public.invites (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  email        text,
  role         text not null default 'kasir'
               check (role in ('admin','kasir','purchasing')),
  outlet       text,
  token        text unique not null default encode(gen_random_bytes(16), 'hex'),
  invited_by   uuid references public.profiles(id) on delete set null,
  accepted     boolean not null default false,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz not null default now()
);
create index if not exists idx_invites_token on public.invites(token);

-- ----------------------------------------------------------------------------
-- 9. WEB_SESSIONS — pairing HP ↔ PC (di-manage oleh service role via /api/pair)
-- ----------------------------------------------------------------------------
create table if not exists public.web_sessions (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid references public.businesses(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  pair_code    text unique not null,
  approved     boolean not null default false,
  expires_at   timestamptz not null default (now() + interval '10 minutes'),
  created_at   timestamptz not null default now()
);
create index if not exists idx_sessions_code on public.web_sessions(pair_code);

-- ----------------------------------------------------------------------------
-- 10. APP_STATE — seluruh state aplikasi NF3 disimpan sbg 1 dokumen JSONB
--     per bisnis (dipakai oleh NF3App / catatin-nf). Sinkron multi-perangkat.
-- ----------------------------------------------------------------------------
create table if not exists public.app_state (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER — aman dari rekursi RLS)
-- ============================================================================

-- Apakah user yang login adalah anggota AKTIF dari bisnis tsb?
create or replace function public.is_business_member(b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = b and m.user_id = auth.uid() and m.active
  );
$$;

-- Peran user di bisnis tsb (null jika bukan anggota)
create or replace function public.business_role(b uuid)
returns text language sql security definer stable set search_path = public as $$
  select role from public.business_members
  where business_id = b and user_id = auth.uid() and active
  limit 1;
$$;

-- Apakah user yang login berbagi minimal satu bisnis dengan user lain?
create or replace function public.shares_business_with(other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.business_members me
    join public.business_members them on them.business_id = me.business_id
    where me.user_id = auth.uid() and them.user_id = other
  );
$$;

-- ============================================================================
-- RPC: create_business — buat bisnis + owner membership + default wallet/kategori
-- Dipanggil dari lib/repo.createBusiness()
-- ============================================================================
create or replace function public.create_business(p_slug text, p_name text, p_type text)
returns public.businesses
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_biz public.businesses;
begin
  if v_uid is null then
    raise exception 'Harus login dulu';
  end if;

  insert into public.businesses (slug, name, type, owner_id)
  values (p_slug, p_name, coalesce(p_type, 'umkm'), v_uid)
  returning * into v_biz;

  insert into public.business_members (business_id, user_id, role)
  values (v_biz.id, v_uid, 'owner');

  -- Default wallets
  insert into public.wallets (business_id, name, type, icon, color, sort)
  values
    (v_biz.id, 'Kas Laci',     'cash',    '💵', '#16A34A', 0),
    (v_biz.id, 'Bank',         'bank',    '🏦', '#2563EB', 1),
    (v_biz.id, 'QRIS / E-Wallet','ewallet','📱', '#7C3AED', 2);

  -- Default kategori berdasarkan tipe bisnis
  if p_type = 'fnb' then
    insert into public.categories (business_id, name, type, sort) values
      (v_biz.id, 'Penjualan',    'in', 0),
      (v_biz.id, 'Lain-lain',    'in', 1),
      (v_biz.id, 'Bahan Baku',   'out', 0),
      (v_biz.id, 'Gaji',         'out', 1),
      (v_biz.id, 'Sewa',         'out', 2),
      (v_biz.id, 'Listrik & Air','out', 3),
      (v_biz.id, 'Operasional',  'out', 4),
      (v_biz.id, 'Lain-lain',    'out', 5);
  elsif p_type = 'ecommerce' then
    insert into public.categories (business_id, name, type, sort) values
      (v_biz.id, 'Penjualan',  'in', 0),
      (v_biz.id, 'Ongkir',     'in', 1),
      (v_biz.id, 'Modal / Kulakan','out', 0),
      (v_biz.id, 'Packing',    'out', 1),
      (v_biz.id, 'Ongkir',     'out', 2),
      (v_biz.id, 'Iklan',      'out', 3),
      (v_biz.id, 'Lain-lain',  'out', 4);
  else
    insert into public.categories (business_id, name, type, sort) values
      (v_biz.id, 'Penjualan',   'in', 0),
      (v_biz.id, 'Lain-lain',   'in', 1),
      (v_biz.id, 'Modal',       'out', 0),
      (v_biz.id, 'Operasional', 'out', 1),
      (v_biz.id, 'Gaji',        'out', 2),
      (v_biz.id, 'Lain-lain',   'out', 3);
  end if;

  return v_biz;
end;
$$;

-- ============================================================================
-- RPC: accept_invite — staf menerima undangan via token
-- Dipanggil dari lib/repo.acceptInvite()
-- ============================================================================
create or replace function public.accept_invite(p_token text)
returns public.business_members
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invites;
  v_member public.business_members;
begin
  if v_uid is null then
    raise exception 'Harus login dulu';
  end if;

  select * into v_inv from public.invites
  where token = p_token and not accepted and expires_at > now()
  limit 1;

  if v_inv.id is null then
    raise exception 'Undangan tidak valid atau sudah kadaluarsa';
  end if;

  insert into public.business_members (business_id, user_id, role, outlet)
  values (v_inv.business_id, v_uid, v_inv.role, v_inv.outlet)
  on conflict (business_id, user_id)
  do update set active = true, role = excluded.role, outlet = excluded.outlet
  returning * into v_member;

  update public.invites set accepted = true where id = v_inv.id;

  return v_member;
end;
$$;

-- ============================================================================
-- RPC: claim_pending_invites — klaim undangan by email profil (login tanpa ?invite=)
-- ============================================================================
create or replace function public.claim_pending_invites()
returns setof public.business_members
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.invites;
  v_member public.business_members;
begin
  if v_uid is null then
    raise exception 'Harus login dulu';
  end if;

  select email into v_email from public.profiles where id = v_uid;
  if v_email is null or trim(v_email) = '' then
    return;
  end if;

  for v_inv in
    select * from public.invites
    where lower(trim(email)) = lower(trim(v_email))
      and not accepted
      and expires_at > now()
  loop
    insert into public.business_members (business_id, user_id, role, outlet, active)
    values (v_inv.business_id, v_uid, v_inv.role, v_inv.outlet, true)
    on conflict (business_id, user_id)
    do update set active = true, role = excluded.role, outlet = excluded.outlet
    returning * into v_member;

    update public.invites set accepted = true where id = v_inv.id;
    return next v_member;
  end loop;
end;
$$;

grant execute on function public.claim_pending_invites() to authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.businesses        enable row level security;
alter table public.business_members  enable row level security;
alter table public.wallets           enable row level security;
alter table public.categories        enable row level security;
alter table public.transactions      enable row level security;
alter table public.transaction_drafts enable row level security;
alter table public.invites           enable row level security;
alter table public.web_sessions      enable row level security;
alter table public.app_state         enable row level security;

-- ── PROFILES ────────────────────────────────────────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_business_with(id));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ── BUSINESSES ───────────────────────────────────────────────────────────────
drop policy if exists businesses_select on public.businesses;
create policy businesses_select on public.businesses for select
  using (owner_id = auth.uid() or public.is_business_member(id));

drop policy if exists businesses_insert on public.businesses;
create policy businesses_insert on public.businesses for insert
  with check (owner_id = auth.uid());

drop policy if exists businesses_update on public.businesses;
create policy businesses_update on public.businesses for update
  using (public.business_role(id) in ('owner','admin'))
  with check (public.business_role(id) in ('owner','admin'));

-- ── BUSINESS_MEMBERS ─────────────────────────────────────────────────────────
drop policy if exists members_select on public.business_members;
create policy members_select on public.business_members for select
  using (public.is_business_member(business_id));

drop policy if exists members_insert on public.business_members;
create policy members_insert on public.business_members for insert
  with check (user_id = auth.uid() or public.business_role(business_id) in ('owner','admin'));

drop policy if exists members_update on public.business_members;
create policy members_update on public.business_members for update
  using (public.business_role(business_id) in ('owner','admin'))
  with check (public.business_role(business_id) in ('owner','admin'));

drop policy if exists members_delete on public.business_members;
create policy members_delete on public.business_members for delete
  using (public.business_role(business_id) = 'owner');

-- ── WALLETS (kelola: owner/admin; lihat: semua anggota) ──────────────────────
drop policy if exists wallets_select on public.wallets;
create policy wallets_select on public.wallets for select
  using (public.is_business_member(business_id));

drop policy if exists wallets_write on public.wallets;
create policy wallets_write on public.wallets for all
  using (public.business_role(business_id) in ('owner','admin'))
  with check (public.business_role(business_id) in ('owner','admin'));

-- ── CATEGORIES (kelola: owner/admin; lihat: semua anggota) ───────────────────
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select
  using (public.is_business_member(business_id));

drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories for all
  using (public.business_role(business_id) in ('owner','admin'))
  with check (public.business_role(business_id) in ('owner','admin'));

-- ── TRANSACTIONS (semua anggota aktif boleh catat & lihat; hapus: owner/admin) ─
drop policy if exists tx_select on public.transactions;
create policy tx_select on public.transactions for select
  using (public.is_business_member(business_id));

drop policy if exists tx_insert on public.transactions;
create policy tx_insert on public.transactions for insert
  with check (public.is_business_member(business_id));

drop policy if exists tx_update on public.transactions;
create policy tx_update on public.transactions for update
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists tx_delete on public.transactions;
create policy tx_delete on public.transactions for delete
  using (public.business_role(business_id) in ('owner','admin') or created_by = auth.uid());

-- ── TRANSACTION_DRAFTS (semua anggota) ───────────────────────────────────────
drop policy if exists drafts_all on public.transaction_drafts;
create policy drafts_all on public.transaction_drafts for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- ── INVITES (kelola: owner/admin) ────────────────────────────────────────────
drop policy if exists invites_manage on public.invites;
create policy invites_manage on public.invites for all
  using (public.business_role(business_id) in ('owner','admin'))
  with check (public.business_role(business_id) in ('owner','admin'));
-- Catatan: penerimaan undangan TIDAK lewat select tabel ini,
-- tapi lewat RPC accept_invite() yang SECURITY DEFINER.

-- ── WEB_SESSIONS (anggota lihat sesi miliknya; insert/approve via service role) ─
drop policy if exists sessions_select on public.web_sessions;
create policy sessions_select on public.web_sessions for select
  using (user_id = auth.uid());

-- ── APP_STATE (semua anggota bisnis boleh baca & tulis dokumen state) ────────
drop policy if exists app_state_select on public.app_state;
create policy app_state_select on public.app_state for select
  using (public.is_business_member(business_id));

drop policy if exists app_state_write on public.app_state;
create policy app_state_write on public.app_state for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- ============================================================================
-- SELESAI. Setelah ini jalankan supabase/seed.sql (opsional, butuh user terdaftar).
-- ============================================================================
