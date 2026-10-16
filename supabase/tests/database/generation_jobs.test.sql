-- Generate jobs (migration 20261016160000): only the server functions create
-- and fill jobs; the owner reads their own and may only mark them as seen.
-- Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'jobs-a@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'jobs-b@example.test'),
  ('00000000-0000-0000-0000-0000000000fa', 'jobs-admin@example.test');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000fa');
insert into public.posts (id, author_id, title, status) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'draft', 'draft');

-- The server (service role) creates and fills a job.
set local role service_role;
select lives_ok($$ insert into public.generation_jobs (id, user_id, post_id, status)
                   values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1',
                           '20000000-0000-0000-0000-000000000001', 'writing') $$,
  'the server creates a job');
select lives_ok($$ update public.generation_jobs set status = 'done', result = '{"cards":[]}'
                   where id = '30000000-0000-0000-0000-000000000001' $$,
  'the server updates a job');
reset role;

-- Visitors: nothing.
set local role anon;
select throws_ok($$ select * from public.generation_jobs $$, '42501', null, 'a visitor cannot read jobs');
reset role;

-- The owner.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select is((select status from public.generation_jobs where id = '30000000-0000-0000-0000-000000000001'), 'done',
  'the owner reads their job');
select lives_ok($$ update public.generation_jobs set seen_at = now()
                   where id = '30000000-0000-0000-0000-000000000001' $$,
  'the owner marks their job as seen');
select throws_ok($$ update public.generation_jobs set status = 'failed'
                    where id = '30000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the owner cannot change the status');
select throws_ok($$ update public.generation_jobs set result = '{"cards":["fake"]}'
                    where id = '30000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the owner cannot change the result');
select throws_ok($$ update public.generation_jobs set email_sent_at = null
                    where id = '30000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the owner cannot reset the e-mail marker');
select throws_ok($$ insert into public.generation_jobs (user_id) values (auth.uid()) $$,
  '42501', null, 'the owner cannot create a job directly (server function only)');
select throws_ok($$ delete from public.generation_jobs $$,
  '42501', null, 'the owner cannot delete jobs');
reset role;

-- Another user.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
select is((select count(*)::int from public.generation_jobs), 0, 'another user cannot see the job');
select results_eq($$ with u as (update public.generation_jobs set seen_at = now() returning 1)
                     select count(*)::int from u $$,
  array[0], 'another user cannot mark the job as seen');
reset role;

-- Admin.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000fa';
select is((select count(*)::int from public.generation_jobs), 1, 'an admin can read every job');
reset role;

select * from finish();
rollback;
