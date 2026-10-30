-- Pinned stories (decision 51): an author can pin up to 3 published stories
-- to the top of their wall. pinned_at is when it was pinned (null = not
-- pinned); the wall shows the latest pin first. The limit is enforced here,
-- not only in the app, and a story that stops being published is unpinned.

alter table public.posts add column pinned_at timestamptz;

create function private.check_pinned_posts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' then
    new.pinned_at := null;
  end if;
  if new.pinned_at is not null
     and (tg_op = 'INSERT' or old.pinned_at is null)
     and (select count(*) from public.posts p
          where p.author_id = new.author_id and p.pinned_at is not null and p.id <> new.id) >= 3 then
    raise exception 'You can pin up to 3 stories' using errcode = 'P0001', hint = 'pin_limit';
  end if;
  return new;
end;
$$;
revoke all on function private.check_pinned_posts() from public, anon, authenticated, service_role;

create trigger posts_check_pinned
  before insert or update of pinned_at, status on public.posts
  for each row execute function private.check_pinned_posts();
