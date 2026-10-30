-- Story and card views (decisions 34, 50, 51). A view counts when a story is
-- seen on screen; each card counts when it is shown. The owner's own views
-- never count (checked by the recordView server function).
--
-- Two numbers: all views and unique views (each viewer once). Without
-- storing personal data: a viewer is recognised by a hash of their address
-- and browser mixed with a random secret for the day. Each day's secret is
-- deleted after the day, and so are the day's hashes, so a viewer can't be
-- traced back or followed across days. The cost: the same person on two
-- different days is two unique views.

create extension if not exists pgcrypto with schema extensions;

-- Daily totals. card_index -1 = the story as a whole, 0.. = its cards.
create table public.story_view_days (
  post_id uuid not null references public.posts (id) on delete cascade,
  day date not null,
  card_index smallint not null check (card_index >= -1),
  views integer not null default 0,
  unique_views integer not null default 0,
  primary key (post_id, day, card_index)
);
alter table public.story_view_days enable row level security;
revoke all on public.story_view_days from anon, authenticated, service_role;
-- No policies: read only through the functions below.

create table private.view_salts (
  day date primary key,
  salt bytea not null
);
create table private.view_seen (
  post_id uuid not null,
  day date not null,
  card_index smallint not null,
  visitor bytea not null,
  primary key (post_id, day, card_index, visitor)
);
-- record_story_view clears earlier days on every call.
create index view_seen_day_idx on private.view_seen (day);
alter table private.view_salts enable row level security;
alter table private.view_seen enable row level security;
revoke all on private.view_salts, private.view_seen from public, anon, authenticated;

-- Counts one view of p_post_id (card p_card_index, or -1 for the story) by
-- p_visitor (address + browser, sent by the server function, never stored).
-- Called only by server functions (service role).
create function public.record_story_view(p_post_id uuid, p_card_index integer, p_visitor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_salt bytea;
  v_hash bytea;
  v_new integer;
begin
  -- Forget earlier days' secrets and hashes (after this, old hashes can't
  -- be matched to anyone).
  delete from private.view_salts where day < v_day;
  delete from private.view_seen where day < v_day;

  insert into private.view_salts (day, salt) values (v_day, extensions.gen_random_bytes(32))
  on conflict (day) do nothing;
  select salt into v_salt from private.view_salts where day = v_day;
  v_hash := extensions.digest(v_salt || convert_to(p_visitor || '|' || p_post_id::text, 'UTF8'), 'sha256');

  insert into private.view_seen (post_id, day, card_index, visitor)
  values (p_post_id, v_day, p_card_index, v_hash)
  on conflict do nothing;
  get diagnostics v_new = row_count;

  insert into public.story_view_days as d (post_id, day, card_index, views, unique_views)
  values (p_post_id, v_day, p_card_index, 1, v_new)
  on conflict (post_id, day, card_index) do update
    set views = d.views + 1, unique_views = d.unique_views + v_new;
end;
$$;
revoke all on function public.record_story_view(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.record_story_view(uuid, integer, text) to service_role;

-- Lifetime supporters (and admins) see each of their stories' unique views
-- (decision 50: one number per story). Everyone else gets nothing.
create function public.my_story_view_totals()
returns table (post_id uuid, unique_views bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select d.post_id, sum(d.unique_views)::bigint
  from public.story_view_days d
  join public.posts p on p.id = d.post_id
  where p.author_id = (select auth.uid())
    and d.card_index = -1
    and private.has_lifetime((select auth.uid()))
  group by d.post_id;
$$;
revoke all on function public.my_story_view_totals() from public, anon, authenticated;
grant execute on function public.my_story_view_totals() to authenticated;
