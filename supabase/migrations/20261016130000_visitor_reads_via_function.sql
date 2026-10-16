-- Visitors read walls only through getPublicProfile (2026-10-16).
--
-- Why: visitors (not signed in) could read public.profiles and public.posts
-- directly through the database API. Everything there is public anyway, but
-- one request returned every public profile and every published story at
-- once, which makes bulk copying of the whole site trivial. The app never
-- reads these tables as a visitor: walls load through the getPublicProfile
-- function (which uses the service key and returns only wall fields), and
-- username checks through checkUsername. So visitors lose direct read
-- access; signed-in users keep it (searchProfiles runs as the caller, and
-- owners read their own rows).
--
-- The select policies still list anon; without the table grant they no
-- longer apply to visitors, and they are left unchanged so the rules for
-- signed-in users stay exactly as they were.

revoke select on public.profiles from anon;
revoke select on public.posts from anon;
