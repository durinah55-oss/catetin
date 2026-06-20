-- Klaim undangan staf by email saat login (tanpa harus buka link ?invite=)

create or replace function public.claim_pending_invites()
returns setof public.business_members
language plpgsql
security definer
set search_path = public
as $$
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
    do update set
      active = true,
      role = excluded.role,
      outlet = excluded.outlet
    returning * into v_member;

    update public.invites set accepted = true where id = v_inv.id;
    return next v_member;
  end loop;
end;
$$;

grant execute on function public.claim_pending_invites() to authenticated;
