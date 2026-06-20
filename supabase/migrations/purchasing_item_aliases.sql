-- ============================================================
-- NF3 Purchasing — Item aliases + cluster review tracking
-- ============================================================

create table if not exists public.purchasing_item_aliases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  canonical_name text not null,
  alias_name text not null,
  category_hint text,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz default now(),
  unique (business_id, alias_name)
);

create index if not exists idx_purchasing_item_aliases_business
  on public.purchasing_item_aliases (business_id);

create index if not exists idx_purchasing_item_aliases_canonical
  on public.purchasing_item_aliases (business_id, canonical_name);

comment on table public.purchasing_item_aliases is
  'Mapping alias nama barang purchasing → canonical (disetujui owner/admin).';

-- Status review per cluster dari file scan
create table if not exists public.purchasing_alias_cluster_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  scan_file text not null,
  cluster_id integer not null,
  status text not null check (status in ('approved', 'rejected')),
  canonical_name text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz default now(),
  unique (business_id, scan_file, cluster_id)
);

create index if not exists idx_purchasing_alias_reviews_business_scan
  on public.purchasing_alias_cluster_reviews (business_id, scan_file);

-- ── RLS ──────────────────────────────────────────────────────

alter table public.purchasing_item_aliases enable row level security;
alter table public.purchasing_alias_cluster_reviews enable row level security;

drop policy if exists purchasing_item_aliases_select on public.purchasing_item_aliases;
create policy purchasing_item_aliases_select on public.purchasing_item_aliases
  for select using (public.is_business_member(business_id));

drop policy if exists purchasing_item_aliases_write on public.purchasing_item_aliases;
create policy purchasing_item_aliases_write on public.purchasing_item_aliases
  for all
  using (public.business_role(business_id) in ('owner', 'admin'))
  with check (public.business_role(business_id) in ('owner', 'admin'));

drop policy if exists purchasing_alias_reviews_select on public.purchasing_alias_cluster_reviews;
create policy purchasing_alias_reviews_select on public.purchasing_alias_cluster_reviews
  for select using (public.is_business_member(business_id));

drop policy if exists purchasing_alias_reviews_write on public.purchasing_alias_cluster_reviews;
create policy purchasing_alias_reviews_write on public.purchasing_alias_cluster_reviews
  for all
  using (public.business_role(business_id) in ('owner', 'admin'))
  with check (public.business_role(business_id) in ('owner', 'admin'));
