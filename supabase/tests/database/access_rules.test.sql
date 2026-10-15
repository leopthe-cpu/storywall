-- Access rules (RLS + grants) of the first schema, tested as each kind of
-- caller: a visitor (anon), normal users, a user with a private profile and
-- an admin. Includes what each must NOT be able to do (privacy requirements,
-- decision 14). Run with `supabase test db`; everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

-- ── Test data (as the database owner) ────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test', '{"full_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'p@example.test', '{}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.test', '{}');

update public.profiles set username = 'alice' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob' where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'priv', is_private = true where id = '00000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'boss' where id = '00000000-0000-0000-0000-0000000000ad';
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');
insert into public.premium_grants (user_id, note) values ('00000000-0000-0000-0000-00000000000b', 'test');

insert into public.posts (id, author_id, title, status, cards) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'A published', 'published',
   '[{"id":"c1","elements":[{"id":"e1","type":"text","content":"hi","some_future_field":42}]}]'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'A draft', 'draft', '[]'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'A archived', 'archived', '[]'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000c', 'P published', 'published', '[]');
insert into public.post_notes (post_id, raw_notes) values
  ('10000000-0000-0000-0000-000000000001', 'my private notes');
insert into public.media (user_id, url) values
  ('00000000-0000-0000-0000-00000000000a', 'https://example.test/a.png');
insert into public.onboarding_drafts (user_id, step, data) values
  ('00000000-0000-0000-0000-00000000000a', 2, '{"headline":"x"}');

-- ── Structure ─────────────────────────────────────────────────────────────
select is((select full_name from public.profiles where username = 'alice'), 'Alice',
  'a new account gets a profile (full name from sign-up)');
select hasnt_column('public', 'profiles', 'email', 'profiles have no e-mail column');
select hasnt_column('public', 'posts', 'raw_notes', 'posts have no raw_notes column (own table)');
select is((select cards -> 0 -> 'elements' -> 0 ->> 'some_future_field' from public.posts
           where id = '10000000-0000-0000-0000-000000000001'), '42',
  'card/element fields are stored whole, even ones not known today');
select throws_ok($$ update public.profiles set username = 'Bad Name' where username = 'bob' $$,
  '23514', null, 'username format is enforced');
select throws_ok($$ update public.profiles set username = 'alice' where username = 'bob' $$,
  '23505', null, 'usernames are unique');

-- ── Visitor (not signed in) ──────────────────────────────────────────────
set local role anon;
select is((select count(*)::int from public.profiles), 3, 'visitor sees the 3 public profiles');
select is((select count(*)::int from public.profiles where username = 'priv'), 0,
  'visitor cannot see a private profile');
select is((select array_agg(title order by title) from public.posts), array['A published'],
  'visitor sees only published stories of public profiles');
select throws_ok($$ select * from public.post_notes $$, '42501', null, 'visitor cannot read story notes');
select throws_ok($$ select * from public.media $$, '42501', null, 'visitor cannot read media');
select throws_ok($$ insert into public.posts (author_id, title) values ('00000000-0000-0000-0000-00000000000a', 'x') $$,
  '42501', null, 'visitor cannot create stories');
select throws_ok($$ update public.profiles set bio = 'x' $$, '42501', null, 'visitor cannot edit profiles');
reset role;

-- ── Alice (normal user, public profile) ──────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.posts where author_id = auth.uid()), 3,
  'Alice sees her published, draft and archived stories');
select is((select count(*)::int from public.posts where title = 'P published'), 0,
  'Alice cannot see a private user''s stories');
select is((select raw_notes from public.post_notes), 'my private notes', 'Alice reads her own story notes');
select is((select count(*)::int from public.media), 1, 'Alice sees her own media');
select is((select count(*)::int from public.onboarding_drafts), 1, 'Alice sees her onboarding draft');
select lives_ok($$ update public.profiles set headline = 'PM' where id = auth.uid() $$, 'Alice edits her profile');
select throws_ok($$ update public.profiles set username = 'alice2' where id = auth.uid() $$,
  '42501', null, 'Alice cannot change her username directly (server function only)');
select results_eq($$ with u as (update public.profiles set bio = 'hacked' where username = 'bob' returning 1)
                     select count(*)::int from u $$, array[0], 'Alice cannot edit Bob''s profile');
select throws_ok($$ update public.posts set author_id = '00000000-0000-0000-0000-00000000000b'
                    where id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Alice cannot hand her story to someone else');
select throws_ok($$ insert into public.posts (author_id, title) values ('00000000-0000-0000-0000-00000000000b', 'x') $$,
  '42501', null, 'Alice cannot create a story as Bob');
select lives_ok($$ insert into public.posts (title, status) values ('new', 'draft') $$,
  'Alice creates a story (author defaults to her)');
select throws_ok($$ insert into public.media (user_id, url) values (auth.uid(), 'x') $$,
  '42501', null, 'media rows are written by server functions only');
select throws_ok($$ insert into public.premium_grants (user_id) values (auth.uid()) $$,
  '42501', null, 'Alice cannot give herself premium');
select throws_ok($$ insert into public.admins (user_id) values (auth.uid()) $$,
  '42501', null, 'Alice cannot make herself admin');
select results_eq($$ select is_admin, is_premium from public.my_access() $$,
  $$ values (false, false) $$, 'Alice: not admin, not premium');
select throws_ok($$ select private.has_premium('00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'Alice cannot look up someone else''s premium status');
reset role;

-- ── Bob (normal user with a premium grant) ───────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select results_eq($$ select is_admin, is_premium from public.my_access() $$,
  $$ values (false, true) $$, 'Bob: premium through his grant');
select is((select count(*)::int from public.posts where author_id = '00000000-0000-0000-0000-00000000000a'), 1,
  'Bob sees only Alice''s published story');
select is((select count(*)::int from public.post_notes), 0, 'Bob cannot read Alice''s story notes');
select results_eq($$ with u as (update public.posts set title = 'hacked'
                     where id = '10000000-0000-0000-0000-000000000001' returning 1) select count(*)::int from u $$,
  array[0], 'Bob cannot edit Alice''s story');
select results_eq($$ with d as (delete from public.posts where id = '10000000-0000-0000-0000-000000000001' returning 1)
                     select count(*)::int from d $$, array[0], 'Bob cannot delete Alice''s story');
select is((select count(*)::int from public.onboarding_drafts), 0, 'Bob cannot see Alice''s onboarding draft');
reset role;

-- ── Private-profile user ─────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select is((select username from public.profiles where id = auth.uid()), 'priv',
  'a private user still sees their own profile (fix for the Base44 lock-out)');
select is((select count(*)::int from public.posts where author_id = auth.uid()), 1,
  'a private user still sees their own stories');
reset role;

-- ── Admin ─────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select results_eq($$ select is_admin, is_premium from public.my_access() $$,
  $$ values (true, true) $$, 'admin is always premium');
select is((select count(*)::int from public.profiles), 4, 'admin sees every profile, private too');
select is((select count(*)::int from public.posts), 5, 'admin sees every story');
select lives_ok($$ insert into public.premium_grants (user_id) values ('00000000-0000-0000-0000-00000000000a') $$,
  'admin grants premium');
reset role;

select * from finish();
rollback;
