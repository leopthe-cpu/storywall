# StoryWall — project context for AI assistants

Read this first. It's the short version of months of history so a new session doesn't re-learn (or re-break) things the hard way.

## What StoryWall is

A "social career platform": people tell career/project stories as swipeable card carousels (Instagram-carousel style) instead of bullet-point CVs. Each user has a public wall at `storywall.io/<username>` they can share in job applications, bios, networking. Owner: Oz (Leonardo Thé), product manager, building it solo with AI assistance.

Core pieces:

- **Builder** (`src/pages/StoryCreator.jsx`) — card editor. Each card is a square canvas with text, image, video and audio elements you drag, resize, crop and style. Stories autosave as drafts.
- **AI Carousel Builder** ("Generate" mode, premium) — turns a user's notes + images into a full carousel (`src/lib/generatePipeline.js`, `src/lib/aiStyleTemplates.js`). Rule: never rewrite the user's words, only restructure into cards and add a hook/title. Body text never goes below 12px — overflow splits into another card instead.
- **Templates** (`src/lib/storyTemplates.js`) and **Drafts** (Cards panel).
- **Publish flow** (`src/components/creator/PostFlowSheet.jsx`) with AI skill tags (`base44/functions/suggestSkills` — keyword fast-path first, AI fallback) plus manual tag entry if matching fails.
- **Public profile** (`src/pages/PublicProfile.jsx`) — feed of stories, lazily mounted as you scroll (`src/components/profile/LazyMount.jsx`).

## Stack / hosting

- React + Vite + Tailwind. **Live on the new stack since Oct 2026:** the app is hosted on Railway (production `storywall.io`, staging `web-staging-c748.up.railway.app`); Supabase provides auth, the Postgres database, file storage (`drafts` private, `public-media` public) and Edge Functions (`supabase/functions/*`); Resend sends email from `send.storywall.io`.
- Two Supabase projects: staging and production. Database changes are migrations in `supabase/migrations/`, applied by the Supabase GitHub integration (`develop` → staging, `main` → production), with pgTAP tests in `supabase/tests/database/`. Edge Functions are deployed by hand (not by the integration).
- Data model: tables in `supabase/migrations/20261009190000_initial_schema.sql` and later migrations. A story is a `posts` row whose `cards` jsonb holds `cards[]` → each card has `elements[]`; private notes live in `post_notes`.
- Base44 (app id `6a161402f22a3ebcce243595`, app name "SW") is the frozen fallback until it is shut down (planned around 24 Oct 2026, depending on tests). `base44/` keeps its code for reference. See `docs/migration-plan.md` and `docs/decisions.md`.

### GitHub is the only source of truth (since 8 Oct 2026)

- This GitHub repo (`leopthe-cpu/storywall`, **public**) is the only source of truth. The last Base44 version (commit `e359934`, published 8 Oct 2026 19:49 UTC) was pulled in and checked file by file (sha1).
- **Never edit the app in the Base44 builder or through the Base44 connector.** The live Base44 app is frozen as the fallback and the reference for "works the same" until the new stack is live. Reading it (code, entities, data) is fine.
- Changes go through branches and pull requests here, never straight to `main` or `develop`.
- Never commit `.env*` or `base44/.app.jsonc` (gitignored). Secrets such as `ZAI_API_KEY` live in Base44's environment, not in code.
- This repo is public: keep sensitive docs (security reviews, operating guides, internal notes) out of it, even briefly.

### Supabase access (agent sessions)

- Two scoped access tokens are in the environment. Each one only works on its own project; never print them.
  - `SUPABASE_TOKEN_STAGING` → `storywall-staging` (ref `vlgwcpqndmfhsfcxijpr`): database read-write, Edge Functions read-write.
  - `SUPABASE_TOKEN_PROD` → `storywall` production (ref `igakvqlzvglvuqflngey`): database read-only, Edge Functions read-write.
- Neither token can list projects (`GET /v1/projects` returns 403); use the per-project Management API endpoints (`/v1/projects/<ref>/...`).
- Edge Functions are deployed with the Supabase CLI, setting `SUPABASE_ACCESS_TOKEN` from the right variable on each command, e.g. `SUPABASE_ACCESS_TOKEN="$SUPABASE_TOKEN_STAGING" supabase functions deploy <name> --project-ref vlgwcpqndmfhsfcxijpr`. Never export it for the whole shell, so a later command can't hit the wrong project.
- Deploy to staging first. **Nothing goes to production without Oz's explicit OK.** Database changes still go through migrations and the GitHub integration, not these tokens.

## Access tiers (decision 50)

- Three separate tiers: Free, **Lifetime** supporter (one-time) and **Premium** (subscription). Premium does not include Lifetime, nor the reverse. Admins (rows in `admins`) have every tier.
- Until payments exist, tiers are granted by admins only: Premium via `premium_grants`, Lifetime via `lifetime_grants` (one row per user, `user_id`).
- Enforced server-side in `supabase/functions/_shared/premium.ts`: `hasPremium` (used by `structureStory`, `startGeneration`, `generateJobImage` and `generateImage`) and `hasLifetime`. Any new tier-gated backend function must call the right one; database rules use `private.has_premium` / `private.has_lifetime`.
- The client reads its access through the `my_access` database function (`myAccess()` in `src/api/storywallApi.js`: `is_admin`, `is_premium`, `is_lifetime`) only to show/hide UI. Never gate features on client state alone, and never add access flags to the profile.

## Story views (decisions 34, 50, 51)

- The wall reports a story when it has been at least half on screen for a second, then each card as it's shown (`src/lib/viewTracking.js`, `StoryCard`); once per page load. The `recordView` Edge Function skips the owner and unpublished stories and calls `record_story_view`.
- All and unique views per day in `story_view_days` (`card_index` -1 = the story). Unique = a hash of address + browser with a daily secret; the secret and the day's hashes are deleted after the day, so nothing personal is kept.
- Off unless the function secret `VIEW_TRACKING_ENABLED` is `true` (set per project; production only with Oz's OK, after the privacy notice is checked).
- Lifetime owners see each story's unique views on their wall (`my_story_view_totals`).

## Card image export (admin-only, planned premium)

- "Download all cards as images" button under the publish-flow preview (`PostFlowSheet.jsx`), and "Download images" in a published story's ⋯ menu on the profile (`StoryKebab` → sheet in `PublicProfile.jsx`, auto-starts). Both shown only when `user.role === 'admin'`.
- `src/components/creator/DownloadCardsButton.jsx` re-renders each card through `CardThumb` at the story's export size (1080×1080 for 1:1, 1080×1350 for 4:5) in a hidden layer and rasterises it with `html-to-image`; `src/lib/cardExport.js` saves a single PNG, a zip (desktop) or the share sheet (phones). Both libraries load lazily on click.
- It refuses (with a message) rather than exporting broken cards when an image hasn't loaded or its host blocks CORS. Not captured: the "Blur" photo overlay (backdrop-filter); videos export their current frame.
- When it becomes a premium feature, gate it with premium access like Generate — it's client-only, so there's no server check to add.

## Wall colours (premium wall theme, decision 49)

- The public wall's colours are CSS variables (`--wall-*` in `src/index.css`, used as `wall-*` Tailwind colours, e.g. `text-wall-text-2`, `bg-wall-btn`). Their defaults are the plain theme; a premium theme replaces them for one wall. Use them for anything new on the wall page instead of fixed colours. Not themed: the hero card's text over the photo, story cards, red for errors, owner-only dialogs and sheets.

## Old gotcha (Base44 only): the schema stripped undeclared fields

On Base44, any card/element field not declared in `base44/entities/Post.jsonc` was silently dropped on save (text sizes resetting, Text FX disappearing). On Supabase, `posts.cards` is jsonb and keeps every field as saved (checked Oct 2026: `line_height`, `font_size_estimated`, `naturalWidth` round-trip). Only top-level story fields are filtered (`POST_IGNORED` in `src/api/storywallApi.js`), so a new top-level column needs a migration.

## Rendering model (read before touching the canvas)

- All element coordinates/sizes are in reference px on a card 320 wide (`REFERENCE_CARD_SIZE` in `src/lib/cardGeometry.js`). `x`/`y` are % of the card; everything is multiplied by `scale = cardSize / 320` when drawn.
- **Card sizes (decisions 45 and 48):** each CARD has a size, stored on the card as `card_size` (`'1:1'`, `'4:5'`, `'9:16'`, `'16:9'`; `CARD_SIZES` / `getCardSize()` / `cardSizeOf()` in `src/lib/cardGeometry.js`), so a story can mix sizes. Width is always 320 reference px (4:5 is 400 high, 9:16 569, 16:9 180). `x` is a % of the width, `y` a % of the height, so 1:1 cards are unchanged. Cards saved before carry no size and take their story's `posts.card_size` (default `'1:1'`), provided by `CardFormatProvider` (`src/components/creator/CardFormatContext.jsx`: StoryCard per story on a wall, DraftEntry per draft, TemplateRow); renderers size a card with `useCardSize(card)`. Any y/height math must use the card's height, never `REFERENCE_CARD_SIZE`. The builder stamps sizes on open (`withCardSizes`), adds a card or changes a card's format through the format chooser (`formatPicker` in StoryCreator: everything but the Cards gallery is dimmed and the gallery shows the four formats, `FormatChooser`; switching uses `resizeCard()` in `src/lib/cardResize.js`), and fits every card inside the old square slot (`fitCard`); walls fit every card inside the cover card's shape (`CardCarousel`). Cards-gallery thumbnails are equal squares with the card fitted inside; other thumbnails fit cards in a 4:5 box. The layout engine takes a size (`buildAICards(cards, style, { cardSize })`, 1:1 and 4:5 only: `LAYOUT_CARD_SIZES`) and stamps it on each card; Generate picks it on the notes screen.
- The same card is rendered in several places. They MUST stay in sync — the #1 recurring bug class has been "editor looks different from published":
  - `src/components/creator/DraggableElement.jsx` — interactive editor canvas
  - `src/components/creator/CardThumb.jsx` — gallery thumbnails, publish preview AND the live published card (one outer `transform: scale()`)
  - `src/components/creator/panels/TextPanel.jsx` — text thumbnails (the separate effects preview was removed Oct 2026; effects show live on the card)

  Shared helpers exist precisely for this (`src/lib/textEffects.js`, `src/components/creator/WarpedText.jsx`). Put logic in a shared helper, never copy it per file.
- **Images:** `displayWidth/displayHeight` = full image box; `clipTop/Bottom/Left/Right` = crop insets (ref px) → visible box. `zoom` = extra scale. `focalX/focalY` = object-position (legacy pan; no UI gesture anymore).
- **Text position/width:** stored `x`/`displayWidth` are unclamped; the visible box is clamped into the safe zone by `getTextBoxLayout()` (`src/lib/textLayout.js`). Every renderer must use it — CardThumb once used raw values and text jumped on publish (fixed Oct 2026).
- **Text:** `font_size_locked` (true once a human created/edited the box — never auto-resize), `font_size_estimated` (one-time AI auto-size already ran). `CanvasArea.jsx` has a "coordinated shrink" that only runs while every text box on a card is still unlocked (fresh AI output).

## Recent changes (Sept 2026)

**Image editing** (`DraggableElement.jsx`, `panels/MediaPanel.jsx`):

- Corner resize now keeps the OPPOSITE corner fixed (Figma/Canva); it used to anchor top-left for every corner. Aspect lock keeps the box's current shape.
- Pictures can be dragged partly off the card on any side (10% must stay on).
- Resize/crop handles are clamped to stay just inside the card, so a picture bigger than the card is always resizable.
- "Fit to card" sizes the picture to COVER the card at the photo's own proportions, centred (was a forced 320×320 square).
- Loading: `ImageSkeleton` shimmer + a delayed (3s) `PixelSpinner`; loaded state is derived from the RESOLVED media URL (private files resolve to signed URLs asynchronously via `DraftMediaContext`).
- Uploads: client-side downscale to 1600px (`src/lib/imageOptimize.js`), optimistic local preview placed on the card immediately, 45s timeout.

**Text:**

- Text FX (doc 108) Phase 1: Shadow, Outline, Glow, Echo, Spacing — compound, each field is its own on/off + strength. Phase 2: warps Arc, Wave, Stairs, Bulge (`WarpedText.jsx`, per-letter transforms, display-only — plain text while typing). Effects tab UI: pills (green = in use, stronger ring = open slider; builder pills use 4px corners), one slider visible at a time, compact slider with a reset tick (`MinimalSlider` `compact`/`resetValue` props — intended to become the default for all sliders).
- Typed text is committed on blur; it's now also committed on deselect, unmount, card switch and before any "leaving" save (`flushActiveTextEdit` in `StoryCreator.jsx`). `updateElement` matches by element id across ALL cards (it used to only touch the current card).

**Drafts / saving** (`StoryCreator.jsx`):

- Autosave: 4s debounce, 30s ceiling, plus on tab-hide/unload/back.
- `persistDraft` snapshots state synchronously before any await; opening a draft saves the old story in the background (with a `storyEpochRef` guard) and shows `DraftLoadingOverlay` (defined inside `StoryCreator.jsx`). Blob (unfinished upload) URLs are never persisted.
- Applying a template starts a NEW story (Oct 2026 fix): it saves the current one, then detaches from its draft/post id (`draftId`, `editingPostId`, title, tags, epoch bump). It used to keep the old draft id, so the next autosave overwrote the user's draft with the template. If the save fails or is skipped, the template is not applied and a toast says so. Anything that replaces a whole story must do the same.

**Other:** app-wide `PixelSpinner` (8-bit style), center-snap smart guides while dragging, "already signed in" choice screen on sign-up, real logo PNGs in `public/`, skills keyword fast-path.

## Open items / backlog

- Paste/reconcile the original doc 108 (Text FX) spec.
- Doc 111: manual card split when text overflows at the minimum size.
- Loading-screen cleanup: drop quick loads to blank (with timeout + Retry), small inline loaders for actions, possible product tour during onboarding.
- Image perf: verify stored sizes, thumbnail variants, lighter Drafts list.
- Decide on unused schema fields `panX/panY/zoomLevel/isPannable`.
- Decide: keep or remove the multi-textbox "coordinated shrink".
- Needs real-device testing: all of the above image/text changes on mobile.

## Library documentation (Context7)

- Before relying on a detail of a library, framework, SDK, CLI or cloud service (API syntax,
  options, configuration, versions, migrations), look it up with the Context7 connector
  (`resolve-library-id`, then `query-docs`) instead of answering from memory. Say which source
  confirmed it.
- If Context7 has nothing, or only part of the answer (for example another SDK's version of the
  method), say so and check the official docs directly. Never fill the gap with a guess.
- Queries go to a third-party service: send library names and the question only, never keys,
  tokens, personal data or this project's code.
- It needs the Context7 connector on for the session and `context7.com` allowed in the cloud
  environment's network settings. If the tools are missing, say so instead of skipping the check.

## Working conventions (Oz's preferences)

- One distinct fix/feature per commit/deploy, so each can be reverted alone.
- Before shipping: `npm run lint` and `npm run build` must both pass.
- Verify behaviour, don't assume it — several "fixes" here only worked after testing the real component (e.g. in a headless browser with scripted drags).
- Leave a comment explaining WHY on non-obvious logic; most recent code does.
- Be explicit about what's untested.

## Keep the progress file current

Oz follows progress on the Popmart projects dashboard, which reads `docs/PROGRESS.md` (format: `docs/PROGRESS_FORMAT.md` in the `leopthe-cpu/popmart.studio` repo, formerly Creative.can). At the end of every work session:
1. Update the front matter (`updated`, `summary`).
2. Move items between Doing, To do and Done, and add new items. Product and Marketing items can be `@me` (Oz) or `@claude`.
3. Put anything that needs Oz's accounts, keys, decisions or content under To do with `@me`.
4. Only mark an item Done with evidence (merged PR, passing tests, live page).
