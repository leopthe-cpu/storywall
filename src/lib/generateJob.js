import { invokeFunction } from '@/api/storywallApi';
import { getSupabase } from '@/api/supabaseClient';
import { buildAICards } from '@/lib/aiStyleTemplates';
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
export async function startJob({ text, attachments, postId }) {
  try {
    const { data } = await invokeFunction('startGeneration', {
      text,
      attachments: (attachments || []).map((a) => ({ url: a.url, type: a.type })),
      ...(postId ? { postId } : {}),
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

// Follows a job until it is done (or failed), reporting progress.
export async function waitForJob(jobId, onProgress) {
  const started = Date.now();
  for (;;) {
    const job = await readJob(jobId);
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
export async function assembleJob(job) {
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
  const { cards: assembledCards, tokens } = await buildAICards(cards, structured.styleTemplate);
  return {
    cards: assembledCards,
    tokens,
    framework: structured.framework,
    styleTemplate: structured.styleTemplate,
  };
}

// The whole run: start (or join) the job, follow it, lay it out.
// Returns null when the job version isn't available, so the caller can use
// the old pipeline instead.
export async function runGenerateJob({ text, attachments, postId, onProgress }) {
  let started;
  try {
    started = await startJob({ text, attachments, postId });
  } catch (e) {
    if (shouldFallBack(e)) {
      console.warn('[generate-job] job could not be started, using the browser pipeline:', e?.status, e?.message);
      return null;
    }
    throw e;
  }
  onProgress?.({ completedSteps: 0, totalSteps: 1, label: 'Writing your cards…' });
  const job = await waitForJob(started.jobId, onProgress);
  const result = await assembleJob(job);
  // Seen: the finished story is on screen, so no "ready" e-mail is needed.
  // Best effort; a failure here must not lose the story.
  getSupabase().from('generation_jobs').update({ seen_at: new Date().toISOString() }).eq('id', job.id)
    .then(({ error }) => { if (error) console.warn('[generate-job] could not mark the job seen:', error.message); });
  return { ...result, jobId: job.id, postId: job.post_id };
}
