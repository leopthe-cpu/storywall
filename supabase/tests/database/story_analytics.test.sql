-- Premium analytics (migration 20261030130000): only a Premium author gets
-- their own daily counts. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'stats-author@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'stats-other@example.test');
insert into public.posts (id, author_id, title, status) values
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 'read', 'published');
set local role service_role;
select public.record_story_view('70000000-0000-0000-0000-000000000001', -1, 'v1');
select public.record_story_view('70000000-0000-0000-0000-000000000001', 0, 'v1');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select is((select count(*)::int from public.my_story_analytics()), 0, 'an author without Premium gets nothing');
reset role;

insert into public.premium_grants (user_id) values ('00000000-0000-0000-0000-0000000000d1');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select is((select count(*)::int from public.my_story_analytics()), 2, 'a Premium author gets the story and card rows');
select results_eq($$ select views from public.my_story_analytics() where card_index = -1 $$, array[1],
  'with their counts');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
select is((select count(*)::int from public.my_story_analytics()), 0, 'nobody sees another author''s counts');
reset role;

select * from finish();
rollback;
