-- Daily AI call limits (migration 20261016120000): only the server functions
-- (service role) can count calls; users and visitors can neither call the
-- counter nor read or reset it. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'quota@example.test');

-- Visitors and users can't use the counter or see it.
set local role anon;
select throws_ok($$ select public.consume_ai_quota('00000000-0000-0000-0000-0000000000e1', 'skills', 5) $$,
  '42501', null, 'a visitor cannot call consume_ai_quota');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select throws_ok($$ select public.consume_ai_quota('00000000-0000-0000-0000-0000000000e1', 'skills', 1000) $$,
  '42501', null, 'a signed-in user cannot call consume_ai_quota (or raise their own limit)');
select throws_ok($$ delete from private.ai_usage $$,
  '42501', null, 'a signed-in user cannot reset their usage');
reset role;

-- The server functions (service role) count calls against the limit.
set local role service_role;
select ok(public.consume_ai_quota('00000000-0000-0000-0000-0000000000e1', 'skills', 2), 'call 1 of 2 is allowed');
select ok(public.consume_ai_quota('00000000-0000-0000-0000-0000000000e1', 'skills', 2), 'call 2 of 2 is allowed');
select ok(not public.consume_ai_quota('00000000-0000-0000-0000-0000000000e1', 'skills', 2), 'call 3 is over the limit');
select ok(public.consume_ai_quota('00000000-0000-0000-0000-0000000000e1', 'other', 2), 'each kind of call has its own count');
reset role;

select is((select calls from private.ai_usage
           where user_id = '00000000-0000-0000-0000-0000000000e1' and kind = 'skills'), 3,
  'calls over the limit are still counted');

select * from finish();
rollback;
