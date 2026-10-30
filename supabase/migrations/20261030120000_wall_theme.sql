-- Profile colours (decision 49; a Lifetime feature per decision 50): the
-- three colours a supporter picks for their public wall, as
-- { "bg": "#RRGGBB", "text": "#RRGGBB", "tag": "#RRGGBB" } or null (the
-- plain theme). Setting colours needs Lifetime (or admin), checked here, not
-- only in the app; clearing them is always allowed. If Lifetime ends, the
-- saved colours stay but the wall shows the plain theme (getPublicProfile
-- only returns them for a Lifetime owner).

alter table public.profiles add column wall_theme jsonb
  constraint profiles_wall_theme_check check (
    wall_theme is null or (
      jsonb_typeof(wall_theme) = 'object'
      and wall_theme - 'bg' - 'text' - 'tag' = '{}'::jsonb
      and coalesce(wall_theme ->> 'bg', '') ~ '^#[0-9a-fA-F]{6}$'
      and coalesce(wall_theme ->> 'text', '') ~ '^#[0-9a-fA-F]{6}$'
      and coalesce(wall_theme ->> 'tag', '') ~ '^#[0-9a-fA-F]{6}$'
    )
  );

grant update (wall_theme) on public.profiles to authenticated;

create function private.check_wall_theme()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.wall_theme is not null
     and new.wall_theme is distinct from old.wall_theme
     and not private.has_lifetime(new.id) then
    raise exception 'Profile colours are for Lifetime supporters' using errcode = 'P0001', hint = 'lifetime_required';
  end if;
  return new;
end;
$$;
revoke all on function private.check_wall_theme() from public, anon, authenticated, service_role;

create trigger profiles_check_wall_theme
  before update of wall_theme on public.profiles
  for each row execute function private.check_wall_theme();
