-- File storage rules: buckets exist with the right settings, and each user
-- can only add or see files in their own folder. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test');

select results_eq($$ select public, file_size_limit from storage.buckets where id = 'drafts' $$,
  $$ values (false, 52428800::bigint) $$, 'drafts is private, 50 MB per file');
select results_eq($$ select public, file_size_limit from storage.buckets where id = 'public-media' $$,
  $$ values (true, 52428800::bigint) $$, 'public-media is public, 50 MB per file');

-- Alice
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select lives_ok($$ insert into storage.objects (bucket_id, name) values
  ('drafts', '00000000-0000-0000-0000-00000000000a/photo.png') $$,
  'Alice uploads a draft file to her own folder');
select lives_ok($$ insert into storage.objects (bucket_id, name) values
  ('public-media', '00000000-0000-0000-0000-00000000000a/profile.png') $$,
  'Alice uploads a public file to her own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values
  ('drafts', '00000000-0000-0000-0000-00000000000b/sneaky.png') $$,
  '42501', null, 'Alice cannot upload into Bob''s draft folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values
  ('public-media', '00000000-0000-0000-0000-00000000000b/sneaky.png') $$,
  '42501', null, 'Alice cannot upload into Bob''s public folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values
  ('drafts', 'no-owner-folder.png') $$,
  '42501', null, 'files outside an owner folder are refused');
select is((select count(*)::int from storage.objects where bucket_id = 'drafts'), 1,
  'Alice sees her own draft file');
reset role;

-- Bob
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from storage.objects where bucket_id = 'drafts'), 0,
  'Bob cannot see Alice''s draft files');
select is((select count(*)::int from storage.objects where bucket_id = 'public-media'), 0,
  'Bob cannot list Alice''s public folder');
reset role;

-- Visitor
set local role anon;
select is((select count(*)::int from storage.objects), 0, 'a visitor cannot list any files');
reset role;

select * from finish();
rollback;
