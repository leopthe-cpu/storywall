-- Request limits for the functions visitors can call without signing in
-- (getPublicProfile, checkUsername), kept in the database (2026-10-16).
--
-- Why: the limiter in _shared/rateLimit.ts counts in each function
-- instance's memory, and requests spread over many instances, so in a test
-- 55 requests a minute from one address were all accepted (limit 20). A
-- counter in the database is shared by every instance.
--
-- private.rate_limits holds one row per key (e.g. "wall:<ip>"): the start of
-- the current window and the requests seen in it. It is not exposed through
-- the API and has no grants; public.consume_rate_limit() is the only way to
-- use it and only the server functions (service role) can call it.

create table private.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public, anon, authenticated;

-- Counts one request for p_key and returns true while it is within p_limit
-- requests in the current p_window_seconds window (a fixed window that
-- restarts once it has passed). Now and then it also clears rows untouched
-- for a day, so the table stays small.
create function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;
revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
