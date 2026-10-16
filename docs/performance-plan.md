# Performance plan (Generate first, then the app)

Status: approved by Oz, 2026-10-16. Nothing here is built yet.

## Where the time goes today

Measured on staging and production, 2026-10-15/16:

- Writing the cards (structureStory, Sonnet): 19–45 s.
- Each AI picture (generateImage, Qwen-Image): 50–72 s. Up to 3 per story, made at the same time.
- Total: about 1.5–2 minutes before anything shows. Everything runs from the browser, so closing the tab loses the result (the AI cost is still spent).
- The rest of the app: Oz finds it fast enough. The main JavaScript bundle is about 1.1 MB on disk (one file for every page), which is the first thing to check on slow phones.

## Constraint that shapes the design

Supabase server functions on the free plan stop after 150 s (400 s on paid plans), per Supabase's limits page (checked 2026-10-16). The slowest real run (45 s structuring + 72 s picture) is close to that. So Generate can't be one long server job; it has to be a few short steps.

## A. Generate becomes a server job (keeps running without the tab)

1. **Start.** The browser calls a new `startGeneration` function. It:
   - checks premium and the daily AI limit;
   - creates the draft and a `generation_jobs` row (owner-only access);
   - answers straight away with the job id;
   - keeps working in the background (`EdgeRuntime.waitUntil`).
2. **Write the cards.** In the background, the same function structures the story and saves the result into the job (status "cards ready").
3. **Pictures.** For each picture the story needs (at most 3), it starts a separate function call (`generateJobImage`) on the server. Each runs with its own 150 s budget, saves its picture and records it in the job. The browser isn't involved, so closing the tab doesn't stop anything.
4. **Showing it.** The browser watches the job row, using Supabase Realtime or a light poll:
   - cards appear as soon as they are written (about 20–45 s);
   - pictures fill in one by one;
   - the loading screen's percentage follows real steps.
5. **Layout stays in the browser.** The job stores text and pictures, not positions. The layout engine runs when the result is shown or the draft opens, so new card shapes and colour themes need no server change.
6. **Drafts.**
   - A running job shows as the non-clickable "Formatting your story…" placeholder.
   - A finished job opens as a normal draft.
   - A job that fails shows a clear message and keeps the notes.
7. **Safety.**
   - Each step has a time limit.
   - A picture that fails is marked "failed", with the existing retry button.
   - A job stuck for more than 10 minutes is marked failed.
   - The AI limits apply per job.

## B. Faster AI steps (after A, each with a small paid test)

- **Pictures:**
  - try a faster image model and/or a smaller picture size;
  - compare speed, cost and look on 3 stories;
  - about $1–2 of test runs; ask Oz before running.
- **Writing the cards:** test a faster model against Sonnet for word-for-word accuracy. Sonnet was chosen because cheaper models dropped sentences (decision 22). Only switch if the word-for-word check passes just as well.

## C. The rest of the app (measure first)

- Split the JavaScript bundle by page, so the landing page and walls don't download the builder.
- Picture sizes:
  - check what is stored;
  - make smaller copies for the Drafts list and walls;
  - Supabase's image resizing may need a paid plan, so check that; otherwise resize at upload.
- Measure page load on a real phone before and after.

## D. Built with the future in mind

- The job takes a card shape (square today; tall and wide later), so picture generation can ask for the right shape.
- The media steps don't assume pictures only (video and audio later).

## Order and checkpoints

1. A, in small PRs:
   - jobs table and access rules;
   - `startGeneration` (cards only);
   - picture steps;
   - browser watches the job;
   - Drafts placeholder;
   - "ready" toast and email.

   Each is tested on staging. One paid Generate run (about $0.20) at the end.
2. The new loading screen (docs/generate-roadmap.md, section A) on top of the job's real progress.
3. B, with Oz's OK for the test spend.
4. C.

## Decided (Oz, 2026-10-16)

- **Fallback:** the old browser-run Generate stays as a backup for a while after the job version works on production. Remove it later, as its own change.
- **"Ready" toast:** when a job finishes while the user is elsewhere in the app, a quick toast says "Your story is ready in Drafts". It closes by itself after a few seconds, or earlier if the user taps its X.
- **"Ready" email:** if the story is ready and the user hasn't looked at it within 2 minutes because they're no longer in the app (tab closed or signed out), send one email through Resend: "Your story is ready for your review", with a link to Drafts.
  - "Looked at it" = the app showed the finished story or the toast; the browser marks this on the job.
  - At most one email per job. No email if the user saw it in time.
  - Open for the build: how the 2-minute check runs (a scheduled database job each minute is the likely option, since a server function can't simply wait 2 minutes inside its 150 s limit). Check the email wording and the marketing-email rules (docs/legal-and-privacy-plan.md); this is a service email about the user's own request, which is generally allowed without marketing consent, but verify.
