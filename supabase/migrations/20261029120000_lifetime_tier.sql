-- Lifetime supporter tier (decision 50). Tiers are separate: Premium
-- (premium_grants, unchanged) does not include Lifetime, and Lifetime does
-- not include Premium. Admins have both. Until payments exist, only admins
-- grant either; a payment flow will later write these rows from the server.

create table public.lifetime_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.lifetime_grants enable row level security;
revoke all on public.lifetime_grants from anon, authenticated, service_role;

-- Same rules as premium_grants (one policy per action, see the advisor
-- fixes migration): a user reads their own row, admins read and write all.
create policy "lifetime_grants: read own or as admin" on public.lifetime_grants
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "lifetime_grants: admins insert" on public.lifetime_grants
  for insert to authenticated
  with check ((select private.is_admin()));
create policy "lifetime_grants: admins update" on public.lifetime_grants
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "lifetime_grants: admins delete" on public.lifetime_grants
  for delete to authenticated
  using ((select private.is_admin()));
grant select, insert, update, delete on public.lifetime_grants to authenticated;
grant select, insert, update, delete on public.lifetime_grants to service_role;

-- For server functions, like private.has_premium: admins always count.
create function private.has_lifetime(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = uid)
      or exists (select 1 from public.lifetime_grants g where g.user_id = uid);
$$;
revoke all on function private.has_lifetime(uuid) from public, anon, authenticated, service_role;
grant execute on function private.has_lifetime(uuid) to service_role;

-- my_access() gains is_lifetime. A function's result columns can't be
-- changed in place, so it is dropped and created again with the same rules
-- (security invoker: the caller only sees their own grant rows). Callers
-- read the columns by name, so the old app keeps working with the extra one.
drop function public.my_access();
create function public.my_access()
returns table (is_admin boolean, is_premium boolean, is_lifetime boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin(),
         private.is_admin()
         or exists (select 1 from public.premium_grants g where g.user_id = (select auth.uid())),
         private.is_admin()
         or exists (select 1 from public.lifetime_grants g where g.user_id = (select auth.uid()));
$$;
revoke all on function public.my_access() from public, anon, authenticated, service_role;
grant execute on function public.my_access() to authenticated;
