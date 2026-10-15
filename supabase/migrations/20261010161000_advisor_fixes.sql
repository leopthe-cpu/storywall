-- Fixes for Supabase's database advisor on staging (2026-10-10).

-- 1. Security: public.rls_auto_enable() is the function behind the
--    "Enable automatic RLS" event trigger that Supabase installed when the
--    project was created (decision 5). It sits in the exposed public schema,
--    so the API lists it as callable by visitors and signed-in users. Only
--    the event trigger needs it: remove everyone else's right to call it.
--    (Projects created without that option, like the local/CI database,
--    don't have the function, hence the check.)
do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;

-- 2. Performance: premium_grants had two permissive SELECT policies for
--    signed-in users ("read own or as admin" and the FOR ALL "admins write").
--    Split the admin policy into insert/update/delete so each action has one.
drop policy "premium_grants: admins write" on public.premium_grants;
create policy "premium_grants: admins insert" on public.premium_grants
  for insert to authenticated
  with check ((select private.is_admin()));
create policy "premium_grants: admins update" on public.premium_grants
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "premium_grants: admins delete" on public.premium_grants
  for delete to authenticated
  using ((select private.is_admin()));
