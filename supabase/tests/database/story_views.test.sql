-- Story views (migration 20261029140000): all and unique views per day,
-- only server functions record them, only Lifetime authors read the totals.
-- Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'views-author@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'views-other@example.test');
insert into public.posts (id, author_id, title, status) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'viewed', 'published');

-- As the server functions do (service role).
set local role service_role;
select lives_ok($$ select public.record_story_view('60000000-0000-0000-0000-000000000001', -1, 'visitor-1') $$,
  'a server function records a story view');
select public.record_story_view('60000000-0000-0000-0000-000000000001', -1, 'visitor-1');
select public.record_story_view('60000000-0000-0000-0000-000000000001', -1, 'visitor-2');
select public.record_story_view('60000000-0000-0000-0000-000000000001', 0, 'visitor-1');
reset role;

select results_eq($$ select views, unique_views from public.story_view_days
                     where post_id = '60000000-0000-0000-0000-000000000001' and card_index = -1 $$,
  $$ values (3, 2) $$, 'story: 3 views, 2 unique (the same visitor counts once a day)');
select results_eq($$ select views, unique_views from public.story_view_days
                     where post_id = '60000000-0000-0000-0000-000000000001' and card_index = 0 $$,
  $$ values (1, 1) $$, 'cards are counted separately');
select is((select count(*)::int from private.view_salts), 1, 'one secret, for today only');
select is((select count(*)::int from private.view_seen where visitor = convert_to('visitor-1', 'UTF8')), 0,
  'visitors are stored only as hashes');

-- Visitors and users cannot record or read raw counts.
set local role anon;
select throws_ok($$ select public.record_story_view('60000000-0000-0000-0000-000000000001', -1, 'x') $$,
  '42501', null, 'a visitor cannot record views directly');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select throws_ok($$ select count(*) from public.story_view_days $$,
  '42501', null, 'the daily table is not readable directly');
select is((select count(*)::int from public.my_story_view_totals()), 0,
  'an author without Lifetime gets no totals');
reset role;

insert into public.lifetime_grants (user_id) values ('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select results_eq($$ select post_id, unique_views from public.my_story_view_totals() $$,
  $$ values ('60000000-0000-0000-0000-000000000001'::uuid, 2::bigint) $$,
  'a Lifetime author sees each story''s unique views');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select is((select count(*)::int from public.my_story_view_totals()), 0,
  'nobody sees another author''s totals');
reset role;

delete from public.posts where id = '60000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.story_view_days), 0, 'deleting a story deletes its counts');

select * from finish();
rollback;
