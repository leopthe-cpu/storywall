-- Generate as a server job, step 3: safe updates of one picture in a job
-- (docs/performance-plan.md, part A, 2026-10-16).
--
-- Why: a job's pictures live in one jsonb array, and each picture is made by
-- its own server call. Up to 3 can finish at the same moment; if each read
-- the array, changed its entry and wrote the whole array back, one could
-- overwrite another's result. This function changes one entry inside a
-- single UPDATE, so concurrent calls queue on the row lock and each sees the
-- others' changes.
--
-- public.update_job_picture(job, index, from_statuses, patch):
--   - merges `patch` into the picture whose "index" is p_index, but only if
--     its status is one of p_from (so a picture can be claimed only once:
--     pending -> running);
--   - returns false when there was no such picture (already claimed, wrong
--     job or index), true otherwise;
--   - when no picture is left pending or running, the job becomes "done".
-- Only the server functions (service role) can call it.

create function public.update_job_picture(p_job uuid, p_index integer, p_from text[], p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.generation_jobs j
  set pictures = (
    select jsonb_agg(case when (e ->> 'index')::int = p_index then e || p_patch else e end order by n)
    from jsonb_array_elements(j.pictures) with ordinality as t (e, n)
  )
  where j.id = p_job
    and j.status = 'pictures'
    and exists (
      select 1 from jsonb_array_elements(j.pictures) as e
      where (e ->> 'index')::int = p_index and (e ->> 'status') = any (p_from)
    );
  get diagnostics changed = row_count;
  if changed = 0 then
    return false;
  end if;

  update public.generation_jobs j
  set status = 'done', finished_at = now()
  where j.id = p_job
    and j.status = 'pictures'
    and not exists (
      select 1 from jsonb_array_elements(j.pictures) as e
      where (e ->> 'status') in ('pending', 'running')
    );
  return true;
end;
$$;
revoke execute on function public.update_job_picture(uuid, integer, text[], jsonb) from public, anon, authenticated;
grant execute on function public.update_job_picture(uuid, integer, text[], jsonb) to service_role;
