-- StoryWall: first database schema (migration Phase 2, docs/migration-plan.md).
-- Reproduces the Base44 entities the app uses (User, Post, Media,
-- OnboardingDraft, PremiumGrant) with the same access rules, except for the
-- privacy requirements (decision 14):
--   * no e-mail address outside auth.users (Supabase's own table);
--   * a private profile is readable only by its owner and admins;
--   * a story's private notes (raw_notes) live in their own owner-only table;
--   * roles (admin) live in their own table that users can't write;
--   * ownership can't be changed by editing a row (USING + WITH CHECK).
-- New tables get no automatic grants on the hosted projects (decision 5); the
-- local/CI database may grant by default, so each table and function first
-- has all access revoked, then gets only the explicit grants below. RLS is
-- enabled on every table.

-- ── Helper schema (not exposed through the Data API) ─────────────────────
-- Supabase: security-definer functions must not live in an exposed schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ── Admins ────────────────────────────────────────────────────────────────
-- Replaces Base44's built-in User.role. A row here = admin. Written only by
-- the service role (dashboard / server code), never by users.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated, service_role;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public, anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;

-- Users may see only their own admin row (so the app can show admin tools).
create policy "admins: read own row" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.admins to service_role;

-- ── Profiles (Base44 User: public profile fields) ────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Same format as src/lib/usernameValidation.js; reserved words are checked
  -- by the server function that sets it. Unique, so no claims table needed.
  username text unique
    check (username ~ '^[a-z0-9_-]{3,30}$' and username !~ '^-|-$'),
  full_name text,
  display_name text,
  headline text,
  bio text,
  location text,
  profile_image text,
  skills text[] not null default '{}',
  links jsonb not null default '[]'::jsonb,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated, service_role;

-- Public profiles are readable by everyone; private ones only by their owner
-- and admins (others get nothing; "this profile is private" comes from a
-- server function that reveals only the username).
create policy "profiles: read public, own or as admin" on public.profiles
  for select to anon, authenticated
  using (not is_private or id = (select auth.uid()) or (select private.is_admin()));

-- Users edit only their own profile; the id can't be changed to someone
-- else's (checked before and after).
create policy "profiles: update own or as admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

grant select on public.profiles to anon, authenticated;
-- Only these columns can be edited from the app. username is set through the
-- server function (format + reserved words + uniqueness), id never changes.
grant update (full_name, display_name, headline, bio, location, profile_image,
              skills, links, is_private) on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- Every new account gets an empty profile (username comes at onboarding).
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── Premium grants (Base44 PremiumGrant) ─────────────────────────────────
create table public.premium_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.premium_grants enable row level security;
revoke all on public.premium_grants from anon, authenticated, service_role;

create policy "premium_grants: read own or as admin" on public.premium_grants
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "premium_grants: admins write" on public.premium_grants
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
grant select, insert, update, delete on public.premium_grants to authenticated;
grant select, insert, update, delete on public.premium_grants to service_role;

-- Same rule as base44/shared/premium.ts: admins are always premium.
-- Used by server functions (with a user id) and by the app (own account).
create function private.has_premium(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = uid)
      or exists (select 1 from public.premium_grants g where g.user_id = uid);
$$;
revoke all on function private.has_premium(uuid) from public, anon, authenticated, service_role;
grant execute on function private.has_premium(uuid) to service_role;

-- What the signed-in user may use: { is_admin, is_premium } for themselves
-- only. Replaces the app's PremiumGrant.filter / user.role checks. Runs with
-- the caller's own rights (security invoker): the policies above let it see
-- only the caller's own admins / premium_grants rows.
create function public.my_access()
returns table (is_admin boolean, is_premium boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin(),
         private.is_admin()
         or exists (select 1 from public.premium_grants g where g.user_id = (select auth.uid()));
$$;
revoke all on function public.my_access() from public, anon, authenticated, service_role;
grant execute on function public.my_access() to authenticated;

-- ── Posts (Base44 Post = a story) ─────────────────────────────────────────
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default '',
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  -- cards[] with elements[], stored whole: every field is kept (Base44 dropped
  -- undeclared fields, see CLAUDE.md).
  cards jsonb not null default '[]'::jsonb,
  color_tokens jsonb not null default '[]'::jsonb,
  cover_image text,
  tags text[] not null default '{}',
  display_order integer,
  ai_generated boolean not null default false,
  generation_style text,
  skill_refresh_count integer not null default 0,
  skill_refresh_date text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_author_status_idx on public.posts (author_id, status);
alter table public.posts enable row level security;
revoke all on public.posts from anon, authenticated, service_role;

-- Published stories are public unless the author's profile is private (the
-- profiles policy hides private profiles, so the exists() fails for them).
-- Drafts and archived stories: author and admins only.
create policy "posts: read published, own or as admin" on public.posts
  for select to anon, authenticated
  using (
    (status = 'published' and exists (select 1 from public.profiles p where p.id = posts.author_id))
    or author_id = (select auth.uid())
    or (select private.is_admin())
  );
create policy "posts: create own" on public.posts
  for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "posts: update own or as admin" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()))
  with check (author_id = (select auth.uid()) or (select private.is_admin()));
create policy "posts: delete own or as admin" on public.posts
  for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()));

grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update, delete on public.posts to service_role;

-- A story's private notes (Base44 Post.raw_notes: the notes given to
-- Generate). Never sent to visitors: author and admins only.
create table public.post_notes (
  post_id uuid primary key references public.posts (id) on delete cascade,
  raw_notes text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.post_notes enable row level security;
revoke all on public.post_notes from anon, authenticated, service_role;
create policy "post_notes: own or as admin" on public.post_notes
  for all to authenticated
  using (
    post_id in (select p.id from public.posts p where p.author_id = (select auth.uid()))
    or (select private.is_admin())
  )
  with check (
    post_id in (select p.id from public.posts p where p.author_id = (select auth.uid()))
    or (select private.is_admin())
  );
grant select, insert, update, delete on public.post_notes to authenticated;
grant select, insert, update, delete on public.post_notes to service_role;

-- ── Media (Base44 Media: uploaded files of a user) ────────────────────────
-- Rows are written by server functions (like Base44's registerMedia);
-- users read and delete their own.
create table public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video', 'audio')),
  duration numeric,
  created_at timestamptz not null default now()
);
create index media_user_idx on public.media (user_id);
alter table public.media enable row level security;
revoke all on public.media from anon, authenticated, service_role;
create policy "media: read own or as admin" on public.media
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "media: delete own or as admin" on public.media
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
grant select, delete on public.media to authenticated;
grant select, insert, update, delete on public.media to service_role;

-- ── Onboarding drafts (Base44 OnboardingDraft) ───────────────────────────
create table public.onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  step integer,
  data text, -- JSON text of the in-progress form, as in Base44
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index onboarding_drafts_user_idx on public.onboarding_drafts (user_id);
alter table public.onboarding_drafts enable row level security;
revoke all on public.onboarding_drafts from anon, authenticated, service_role;
create policy "onboarding_drafts: own or as admin" on public.onboarding_drafts
  for all to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));
grant select, insert, update, delete on public.onboarding_drafts to authenticated;
grant select, insert, update, delete on public.onboarding_drafts to service_role;

-- ── updated_at (Base44's built-in updated_date) ──────────────────────────
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated, service_role;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger posts_updated_at before update on public.posts
  for each row execute function private.touch_updated_at();
create trigger post_notes_updated_at before update on public.post_notes
  for each row execute function private.touch_updated_at();
create trigger onboarding_drafts_updated_at before update on public.onboarding_drafts
  for each row execute function private.touch_updated_at();
