-- The Premium analytics screen (decisions 34, 50): a Premium author's own
-- daily story and card view counts for the last p_days days. Everyone else
-- gets nothing; the database decides, like my_story_view_totals.

create function public.my_story_analytics(p_days integer default 90)
returns table (post_id uuid, day date, card_index smallint, views integer, unique_views integer)
language sql
stable
security definer
set search_path = ''
as $$
  select d.post_id, d.day, d.card_index, d.views, d.unique_views
  from public.story_view_days d
  join public.posts p on p.id = d.post_id
  where p.author_id = (select auth.uid())
    and d.day >= (now() at time zone 'utc')::date - greatest(1, least(coalesce(p_days, 90), 366))
    and private.has_premium((select auth.uid()))
  order by d.day;
$$;
revoke all on function public.my_story_analytics(integer) from public, anon, authenticated;
grant execute on function public.my_story_analytics(integer) to authenticated;
