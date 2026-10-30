-- Profile colours (migration 20261030120000): only Lifetime supporters (and
-- admins) can set them, only as three hex colours, and anyone can clear
-- theirs. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'theme-free@example.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'theme-lifetime@example.test');
insert into public.lifetime_grants (user_id) values ('00000000-0000-0000-0000-0000000000c2');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select throws_ok($$ update public.profiles set wall_theme = '{"bg":"#112233","text":"#FFFFFF","tag":"#FFCC00"}'
                   where id = auth.uid() $$,
  'P0001', 'Profile colours are for Lifetime supporters', 'a free user cannot set profile colours');
select lives_ok($$ update public.profiles set wall_theme = null where id = auth.uid() $$,
  'anyone can clear their colours');
select lives_ok($$ update public.profiles set bio = 'hi' where id = auth.uid() $$,
  'other profile edits are unaffected');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select lives_ok($$ update public.profiles set wall_theme = '{"bg":"#112233","text":"#FFFFFF","tag":"#FFCC00"}'
                   where id = auth.uid() $$,
  'a Lifetime supporter sets profile colours');
select is((select wall_theme ->> 'bg' from public.profiles where id = auth.uid()), '#112233', 'the colours are saved');
select throws_ok($$ update public.profiles set wall_theme = '{"bg":"red","text":"#FFFFFF","tag":"#FFCC00"}'
                   where id = auth.uid() $$,
  '23514', null, 'colours must be #RRGGBB');
select throws_ok($$ update public.profiles set wall_theme = '{"bg":"#112233","text":"#FFFFFF","tag":"#FFCC00","x":"#000000"}'
                   where id = auth.uid() $$,
  '23514', null, 'no other keys are accepted');
select results_eq($$ with u as (update public.profiles set wall_theme = '{"bg":"#000000","text":"#FFFFFF","tag":"#FFFFFF"}'
                     where id = '00000000-0000-0000-0000-0000000000c1' returning 1) select count(*)::int from u $$,
  array[0], 'nobody can set someone else''s colours');
reset role;

select * from finish();
rollback;
