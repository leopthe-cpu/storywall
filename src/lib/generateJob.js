import { invokeFunction, updatePost } from '@/api/storywallApi';
import { getSupabase } from '@/api/supabaseClient';
import { buildAICards, getStyleTemplate, pickStyleVariant } from '@/lib/aiStyleTemplates';
import { themeColors, withTheme } from '@/lib/colorPalettes';
import { markMissingPictures, placeAttachments } from '@/lib/generatePipeline';

// Generate as a server job, step 4 (docs/performance-plan.md, part A): the
// browser starts the job (startGeneration), then follows its row in
// generation_jobs until it is done. The writing and the pictures happen on
// the server, so leaving the page no longer loses the story. The layout
// stays here: the job holds text, picture prompts and picture URLs only.
//
// The old browser pipeline (runGeneratePipeline) stays as the backup
// (Oz, 2026-10-16): when the job can't be started at all, the caller falls
// back to it. See startJobOrFallback below.

const POLL_MS = 2500;
// Writing takes up to ~45 s and pictures ~50–90 s each, made at the same
// time; the server gives up on a stuck job after 10 minutes.
const GIVE_UP_MS = 10 * 60 * 1000;

// Errors that mean "the job version isn't available here" (the function isn't
// deployed yet, or the network failed before any answer) rather than "you
// can't generate": only these fall back to the old pipeline.
export function shouldFallBack(error) {
  const status = error?.status;
  return !status || status === 404 || status >= 500;
}

// Starts a job. A job already running for this user (409) is followed
// instead of starting a second one.
// `theme`: the colour theme picked on the notes screen (ThemePicker), kept
// with the job so a story laid out later (from Drafts) gets it too.
export async function startJob({ text, attachments, postId, theme }) {
  const colors = themeColors(theme);
  try {
    const { data } = await invokeFunction('startGeneration', {
      text,
      attachments: (attachments || []).map((a) => ({ url: a.url, type: a.type })),
      ...(postId ? { postId } : {}),
      ...(colors ? { theme: colors } : {}),
    });
    return { jobId: data.jobId, postId: data.postId };
  } catch (e) {
    const running = e?.response?.data?.jobId;
    if (e?.status === 409 && running) return { jobId: running, postId: null };
    throw e;
  }
}

async function readJob(jobId) {
  const { data, error } = await getSupabase().from('generation_jobs')
    .select('id, post_id, status, error, options, result, pictures')
    .eq('id', jobId).single();
  if (error) throw error;
  return data;
}

// Progress for the loading screen, from the job's real steps.
function progressOf(job) {
  const pictures = job.pictures || [];
  const finished = pictures.filter((p) => !['pending', 'running'].includes(p.status)).length;
  const totalSteps = 1 + pictures.length;
  if (job.status === 'queued' || job.status === 'writing') {
    return { completedSteps: 0, totalSteps: 1, label: 'Writing your cards…' };
  }
  if (job.status === 'pictures') {
    return {
      completedSteps: 1 + finished,
      totalSteps,
      label: `Making pictures… ${finished} of ${pictures.length} done`,
    };
  }
  return { completedSteps: totalSteps, totalSteps, label: 'Assembling carousel…' };
}

// Jobs a generating screen is following right now. The app-wide watcher
// (GenerationWatcher) doesn't show its "ready" toast for these: the screen
// shows the story itself.
export const followedJobs = new Set();

// Tells the app-wide watcher a job started, so it starts checking.
export const JOB_STARTED_EVENT = 'storywall:generation-started';

// Asks an open builder to open a draft (the "ready" toast's Open button).
export const OPEN_DRAFT_EVENT = 'storywall:open-draft';

// Thrown when the caller stopped following (the user left the screen).
export class StoppedFollowing extends Error {}

// Follows a job until it is done (or failed), reporting progress. `isActive`
// returning false stops following (the job itself keeps going on the
// server; the watcher and Drafts take over).
export async function waitForJob(jobId, onProgress, isActive = () => true) {
  const started = Date.now();
  for (;;) {
    if (!isActive()) throw new StoppedFollowing();
    const job = await readJob(jobId);
    if (!isActive()) throw new StoppedFollowing();
    onProgress?.(progressOf(job));
    if (job.status === 'done') return job;
    if (job.status === 'failed') {
      const err = new Error(job.error || 'Generation failed');
      err.status = 500;
      throw err;
    }
    if (Date.now() - started > GIVE_UP_MS) {
      const err = new Error('Generation took too long');
      err.status = 504;
      throw err;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

// Turns a finished job into the editor's cards, the same way the old
// pipeline did: attached pictures on their cards, AI pictures where made,
// the retry badge where one failed, then the style template's layout.
// The colours are the theme saved with the job, or `theme` (the one on
// screen) for a job started before the server kept themes. `cardSize` is
// the story's card size (posts.card_size), so the layout fits its cards.
export async function assembleJob(job, theme = null, cardSize) {
  const structured = job.result;
  if (!structured || !Array.isArray(structured.cards)) throw new Error('Job has no cards');
  const cards = structured.cards.map((c) => ({ ...c }));
  // The attachments as the server kept them (it drops invalid ones), so the
  // AI's attachmentIndex points at the right picture.
  placeAttachments(cards, job.options?.attachments || []);
  for (const p of job.pictures || []) {
    const card = cards[p.index];
    if (!card) continue;
    if (p.status === 'done' && p.url) {
      card.imageUrl = p.url;
      card.aiGenerated = true;
    } else if (p.status === 'skipped') {
      // The prompt still described people: a text card, not an error.
      card.needsImage = false;
    } else {
      card.imageGenerationFailed = true;
    }
  }
  markMissingPictures(cards);
  const styleTemplate = pickStyleVariant(structured.styleTemplate, job.id);
  const style = withTheme(getStyleTemplate(styleTemplate), job.options?.theme || theme);
  const { cards: assembledCards, tokens } = await buildAICards(cards, style, { cardSize });
  return {
    cards: assembledCards,
    tokens,
    framework: structured.framework,
    styleTemplate,
  };
}

// The whole run: start (or join) the job, follow it, lay it out.
// Returns null when the job version isn't available, so the caller can use
// the old pipeline instead.
export async function runGenerateJob({ text, attachments, postId, theme, cardSize, onProgress, isActive = () => true }) {
  let started;
  try {
    started = await startJob({ text, attachments, postId, theme });
  } catch (e) {
    if (shouldFallBack(e)) {
      console.warn('[generate-job] job could not be started, using the browser pipeline:', e?.status, e?.message);
      return null;
    }
    throw e;
  }
  // A draft the server just created has the database's default card size
  // (1:1). Give it the story's size straight away, so a story finished
  // later from Drafts (attachJobsToDrafts) is laid out at the size picked
  // here. Best effort: on failure the story is still made, at 1:1.
  if (started.postId && cardSize) {
    updatePost(started.postId, { card_size: cardSize })
      .catch((e) => console.warn('[generate-job] could not set the card size:', e?.message));
  }
  onProgress?.({ completedSteps: 0, totalSteps: 1, label: 'Writing your cards…' });
  window.dispatchEvent(new Event(JOB_STARTED_EVENT));
  followedJobs.add(started.jobId);
  let job;
  try {
    job = await waitForJob(started.jobId, onProgress, isActive);
  } finally {
    followedJobs.delete(started.jobId);
  }
  const result = await assembleJob(job, theme, cardSize);
  // Seen: the finished story is on screen, so no "ready" e-mail is needed.
  // Best effort; a failure here must not lose the story.
  getSupabase().from('generation_jobs').update({ seen_at: new Date().toISOString() }).eq('id', job.id)
    .then(({ error }) => { if (error) console.warn('[generate-job] could not mark the job seen:', error.message); });
  return { ...result, jobId: job.id, postId: job.post_id };
}

// ---------- Drafts (part A, step 5)
//
// A Generate run writes into a draft that stays empty (no cards) until its
// result is laid out. Normally that happens on the generating screen; when
// the user left before the end, it happens here, the next time the Drafts
// list loads: a finished job is laid out and saved into its draft, so it
// opens like any other draft. A job still running shows as a placeholder
// ("Formatting your story…"), and one that failed says so.

const STALE_AFTER_MS = 10 * 60 * 1000; // same as the server (startGeneration)

function jobState(job) {
  if (!job) return null;
  if (job.status === 'done') return 'done';
  if (job.status === 'failed') return 'failed';
  return Date.now() - new Date(job.created_at).getTime() > STALE_AFTER_MS ? 'failed' : 'running';
}

// Returns the drafts with `generation` = 'running' | 'failed' on the empty
// ones that belong to a Generate run, and finished runs laid out and saved.
export async function attachJobsToDrafts(drafts) {
  const empty = (drafts || []).filter((d) => !(d.cards || []).length);
  if (!empty.length) return drafts;
  const { data: jobs, error } = await getSupabase().from('generation_jobs')
    .select('id, post_id, status, created_at, options, result, pictures')
    .in('post_id', empty.map((d) => d.id))
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[generate-job] could not read jobs for drafts:', error.message);
    return drafts;
  }
  const latest = new Map();
  for (const job of jobs || []) if (!latest.has(job.post_id)) latest.set(job.post_id, job);

  return Promise.all(drafts.map(async (draft) => {
    const job = latest.get(draft.id);
    const state = (draft.cards || []).length ? null : jobState(job);
    if (!state) return draft;
    if (state !== 'done') return { ...draft, generation: state };
    try {
      const result = await assembleJob(job, null, draft.card_size);
      const saved = await updatePost(draft.id, {
        cards: result.cards,
        color_tokens: result.tokens || [],
        generation_style: result.styleTemplate,
        ai_generated: true,
      });
      getSupabase().from('generation_jobs').update({ seen_at: new Date().toISOString() }).eq('id', job.id)
        .then(({ error: seenError }) => { if (seenError) console.warn('[generate-job] could not mark the job seen:', seenError.message); });
      return saved || { ...draft, cards: result.cards, color_tokens: result.tokens || [] };
    } catch (e) {
      console.warn('[generate-job] could not lay out a finished job:', e?.message);
      return { ...draft, generation: 'failed' };
    }
  }));
}
