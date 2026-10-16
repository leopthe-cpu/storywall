-- Generate as a server job, step 1: the jobs table (docs/performance-plan.md,
-- part A, 2026-10-16).
--
-- Why: Generate runs from the browser today, so closing the tab loses the
-- result (and the AI cost is still spent). It will run as a server job
-- instead: a function writes the cards, other calls make the pictures, and
-- the browser only watches this row. Nothing uses the table yet.
--
-- One row per Generate run. Only the server functions (service role) create
-- and update jobs, so a user can't fake progress, results or pictures. The
-- owner (and admins) can read their jobs. The one thing the owner may change
-- is seen_at, which the app sets when it has shown the finished story (or the
-- "ready" toast); the "ready" e-mail goes only to jobs that stay unseen.
-- The notes themselves stay in post_notes (owner-only) and aren't copied here.

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The draft the result lands in. Kept if the job row outlives the draft.
  post_id uuid references public.posts (id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'writing', 'pictures', 'done', 'failed')),
  -- Square today; tall and wide later (plan, part D).
  card_shape text not null default 'square' check (card_shape in ('square', 'tall', 'wide')),
  -- What the run was asked for besides the notes (style, attached pictures).
  options jsonb not null default '{}'::jsonb,
  -- The written story (text and picture prompts, no layout: the browser lays
  -- it out, so new shapes and themes need no server change).
  result jsonb,
  -- One entry per AI picture: {index, status, url, error}.
  pictures jsonb not null default '[]'::jsonb,
  error text,
  seen_at timestamptz,
  email_sent_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index generation_jobs_user_idx on public.generation_jobs (user_id, created_at desc);
create index generation_jobs_post_idx on public.generation_jobs (post_id);
alter table public.generation_jobs enable row level security;
revoke all on public.generation_jobs from anon, authenticated, service_role;

create policy "generation_jobs: read own or as admin" on public.generation_jobs
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "generation_jobs: mark own as seen" on public.generation_jobs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select on public.generation_jobs to authenticated;
-- Column grant: the owner's update can touch seen_at and nothing else.
grant update (seen_at) on public.generation_jobs to authenticated;
grant select, insert, update, delete on public.generation_jobs to service_role;

create trigger generation_jobs_updated_at before update on public.generation_jobs
  for each row execute function private.touch_updated_at();
