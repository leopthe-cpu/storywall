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

- React + Vite + Tailwind, hosted on Base44 (app id `6a161402f22a3ebcce243595`, app name "SW"). Base44 also provides auth, the database (entities), file storage and serverless functions (`base44/functions/*`).
- Data model lives in `base44/entities/*.jsonc` — the important one is `Post.jsonc` (a story: `cards[]` → each card has `elements[]`).
- A Supabase project exists but holds no app data; StoryWall's data is all in Base44.
- Source can ALSO be edited by Oz through Base44's own AI builder chat and through Claude (Cowork / Claude Code) via the Base44 connector, sometimes at the same time — so files can change between sessions or even mid-session. Always re-read a file right before editing it.

### Two copies of the code: GitHub and Base44

- This GitHub repo (`leopthe-cpu/storywall`, **public**) is a copy of the Base44 app's source, imported Sept 2026. The two do **not** sync automatically.
- The live app runs from Base44. A change pushed here does nothing to the live app until it is also applied in Base44 (and vice versa for edits made in the Base44 builder).
- Before starting work, compare this repo against the Base44 sandbox and pull in any builder-side changes; after a change, apply it to both and create a Base44 checkpoint.
- Never commit `.env*` or `base44/.app.jsonc` (gitignored). Secrets such as `ZAI_API_KEY` live in Base44's environment, not in code.

## Premium access

- Premium is granted by admins only, via the `PremiumGrant` entity (one row per user, `user_id`). Admins (`role === 'admin'`) are always premium.
- The check is enforced server-side in `base44/shared/premium.ts` (`hasPremium`), used by `structureStory` and `generateImage`. Any new premium backend function must call it.
- The client reads `PremiumGrant` only to show/hide the Generate UI (`PublicProfile.jsx`). Never gate premium features on client state alone, and never add access flags to the `User` entity.
- The old `is_premium` field on `User` is being retired (Sept 2026) — don't use it in new code.

## Card image export (admin-only, planned premium)

- "Download all cards as images" button under the publish-flow preview (`PostFlowSheet.jsx`), shown only when `user.role === 'admin'`.
- `src/components/creator/DownloadCardsButton.jsx` re-renders each card through `CardThumb` at 1080×1080 in a hidden layer and rasterises it with `html-to-image`; `src/lib/cardExport.js` saves a single PNG, a zip (desktop) or the share sheet (phones). Both libraries load lazily on click.
- It refuses (with a message) rather than exporting broken cards when an image hasn't loaded or its host blocks CORS. Not captured: the "Blur" photo overlay (backdrop-filter); videos export their current frame.
- When it becomes a premium feature, gate it with `PremiumGrant` like Generate — it's client-only, so there's no server check to add.

## ⚠️ Critical gotcha: the schema STRIPS undeclared fields

Base44 silently drops any card/element field that is NOT declared in `base44/entities/Post.jsonc` when a story is saved — even though the schema says `additionalProperties: true`. This caused real bugs (text font sizes resetting after reload, Text FX disappearing, image settings lost).

**Rule:** whenever you add a new field to a card or element, add it to `Post.jsonc` in the same change (via Base44's schema update, which also rewrites the jsonc). Verify with a query that the field round-trips.

## Rendering model (read before touching the canvas)

- All element coordinates/sizes are in reference px on a 320×320 card (`REFERENCE_CARD_SIZE` in `src/components/creator/CanvasArea.jsx`). `x`/`y` are % of the card; everything is multiplied by `scale = cardSize / 320` when drawn.
- The same card is rendered in several places. They MUST stay in sync — the #1 recurring bug class has been "editor looks different from published":
  - `src/components/creator/DraggableElement.jsx` — interactive editor canvas
  - `src/components/creator/CardThumb.jsx` — gallery thumbnails, publish preview AND the live published card (one outer `transform: scale()`)
  - `src/components/creator/panels/TextPanel.jsx` — text thumbnails + live effects preview

  Shared helpers exist precisely for this (`src/lib/textEffects.js`, `src/components/creator/WarpedText.jsx`). Put logic in a shared helper, never copy it per file.
- **Images:** `displayWidth/displayHeight` = full image box; `clipTop/Bottom/Left/Right` = crop insets (ref px) → visible box. `zoom` = extra scale. `focalX/focalY` = object-position (legacy pan; no UI gesture anymore).
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

- Text FX (doc 108) Phase 1: Shadow, Outline, Glow, Echo, Spacing — compound, each field is its own on/off + strength. Phase 2: warps Arc, Wave, Stairs, Bulge (`WarpedText.jsx`, per-letter transforms, display-only — plain text while typing). Effects tab UI: pills (white = in use, ring = open slider), one slider visible at a time, compact slider with a reset tick (`MinimalSlider` `compact`/`resetValue` props — intended to become the default for all sliders).
- Typed text is committed on blur; it's now also committed on deselect, unmount, card switch and before any "leaving" save (`flushActiveTextEdit` in `StoryCreator.jsx`). `updateElement` matches by element id across ALL cards (it used to only touch the current card).

**Drafts / saving** (`StoryCreator.jsx`):

- Autosave: 4s debounce, 30s ceiling, plus on tab-hide/unload/back.
- `persistDraft` snapshots state synchronously before any await; opening a draft saves the old story in the background (with a `storyEpochRef` guard) and shows `DraftLoadingOverlay` (defined inside `StoryCreator.jsx`). Blob (unfinished upload) URLs are never persisted.

**Other:** app-wide `PixelSpinner` (8-bit style), center-snap smart guides while dragging, "already signed in" choice screen on sign-up, real logo PNGs in `public/`, skills keyword fast-path.

## Open items / backlog

- Paste/reconcile the original doc 108 (Text FX) spec.
- Roll compact slider style out to every slider.
- Doc 111: manual card split when text overflows at the minimum size.
- Loading-screen cleanup: drop quick loads to blank (with timeout + Retry), small inline loaders for actions, possible product tour during onboarding.
- Profile picture: delayed spinner + progressive loading.
- Image perf: verify stored sizes, thumbnail variants, lighter Drafts list.
- Decide on unused schema fields `panX/panY/zoomLevel/isPannable`.
- Decide: keep or remove the multi-textbox "coordinated shrink".
- Needs real-device testing: all of the above image/text changes on mobile.

## Working conventions (Oz's preferences)

- One distinct fix/feature per commit/deploy, so each can be reverted alone.
- Before shipping: `npm run lint` and `npm run build` must both pass.
- Verify behaviour, don't assume it — several "fixes" here only worked after testing the real component (e.g. in a headless browser with scripted drags).
- Leave a comment explaining WHY on non-obvious logic; most recent code does.
- Be explicit about what's untested.
