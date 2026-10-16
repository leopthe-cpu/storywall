import { useCallback, useEffect, useRef } from 'react';
import { getSupabase } from '@/api/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { followedJobs, JOB_STARTED_EVENT } from '@/lib/generateJob';

// "Your story is ready" toast (docs/performance-plan.md, decided by Oz
// 2026-10-16): when a Generate run finishes while the user is elsewhere in
// the app, a short toast says so. It closes by itself after a few seconds or
// with its X. Showing it marks the job seen, so no "ready" e-mail goes out.
//
// It only checks while the user has an unseen run from the last 15 minutes
// (once on load, then every 10 s while one is going), so it costs nothing
// for everyone else. Runs a generating screen is following are skipped:
// that screen shows the story itself.

const CHECK_MS = 10_000;
const RECENT_MS = 15 * 60 * 1000;
const TOAST_MS = 6000;

export default function GenerationWatcher() {
  const timerRef = useRef(null);

  // The signed-in user from the local session (no network call). Read on
  // every check rather than once, so signing in or out mid-visit is handled.
  const check = useCallback(async () => {
    clearTimeout(timerRef.current);
    const { data: { session } } = await getSupabase().auth.getSession();
    const user = session?.user;
    if (!user?.id) return;
    const { data: jobs, error } = await getSupabase().from('generation_jobs')
      .select('id, status')
      .eq('user_id', user.id)
      .is('seen_at', null)
      .in('status', ['queued', 'writing', 'pictures', 'done'])
      .gt('created_at', new Date(Date.now() - RECENT_MS).toISOString());
    if (error) return;

    for (const job of jobs || []) {
      if (job.status !== 'done' || followedJobs.has(job.id)) continue;
      const { error: seenError } = await getSupabase().from('generation_jobs')
        .update({ seen_at: new Date().toISOString() }).eq('id', job.id).is('seen_at', null);
      if (seenError) continue;
      toast({
        title: 'Your story is ready',
        description: "Find it in Drafts in the story builder.",
        duration: TOAST_MS,
      });
    }
    if ((jobs || []).some((j) => j.status !== 'done')) {
      timerRef.current = setTimeout(check, CHECK_MS);
    }
  }, []);

  useEffect(() => {
    check();
    window.addEventListener(JOB_STARTED_EVENT, check);
    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener(JOB_STARTED_EVENT, check);
    };
  }, [check]);

  return null;
}
