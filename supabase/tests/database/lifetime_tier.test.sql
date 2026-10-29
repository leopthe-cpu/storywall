-- Lifetime supporter tier (migration 20261029120000, decision 50): a
-- separate grant from Premium, readable by its owner, written by admins
-- only, reported by my_access(). Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'tier-free@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'tier-lifetime@example.test'),
  ('00000000-0000-0000-0000-0000000000f3', 'tier-premium@example.test'),
  ('00000000-0000-0000-0000-0000000000f4', 'tier-admin@example.test');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000f4');
insert into public.lifetime_grants (user_id, note) values ('00000000-0000-0000-0000-0000000000f2', 'test');
insert into public.premium_grants (user_id, note) values ('00000000-0000-0000-0000-0000000000f3', 'test');

select has_table('public', 'lifetime_grants', 'the lifetime_grants table exists');
select is((select relrowsecurity from pg_class where oid = 'public.lifetime_grants'::regclass), true,
  'lifetime_grants has row level security on');

-- ── Free user ─────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select results_eq($$ select is_admin, is_premium, is_lifetime from public.my_access() $$,
  $$ values (false, false, false) $$, 'free user: no tier');
select throws_ok($$ insert into public.lifetime_grants (user_id) values (auth.uid()) $$,
  '42501', null, 'a user cannot give themselves Lifetime');
select is((select count(*)::int from public.lifetime_grants), 0, 'a user cannot see other people''s Lifetime grants');
select throws_ok($$ select private.has_lifetime('00000000-0000-0000-0000-0000000000f2') $$,
  '42501', null, 'a user cannot look up someone else''s Lifetime status');
reset role;

-- ── Lifetime and Premium are separate ─────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
select results_eq($$ select is_admin, is_premium, is_lifetime from public.my_access() $$,
  $$ values (false, false, true) $$, 'Lifetime supporter: Lifetime only, not Premium');
select is((select count(*)::int from public.lifetime_grants), 1, 'a Lifetime supporter sees their own grant');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f3';
select results_eq($$ select is_admin, is_premium, is_lifetime from public.my_access() $$,
  $$ values (false, true, false) $$, 'Premium member: Premium only, not Lifetime');
reset role;

-- ── Admin ─────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f4';
select results_eq($$ select is_admin, is_premium, is_lifetime from public.my_access() $$,
  $$ values (true, true, true) $$, 'admins have every tier');
select lives_ok($$ insert into public.lifetime_grants (user_id) values ('00000000-0000-0000-0000-0000000000f1') $$,
  'an admin grants Lifetime');
reset role;

-- A deleted account takes its grant with it.
delete from auth.users where id = '00000000-0000-0000-0000-0000000000f2';
select is((select count(*)::int from public.lifetime_grants where user_id = '00000000-0000-0000-0000-0000000000f2'), 0,
  'deleting an account deletes its Lifetime grant');

select * from finish();
rollback;
