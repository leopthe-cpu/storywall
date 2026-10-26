-- Card size per story (migration 20261026120000): existing and new stories
-- are square unless they say otherwise; only known sizes are accepted; the
-- author can change it. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'size-a@example.test');
insert into public.posts (id, author_id, title, status) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', 'no size given', 'draft');

select col_not_null('public', 'posts', 'card_size', 'every story has a card size');
select is((select card_size from public.posts where id = '40000000-0000-0000-0000-000000000001'), '1:1',
  'a story saved without a size is square (existing stories stay 1:1)');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';

select lives_ok($$ insert into public.posts (id, title, status, card_size)
                   values ('40000000-0000-0000-0000-000000000002', 'portrait', 'draft', '4:5') $$,
  'the author can create a 4:5 story');
select throws_ok($$ insert into public.posts (title, status, card_size) values ('bad', 'draft', '3:2') $$,
  '23514', null, 'unknown sizes are refused');
select lives_ok($$ update public.posts set card_size = '1:1' where id = '40000000-0000-0000-0000-000000000002' $$,
  'the author can switch a story''s size');
select is((select card_size from public.posts where id = '40000000-0000-0000-0000-000000000002'), '1:1',
  'the switched size is saved');

select * from finish();
rollback;
