-- Card size per story (decision 45). Every card of a story has the same
-- shape: '1:1' square (320×320 reference px, the only shape until now) or
-- '4:5' portrait (320×400, exported at 1080×1350). 16:9 and 9:16 come later
-- by widening the check below and adding them to src/lib/cardGeometry.js.
--
-- The column default stays '1:1' so existing stories, and any client that
-- doesn't send the field yet, keep square cards exactly as before. The app
-- itself chooses 4:5 for new stories once every renderer supports it.
alter table public.posts
  add column card_size text not null default '1:1'
  constraint posts_card_size_check check (card_size in ('1:1', '4:5'));
