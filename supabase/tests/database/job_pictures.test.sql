-- Picture updates in a Generate job (migration 20261016170000): one picture
-- at a time, claimed once, job done when none is left. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e7', 'pictures@example.test');
insert into public.generation_jobs (id, user_id, status, pictures) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e7', 'pictures',
   '[{"index":0,"status":"pending","prompt":"a"},{"index":3,"status":"pending","prompt":"b"}]');

-- Users can't call it, not even on their own job.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e7';
select throws_ok($$ select public.update_job_picture('40000000-0000-0000-0000-000000000001', 0, '{pending}', '{"status":"done"}') $$,
  '42501', null, 'a user cannot change job pictures');
reset role;

set local role service_role;
select ok(public.update_job_picture('40000000-0000-0000-0000-000000000001', 0, '{pending}', '{"status":"running"}'),
  'the server claims picture 0');
select ok(not public.update_job_picture('40000000-0000-0000-0000-000000000001', 0, '{pending}', '{"status":"running"}'),
  'picture 0 cannot be claimed twice');
select ok(not public.update_job_picture('40000000-0000-0000-0000-000000000001', 7, '{pending}', '{"status":"running"}'),
  'an index that is not in the job is refused');
select ok(public.update_job_picture('40000000-0000-0000-0000-000000000001', 0, '{running}', '{"status":"done","url":"https://x/0.png"}'),
  'picture 0 is saved');
reset role;

select is((select pictures from public.generation_jobs where id = '40000000-0000-0000-0000-000000000001'),
  '[{"index":0,"status":"done","prompt":"a","url":"https://x/0.png"},{"index":3,"status":"pending","prompt":"b"}]'::jsonb,
  'only picture 0 changed, order kept');
select is((select status from public.generation_jobs where id = '40000000-0000-0000-0000-000000000001'), 'pictures',
  'the job is not done while a picture is pending');

set local role service_role;
select ok(public.update_job_picture('40000000-0000-0000-0000-000000000001', 3, '{pending}', '{"status":"failed"}'),
  'picture 3 fails');
reset role;
select is((select status from public.generation_jobs where id = '40000000-0000-0000-0000-000000000001'), 'done',
  'the job is done when no picture is pending or running');
select isnt((select finished_at from public.generation_jobs where id = '40000000-0000-0000-0000-000000000001'), null,
  'the job records when it finished');

select * from finish();
rollback;
