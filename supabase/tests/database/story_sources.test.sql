-- Traffic sources (migration 20261030150000): story views are counted per
-- source; card views and views without a source aren't; only a Premium
-- author reads their own. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'src-author@example.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'src-other@example.test');
insert into public.posts (id, author_id, title, status) values
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', 'shared', 'published');

set local role service_role;
select public.record_story_view('80000000-0000-0000-0000-000000000001', -1, 'v1', 'li');
select public.record_story_view('80000000-0000-0000-0000-000000000001', -1, 'v2', 'li');
select public.record_story_view('80000000-0000-0000-0000-000000000001', -1, 'v3', 'linkedin.com');
select public.record_story_view('80000000-0000-0000-0000-000000000001', 0, 'v1', 'li');
select public.record_story_view('80000000-0000-0000-0000-000000000001', -1, 'v4');
select throws_ok($$ select public.record_story_view('80000000-0000-0000-0000-000000000001', -1, 'v5', 'Not A Domain!') $$,
  '23514', null, 'a source outside the allowed shape is refused');
reset role;

select results_eq($$ select source, views from public.story_source_days order by source $$,
  $$ values ('li'::text, 2), ('linkedin.com'::text, 1) $$,
  'story views are counted per source; card views and views without a source are not');
select results_eq($$ select views from public.story_view_days where card_index = -1 $$, array[4],
  'all story views are still counted');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select is((select count(*)::int from public.my_story_sources()), 0, 'an author without Premium gets nothing');
select throws_ok($$ select * from public.story_source_days $$, '42501', null, 'the table can''t be read directly');
reset role;

insert into public.premium_grants (user_id) values ('00000000-0000-0000-0000-0000000000e1');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select is((select count(*)::int from public.my_story_sources()), 2, 'a Premium author gets their sources');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select is((select count(*)::int from public.my_story_sources()), 0, 'nobody sees another author''s sources');
reset role;

select * from finish();
rollback;
