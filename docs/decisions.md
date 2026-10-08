# Decisions log

Decisions made during the Base44 → Railway + Supabase + Resend migration.
Newest last. "Oz" = owner; "agent" = decision made by the AI assistant on Oz's behalf.

| # | Date | Decision | By | Why |
|---|------|----------|----|-----|
| 1 | 2026-10-08 | GitHub is the only source of truth from Base44 commit `e359934` onwards; no more edits in the Base44 builder. | Oz | Two editable copies drift apart. All 220 files were verified identical to Base44 by sha1 before the freeze. |
| 2 | 2026-10-08 | Supabase: use a second, separate Supabase login (fresh, empty, Free plan) for the `storywall` and `storywall-staging` projects. In the plan's terms this is option B (no existing StoryWall project was found). | Oz | Free. Mend's login already uses its 2 free projects. Consequence: the Free plan's 50 MB per-file upload limit applies (to be checked against Base44's current limits in Phase 0, step 4d). |
| 3 | 2026-10-08 | Give the agent access to the new Supabase account by inviting Oz's main Supabase login into the new organization with the **Developer** role (not Owner/Administrator). | agent (pending Oz's OK) | Supabase counts free projects across every organization where a user is Owner or Administrator, so a higher role would block the free projects. Developer can read and work with project content but cannot change project settings; Oz changes settings (auth URLs, SMTP, secrets) in the dashboard. Source: supabase.com/docs/guides/platform/billing-faq and /access-control. |
| 4 | 2026-10-08 | Agent cloud sessions push to their session branch (`claude/…`) instead of `feature/…`; it plays the same role (a feature branch that goes into `develop` via a pull request). | agent (pending Oz's OK) | The cloud session can only push to the branch assigned to it. |
| 5 | 2026-10-08 | Supabase org `storywall` (Free plan, second login). Projects `storywall-staging` and `storywall`, created with: Data API on, "Automatically expose new tables" **off**, "Enable automatic RLS" **on**. Region: suggested Canada (Central), same as Mend (Oz to confirm). | Oz + agent | Supabase recommends turning automatic grants off; every table's access is granted explicitly in `supabase/migrations/` together with its RLS policies (supabase.com/docs/guides/api/securing-your-api). Automatic RLS is an extra safety net. |
