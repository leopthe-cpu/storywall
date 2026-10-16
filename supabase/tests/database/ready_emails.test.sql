-- "Your story is ready" e-mails (migration 20261016180000): only finished,
-- unseen runs older than 2 minutes get one, once; nothing without a Resend
-- key; users can't trigger it. Everything is rolled back, so no request is
-- ever sent (pg_net sends only after a commit).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'ready@example.test');
insert into public.generation_jobs (id, user_id, status, finished_at, seen_at) values
  -- eligible: done 5 minutes ago, never seen
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 'done', now() - interval '5 minutes', null),
  -- seen in the app: no e-mail
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000d1', 'done', now() - interval '5 minutes', now()),
  -- finished under 2 minutes ago: not yet
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000d1', 'done', now() - interval '30 seconds', null),
  -- failed: no "ready" e-mail
  ('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000d1', 'failed', now() - interval '5 minutes', null),
  -- older than a day: never
  ('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000d1', 'done', now() - interval '2 days', null);

select isnt_empty($$ select 1 from cron.job where jobname = 'send-ready-emails' and schedule = '* * * * *' $$,
  'the e-mail check is scheduled every minute');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select throws_ok($$ select private.send_ready_emails() $$, '42501', null, 'a user cannot trigger e-mails');
reset role;

-- No Resend key in Vault: nothing is sent or marked.
select is(private.send_ready_emails(), 0, 'without a Resend key nothing is sent');
select is((select email_sent_at from public.generation_jobs where id = '50000000-0000-0000-0000-000000000001'), null,
  'without a Resend key the run is not marked');

-- With a key: exactly the eligible run, once.
select lives_ok($$ select vault.create_secret('test-not-a-real-key', 'resend_api_key') $$, 'a key is added to Vault');
select is(private.send_ready_emails(), 1, 'one e-mail for the one eligible run');
select isnt((select email_sent_at from public.generation_jobs where id = '50000000-0000-0000-0000-000000000001'), null,
  'the eligible run is marked as e-mailed');
select is((select count(*)::int from public.generation_jobs
           where id <> '50000000-0000-0000-0000-000000000001' and email_sent_at is not null), 0,
  'seen, recent, failed and old runs get no e-mail');
select is(private.send_ready_emails(), 0, 'a run is never e-mailed twice');

select * from finish();
rollback;
