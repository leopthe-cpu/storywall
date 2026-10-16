-- Generate as a server job, step 7: the "Your story is ready" e-mail
-- (docs/performance-plan.md, decided by Oz 2026-10-16).
--
-- When a Generate run has been finished for 2 minutes and nobody has seen it
-- (the generating screen, the Drafts list and the "ready" toast all mark a
-- run seen, so unseen means the user isn't in the app), send one e-mail:
-- "Your story is ready for your review". At most one per run.
--
-- It runs inside the database, once a minute (pg_cron), and sends through
-- Resend's API with pg_net (both per Supabase's docs). The Resend key is
-- never in code: it lives in Supabase Vault under the name 'resend_api_key',
-- added by Oz in the dashboard. Without it nothing is sent. 'app_url' in
-- Vault sets the link in the e-mail (staging vs storywall.io).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create function private.send_ready_emails()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  api_key text;
  app_url text;
  job record;
  sent integer := 0;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  if api_key is null or api_key = '' then
    return 0;
  end if;
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'app_url'),
    'https://storywall.io'
  ) into app_url;

  for job in
    select j.id, u.email
    from public.generation_jobs j
    join auth.users u on u.id = j.user_id
    where j.status = 'done'
      and j.seen_at is null
      and j.email_sent_at is null
      and j.finished_at < now() - interval '2 minutes'
      -- Old runs (e.g. from before this existed) never get an e-mail.
      and j.finished_at > now() - interval '1 day'
      and u.email is not null
    order by j.finished_at
    limit 50
    for update of j skip locked
  loop
    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || api_key,
        -- One key per run, so a repeated request is recognised as the same
        -- e-mail (Resend's idempotency key; email_sent_at below is the
        -- main guard).
        'Idempotency-Key', 'story-ready-' || job.id
      ),
      body := jsonb_build_object(
        'from', 'Storywall <no-reply@send.storywall.io>',
        'to', jsonb_build_array(job.email),
        'subject', 'Your story is ready for your review',
        'text', 'Your story is ready for your review. Open Storywall and find it in Drafts: ' || app_url || '/create',
        'html', '<p>Your story is ready for your review.</p>'
          || '<p><a href="' || app_url || '/create">Open Storywall</a> and find it in Drafts.</p>'
      ),
      timeout_milliseconds := 5000
    );
    update public.generation_jobs set email_sent_at = now() where id = job.id;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;
revoke all on function private.send_ready_emails() from public, anon, authenticated, service_role;

select cron.schedule('send-ready-emails', '* * * * *', 'select private.send_ready_emails()');
