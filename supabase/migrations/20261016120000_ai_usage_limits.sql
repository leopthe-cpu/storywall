-- Daily per-user limits on AI calls (2026-10-16).
--
-- Why: any signed-in user (sign-up is free) could call the skill
-- suggestions function as often as they liked, and each call is a paid AI
-- request. The "refresh" limit the app shows is stored on the story, which
-- the user can edit, so it can't be relied on. The limit has to live where
-- users can't touch it and be checked by the server function itself.
--
-- private.ai_usage counts calls per user, per kind of call, per UTC day. It
-- sits in the private schema (not exposed through the API) and has no grants
-- to visitors or users. public.consume_ai_quota() is the only way to change
-- it: one atomic "add one and tell me if that's still within the limit",
-- callable only with the service key (the server functions), never by users.

create table private.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  day date not null default (now() at time zone 'utc')::date,
  calls integer not null default 0,
  primary key (user_id, kind, day)
);
alter table private.ai_usage enable row level security;
revoke all on private.ai_usage from public, anon, authenticated;

-- Counts one call and returns true while the user is within p_limit calls
-- of this kind today. A call over the limit is still counted (so hammering
-- doesn't reset anything) and returns false.
create function public.consume_ai_quota(p_user uuid, p_kind text, p_limit integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  insert into private.ai_usage as u (user_id, kind, day, calls)
  values (p_user, p_kind, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, kind, day) do update set calls = u.calls + 1
  returning calls <= p_limit;
$$;
revoke execute on function public.consume_ai_quota(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, integer) to service_role;
