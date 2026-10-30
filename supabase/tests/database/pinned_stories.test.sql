-- Pinned stories (migration 20261029130000, decision 51): up to 3 per author,
-- published stories only, set by the author. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'pin-a@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'pin-b@example.test');
insert into public.posts (id, author_id, title, status) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 's1', 'published'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 's2', 'published'),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a1', 's3', 'published'),
  ('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a1', 's4', 'published'),
  ('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000a1', 'd1', 'draft'),
  ('50000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000a2', 'b1', 'published');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

select lives_ok($$ update public.posts set pinned_at = now()
                   where id in ('50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002') $$,
  'the author pins two stories');
select lives_ok($$ update public.posts set pinned_at = now() where id = '50000000-0000-0000-0000-000000000003' $$,
  'the author pins a third story');
select throws_ok($$ update public.posts set pinned_at = now() where id = '50000000-0000-0000-0000-000000000004' $$,
  'P0001', 'You can pin up to 3 stories', 'a fourth pin is refused');
select lives_ok($$ update public.posts set pinned_at = now() where id = '50000000-0000-0000-0000-000000000001' $$,
  're-pinning an already pinned story is allowed');
select lives_ok($$ update public.posts set pinned_at = null where id = '50000000-0000-0000-0000-000000000003' $$,
  'the author unpins a story');
select is((select pinned_at from public.posts where id = '50000000-0000-0000-0000-000000000005'), null,
  'a draft starts unpinned');
update public.posts set pinned_at = now() where id = '50000000-0000-0000-0000-000000000005';
select is((select pinned_at from public.posts where id = '50000000-0000-0000-0000-000000000005'), null,
  'a draft cannot be pinned');
update public.posts set status = 'archived' where id = '50000000-0000-0000-0000-000000000002';
select is((select pinned_at from public.posts where id = '50000000-0000-0000-0000-000000000002'), null,
  'archiving a story unpins it');

select * from finish();
rollback;
