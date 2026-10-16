-- Request limits (migration 20261016140000): only the server functions
-- (service role) can count requests; visitors and users can't call the
-- counter or read and reset it. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

set local role anon;
select throws_ok($$ select public.consume_rate_limit('wall:1.2.3.4', 1000, 60) $$,
  '42501', null, 'a visitor cannot call consume_rate_limit');
reset role;

set local role authenticated;
select throws_ok($$ select public.consume_rate_limit('wall:1.2.3.4', 1000, 60) $$,
  '42501', null, 'a signed-in user cannot call consume_rate_limit');
select throws_ok($$ delete from private.rate_limits $$,
  '42501', null, 'a signed-in user cannot reset the counters');
reset role;

set local role service_role;
select ok(public.consume_rate_limit('wall:1.2.3.4', 2, 60), 'request 1 of 2 is allowed');
select ok(public.consume_rate_limit('wall:1.2.3.4', 2, 60), 'request 2 of 2 is allowed');
select ok(not public.consume_rate_limit('wall:1.2.3.4', 2, 60), 'request 3 is over the limit');
reset role;

-- Once the window has passed, counting starts again.
update private.rate_limits set window_start = now() - interval '2 minutes' where key = 'wall:1.2.3.4';
set local role service_role;
select ok(public.consume_rate_limit('wall:1.2.3.4', 2, 60), 'a new window starts after the old one passes');
reset role;

select * from finish();
rollback;
