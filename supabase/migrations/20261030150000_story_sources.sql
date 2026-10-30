-- Traffic sources for Premium analytics (decisions 50, 53): where a story's
-- viewers came from. A link copied from Storywall carries a short tag
-- (?via=li, ig, x, email, link); without one, the site the visitor came
-- from (its domain only, e.g. linkedin.com); otherwise "direct". Daily
-- counts per story and source, nothing about the visitor.

create table public.story_source_days (
  post_id uuid not null references public.posts (id) on delete cascade,
  day date not null,
  source text not null check (source ~ '^[a-z0-9.-]{1,100}$'),
  views integer not null default 0,
  primary key (post_id, day, source)
);
alter table public.story_source_days enable row level security;
revoke all on public.story_source_days from anon, authenticated, service_role;
-- No policies: read only through my_story_sources.

-- record_story_view gains the source of a story view (p_source; ignored for
-- card views and when null). The old three-argument form is replaced, so a
-- server function still calling it without a source keeps working.
drop function public.record_story_view(uuid, integer, text);
create function public.record_story_view(p_post_id uuid, p_card_index integer, p_visitor text, p_source text default null)
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

  if p_card_index = -1 and p_source is not null then
    insert into public.story_source_days as s (post_id, day, source, views)
    values (p_post_id, v_day, p_source, 1)
    on conflict (post_id, day, source) do update set views = s.views + 1;
  end if;
end;
$$;
revoke all on function public.record_story_view(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.record_story_view(uuid, integer, text, text) to service_role;

-- A Premium author's own story views by source for the last p_days days.
-- Everyone else gets nothing; the database decides, like my_story_analytics.
create function public.my_story_sources(p_days integer default 90)
returns table (post_id uuid, day date, source text, views integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.post_id, s.day, s.source, s.views
  from public.story_source_days s
  join public.posts p on p.id = s.post_id
  where p.author_id = (select auth.uid())
    and s.day >= (now() at time zone 'utc')::date - greatest(1, least(coalesce(p_days, 90), 366))
    and private.has_premium((select auth.uid()))
  order by s.day;
$$;
revoke all on function public.my_story_sources(integer) from public, anon, authenticated;
grant execute on function public.my_story_sources(integer) to authenticated;
