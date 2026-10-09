# Migration plan: Base44 → Railway + Supabase + Resend

Status: **Phase 0 nearly done (step 6: Oz's review); Phase 0.5 started.** Decisions are logged in [`decisions.md`](decisions.md).

Goal: the new app behaves exactly like the Base44 app (frozen at Base44 commit `e359934`, published 2026-10-08 19:49 UTC). No new features during the migration (see "After migration" at the end).

## How we work (Oz's rules)

**Working with Oz** (owner, product manager, not a developer):
- Plain language, one step at a time. For dashboard steps: exact clicks and direct links, then wait for "done".
- After Oz does something, **verify it yourself** with your tools before moving on.
- Ask before deviating from this plan. Record every decision made on Oz's behalf in `docs/decisions.md`.
- Be explicit about what is untested or unverified.
- **Never ask Oz to paste passwords, tokens or keys into the chat.** He sets secrets himself in the dashboards or the cloud environment settings.

**Engineering rules (strict):**
- Never invent APIs, SDK methods, CLI flags or config keys. Check the current official docs (Base44, Supabase, Railway, Resend, GitHub) first.
- Database changes only as migration files in `supabase/migrations/`, never in the dashboard. RLS on every table. Every table's grants are explicit (new projects don't auto-grant; see decision 5).
- The browser only ever holds the publishable key. Premium is enforced server-side only.
- No secrets in the repo; `.env.example` with placeholder names only.
- Small commits on feature branches (cloud sessions: their `claude/…` branch, decision 4); pull requests into `develop`; never push to `main` or `develop` directly. Agents never open or merge PRs into `main`.
- Verify behaviour in a real browser (Playwright), not by assumption.
- Before every PR: `npm run lint` and `npm run build` pass.
- No new features or redesigns during the migration. Ideas go to "After migration" at the end of this file.
- This repo is **public**: keep sensitive docs (security review, operating guide, internal notes) out of it. A closed PR stays readable, so never push private text even briefly.
- Playwright error logs and traces of sign-in tests contain the typed password: never print, open or share them.

## Accounts and services

All existing logins of Oz unless noted; no new accounts without his OK.
- **GitHub:** `leopthe-cpu` (Oz, admin). Bot `w0rkstufff` (Write role, works only through PRs; used by Oz's LibreChat agent, Phase 7).
- **Railway:** Oz's account. New project `storywall` with environments `production` (deploys `main`) and `staging` (deploys `develop`). The `mend` project (with LibreChat) stays as is. Project `dependable-reprieve`: unknown, **don't touch** (ask Oz).
- **Supabase:** separate StoryWall login, org `storywall` (Free plan). Projects in the table below. The claude.ai Supabase connector is authorized for this org only (decision 3).
- **Resend:** Oz creates a free account (Phase 1); agent guides the domain setup.
- **OpenRouter:** existing account (AI credits). **LibreChat:** existing instance (Phase 7).
- **Base44:** app id `6a161402f22a3ebcce243595` (name "SW"). Frozen; stays untouched and working until the new app is proven.
- **Domain:** storywall.io, registered and DNS-hosted at GoDaddy (see step 4h).
- **Test accounts on live Base44:** `leopteh` = admin + premium (data migrated, tests only read it); `leo` = admin since 2026-10-09, tests only, the account data-changing tests use (decision 16). Optional non-admin account for "locked" checks: `SW_NORMAL_EMAIL/PASSWORD` (not set yet). Credentials in env vars `SW_ADMIN_EMAIL/PASSWORD`, `SW_USER_EMAIL/PASSWORD` (cloud environment settings; a new session is needed after changing them).

## Lessons learned from Mend (apply from day one)

- Check plan limits before relying on a feature. GitHub rulesets only work on public repos or GitHub Pro (this repo is public).
- Supabase Auth: set **Site URL** and **Redirect URLs** (`https://<host>/**`) for each environment BEFORE testing sign-up emails, or links land on the home page.
- Supabase's built-in email only reaches members of the Supabase team, a few per hour. **Custom SMTP (Resend) is needed before testing sign-up.**
- The Supabase GitHub integration only deploys when files under `supabase/` change.
- `VITE_*` variables are baked in at build time; changing them needs a rebuild.
- CI concurrency: never cancel push runs (see Mend's `.github/workflows/ci.yml`), or shared commits get red "cancelled" marks.
- Branch rules: `main` = PR + 1 approval + both CI checks + dismiss stale approvals + require approval of the most recent push; bypass "Repository admin" for pull requests only. `develop` = PR + CI checks, no approval. Oz merges his own PRs into `main` with "merge without waiting for requirements" (bypass).
- The cloud session's network blocks hosts until Oz allows them in the environment settings (done for: storywall.io, *.base44.app, *.base44.com, *.supabase.co, api.supabase.com, *.up.railway.app, backboard.railway.app, api.resend.com, api.z.ai, openrouter.ai).
- LibreChat agent: pick models under the **OpenRouter** provider (the DeepSeek provider gives "402 Insufficient Balance").
- Mend (`leopthe-cpu/mend`) has reusable patterns: `docs/environments.md`, `.github/workflows/ci.yml`, `CLAUDE.md`, `docs/librechat-agent.md`.

## The plan (phases)

Status legend: ✅ done · 🔶 in progress · ⬜ not started.

### ✅/🔶 Phase 0: Inventory (no app changes)
1. ✅ Pull every Base44-side file into GitHub; list differences (step 1 below).
2. ✅ GitHub is the only source of truth; Oz stopped editing in the Base44 builder; CLAUDE.md says so.
3. ✅ Inventory: SDK calls, entities and fields, functions, secrets, emails, storage (step 3 below).
4. ✅ Checks a–j (step 4 below).
5. ✅ Decisions: Supabase option (2), Google/Apple (off in Base44, nothing to keep), MCP (12), analytics (9), link previews (10).
6. 🔶 Oz reviews this plan.

### 🔶 Phase 0.5: Record current behaviour (before any migration code)
- Playwright end-to-end tests against the **live Base44 app**, selecting elements by role and visible text only (the Base44 version can't be changed), so the same tests run on both sites. Phone and desktop sizes.
- Flows to cover (adjusted to what the app really has; likes/follows/saves/comments don't exist):
  - **Visitor:** landing page; public wall (lazy-loading feed); unclaimed username ("This wall isn't claimed yet"); private profile page (incl. its profile search box); builder requires sign-in.
  - **Account:** sign in; wrong-password message; sign out; onboarding (5 steps: name+username, headline+bio, location, links, photo); username claim from the landing page. Sign-up email codes and forgot-password are checked **by hand by Oz** on both sites.
  - **Profile owner:** edit profile, private/public switch, profile photo, links.
  - **Builder:** text, image, video and audio elements; drag, resize, crop, zoom; Text FX and warps; autosave and reopen a draft; templates; delete a draft.
  - **AI Generate (premium):** visible and working for the admin; for the normal user it is shown but locked ("Premium feature — upgrade to unlock"), not hidden.
  - **Publish:** preview, skill tags (AI + manual), story appears on the wall.
  - **Wall management:** reorder, archive/unarchive (archived = hidden from the wall, only the owner sees it and can unarchive), edit, delete.
  - **Admin-only:** Prompt Test page; "Download images" buttons.
- Tests that create or delete data run **only as `leo`** and clean up after themselves; never write with `leopteh` (decision 16). They are named `*.write.spec.js` and run one at a time after the read-only tests (phone, then desktop).
- Screenshot baselines of key screens and rendered cards (editor, thumbnail, published) at phone and desktop sizes; animations off, timestamps masked.
- All tests must pass on Base44 first. They define "works the same".
- Progress (2026-10-09): 67 test runs pass on Base44 (phone + desktop). Covered: visitor pages; landing username claim; sign-in redirect, settings, sign out; roles (Generate/Prompt Test/"Download images" visibility); edit profile fields and links; private/public switch and the private page's search; builder text + autosave + reopen + delete draft; templates; Text FX + warp survive save/reopen; publish with suggested and own skills; archive/restore; edit + re-post; delete. Opt-in (`SW_RUN_GENERATE=1`, uses paid AI): Generate. Data-changing tests are `*.write.spec.js`, run as `leo` one at a time and clean up (checked in the database after each run). **Not yet covered:** "locked for normal users" checks (need a non-admin account, `SW_NORMAL_*`); wrong-password message; onboarding (needs a new account, i.e. the sign-up email code); drag/resize/crop/zoom; image/video/audio uploads and profile photo (checked by hand by Oz, decision 18); clicking "Download images"; screenshot baselines.

### ⬜ Phase 1: Environments and email
- Branches `develop` and `main`; rulesets as in the lessons above; CI workflow (lint, build, tests, secret scan, database tests).
- Supabase GitHub integration (production from `main`, staging from `develop`). Site URL + Redirect URLs per environment.
- Railway project `storywall` with `staging` and `production`.
- DNS: GoDaddy can't do CNAME flattening/ALIAS at the root (to confirm) → move DNS to Cloudflare (free) now, keeping every existing record (step 4h).
- Resend: verify storywall.io (SPF/DKIM/DMARC), connect as custom SMTP on **both** Supabase projects, sign-up/sign-in templates send the 6-digit code (`{{ .Token }}`), raise the auth email rate limit sensibly.

### ⬜ Phase 2: Database and storage
- Migrations for all used entities (`Post.cards[].elements[]` keeps every field), reproducing Base44's built-ins (`created_by`, dates, sorting, `role`); Oz's account stays admin.
- RLS matching current visibility rules, **except the privacy fixes below**; storage buckets (public + private with signed URLs) with size limits (Free plan: 50 MB/file; Base44's limit still to verify); premium check (PremiumGrant + admins). Database tests (pgTAP).
- One-off import of `leopteh`'s data incl. media files (decision 7).

### ⬜ Phase 3: Server functions
- Port the 10 functions to Supabase Edge Functions; keep rate limits and the premium check.
- Replace Base44's built-in AI (InvokeLLM, GenerateImage) with Oz's own provider, matching current models where possible: **propose options and costs, then ask Oz.** Secrets per environment are set by Oz (new z.ai key: decision 8).

### ⬜ Phase 4: Frontend
- Replace the Base44 SDK with a small data layer over supabase-js; all auth flows including a **new reset-password flow** (Base44's hosted page goes away); remove `@base44/vite-plugin` and app-params.
- Serve the app on Railway so `storywall.io/<username>` routes work. Security headers (match today's: HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy). Generic link-preview tags (decision 10). No analytics (decision 9).
- Rendering parity: editor, thumbnails and published cards must still match (CLAUDE.md "Rendering model").

### ⬜ Phase 5: Parity
- Run the Phase 0.5 tests and screenshots against staging. Every difference is a bug to fix before moving on.
- List intentional differences (AI wording, reset-password screens, privacy fixes) and get Oz's OK. Oz checks the sign-up email flow by hand.

### ⬜ Phase 6: Go live
- Production passes the same tests. Recreate test accounts.
- A day before: lower storywall.io's DNS TTL. Then point storywall.io to Railway (guide Oz through the DNS provider). **Rollback = point DNS back to Base44** (`A @ 216.24.57.1`, `CNAME www base44.onrender.com`).
- Keep the Base44 app untouched for an agreed period as a fallback; archive its full source; then cancel Base44.

### ⬜ Phase 7: Agent
- Invite `w0rkstufff` to this repo (Write); scoped Supabase token for `storywall-staging` only; add it to LibreChat's config; create a "StoryWall dev" agent; write `docs/librechat-agent.md`.
- Give Oz an operating guide **in the chat, not in the repo**, so he can run StoryWall alone.

## Privacy requirements for the new app (intentional differences)

Decided by Oz on 2026-10-09 (decision 14). The new app must not reproduce these Base44 behaviours, even though "works the same" is otherwise the rule:
- **Never expose a user's email address** to anyone but that user (and server code). Public walls and every API a visitor or other user can call return only the fields the page displays.
- Private notes behind a story (e.g. the notes given to Generate) are never sent to visitors.
- A user's full profile record (role, private settings) is readable only by that user and admins; others see only public profile fields, and nothing beyond "this profile is private" for private profiles.
- Ownership can't be changed by editing a record: write rules check the row both before and after the change.
- The owner of a private wall still sees their own wall and Settings, so they can make it public again (decision 17).
- Details of what was found on the live Base44 app are kept out of this public repo.

## Environments

| | Staging | Production |
|---|---|---|
| Git branch | `develop` | `main` (Oz approves) |
| Supabase project | `storywall-staging` (`vlgwcpqndmfhsfcxijpr`, ca-central-1) | `storywall` (`igakvqlzvglvuqflngey`, ca-central-1) |
| Railway | project `storywall`, env `staging` (not created yet) | env `production` (not created yet) |

## Phase 0, step 1: sync (done 2026-10-08)

All 220 files of the Base44 app are identical to this repo (sha1 per file). There is no `base44/mcp/` folder in Base44 either.

## Phase 0, step 3: inventory (2026-10-09)

### Data (Base44 entities → future Postgres tables)

Rows counted in the live Base44 database on 2026-10-09.

| Entity | Fields | Rows | Used by the app? |
|---|---|---|---|
| `User` (built-in + custom) | username, display_name, bio, profile_image, headline, location, skills, links[] (3 fields), is_premium (retiring), is_private + Base44 built-ins (id, email, full_name, role, created_date, …) | 4 | yes |
| `Post` | title, status (draft/published/archived), author_id, author_username, cards[] (each with elements[]), color_tokens[], cover_image, tags, display_order, ai_generated, generation_style, raw_notes, skill_refresh_count, skill_refresh_date | 127 | yes |
| `Media` | user_id, image_url (file uri/url), media_type, duration | 97 | yes (via functions) |
| `OnboardingDraft` | user_id, step, data | – | yes |
| `PremiumGrant` | user_id, note | 0 | yes (check only) |
| `UsernameClaim` | username, user_id | – | yes (server only) |
| `Like` | post_id, user_id, user_email | 0 | **no code uses it** |
| `Follow` | follower_id/email, following_id/email | 0 | **no code uses it** |
| `Save` | post_id, user_id, user_email | 0 | **no code uses it** |
| `Comment` | post_id, user_id, user_email, user_name, user_avatar, body | 0 | **no code uses it** |

Access rules (RLS) are defined in each `base44/entities/*.jsonc` file and will be reproduced as Postgres RLS policies in Phase 2. Summary:
- `Post`: anyone reads published; author reads own drafts/archived; author or admin writes.
- `User`: readable by everyone; a user updates only their own record; admin can do everything.
- `Media`, `UsernameClaim`, `PremiumGrant`: created only by server functions or admins.
- `OnboardingDraft`: owner only (plus admin).

### Base44 SDK calls in the browser (`src/`)

- **Auth:** `auth.me` (28×), `register`, `verifyOtp`, `resendOtp`, `loginViaEmailPassword`, `setToken`, `updateMe`, `logout`, `redirectToLogin` (used for "Forgot password" → Base44's hosted page), `isAuthenticated`.
- **Entities:** `Post` (create, get, filter, update, bulkUpdate, delete), `OnboardingDraft` (create, filter, update, delete), `PremiumGrant.filter`, `Media.deleteMany`.
- **Files:** `UploadPrivateFile` (builder media, audio), `UploadPublicFile` (StoryCreator, PromptTest), `UploadFile` (profile photo).
- **Functions:** `functions.invoke` for all 10 functions below.

### Server functions (`base44/functions/`, 10, not 8)

| Function | Login needed | Rate limit | Premium | Base44 features used |
|---|---|---|---|---|
| `checkUsername` | no (pre-signup) | yes | – | User.filter (service role) |
| `getPublicProfile` | no (public walls) | yes | – | UsernameClaim, User, Post (service role) |
| `searchProfiles` | yes | – | – | User.list (service role) |
| `setUsername` | yes | – | – | UsernameClaim, User.update (service role) |
| `registerMedia` | yes | – | – | Media.create (service role) |
| `resolveDraftMedia` | yes | – | – | Media.filter, CreateFileSignedUrl |
| `publishStoryMedia` | yes | – | – | Media.filter, CreateFileSignedUrl, UploadPublicFile |
| `structureStory` | yes | – | **yes** | InvokeLLM (Base44 built-in AI, JSON schema output) |
| `generateImage` | yes | – | **yes** | GenerateImage (Base44 built-in) |
| `suggestSkills` | yes | – | – | z.ai API directly (`glm-5.3-flash`), secret `ZAI_API_KEY` |

Shared helpers: `base44/shared/premium.ts` (hasPremium), `rateLimit.ts`, `username.ts`.

### Secrets stored in Base44 (names only)

- `ZAI_API_KEY`: used by `suggestSkills`.
- `DASHSCOPE_API_KEY`: **not referenced anywhere in the code.** To be confirmed in step 4i: possibly a leftover, or meant for the Qwen image model mentioned in `generateImage`'s comments.

### Pages / routes (`src/App.jsx`)

`/`, `/signin`, `/signup`, `/verify`, `/onboarding`, `/create` (login), `/prompt-test` (login + admin check in the page), `/:username` (public profile), `*` (404).
`src/pages/OAuthConsent.jsx` exists but **no route points to it**.

### Things Base44 provides outside our code

- Sign-up / sign-in emails with codes, and the hosted "Forgot password" page.
- Built-in record fields: `id`, `created_date`, `updated_date`, `created_by`; `User.role`.
- Page-view analytics: a script injected into `index.html` that POSTs to `/api/app-logs/<app id>/log-user-in-app/<page>`.
- Link previews (Open Graph tags) on every page: title "StoryWall", description "A streamlined visual project management and collaboration workspace for creative teams.", Base44-hosted logo image. Same for every URL (to be confirmed for profile URLs in step 4f).
- Security headers on storywall.io (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy).

## Phase 0, step 4: checks (2026-10-09)

**a. Login methods.** Base44's live auth config (`/api/apps/public/login-info/by-id/<app id>`): email + password only. Google, Apple, Microsoft, Facebook and SSO are all **off**. StoryWall's own `/signin` page has no social buttons either; the "Provided by Google/Apple" text in `BurgerMenu.jsx` is unreachable. "Forgot password?" goes to Base44's hosted `/login` page.

**b. MCP / OAuthConsent.** Base44 reports the app's MCP server as `active: false, published: false`, no tools, no config, and no route in `App.jsx` reaches `OAuthConsent.jsx`. The feature is **not live**.

**c. Base44 built-ins the code relies on.** Fields: `id`, `created_date` (11 uses), `updated_date` (7), `created_by` (5, email), `full_name` (18), `provider` (7, BurgerMenu only), `User.role` (admin checks). Sorting: `'-updated_date'`, `'created_date'` (minus = newest first). Filters: equality objects, e.g. `{ author_id, status }`.

**d. Upload sizes.** In our code: images are downscaled in the browser to 1600 px (`imageOptimize.js`); Prompt Test caps reference images at 10 MB; video and audio have **no size check in our code**. Base44's own server-side limit: *not verified yet* (to check before Phase 2 sets bucket limits; Supabase Free = 50 MB per file).

**e. Analytics.** Two Base44 trackers, both platform-injected: page views (`POST /api/app-logs/<app>/log-user-in-app/<page>`) and events (`POST /api/apps/<app>/analytics/track/batch`). Nothing in our code reads them.

**f. Link previews.** Server-side Open Graph tags from Base44, generic: home and `/login` → "StoryWall" + "A streamlined visual project management and collaboration workspace for creative teams." + Base44-hosted logo (1200×630). Profile URLs (e.g. `/leopteh`) → title "storywall", "Public Profile on StoryWall. A streamlined visual project management…", same logo. No per-user name/photo. Twitter card: `summary_large_image`.

**g. Supabase connector in `base44/connectors/supabase.jsonc`.** Lists only OAuth scopes, no project. No StoryWall data in any Supabase project (Oz's StoryWall Supabase account was new and empty on 2026-10-08).

**h. Domain.** Registered at GoDaddy; DNS hosted at GoDaddy (default nameservers `ns59/ns60.domaincontrol.com`). Records on 2026-10-09 (all TTL 1 hour):

| Type | Name | Value | Purpose |
|---|---|---|---|
| A | @ | 216.24.57.1 | Base44 hosting (rollback target) |
| CNAME | www | base44.onrender.com | Base44 hosting |
| CNAME | em, s1._domainkey, s2._domainkey | `*.wl200.sendgrid.net` | Base44 custom email domain (`hello@storywall.io`); Base44 reports it as **never finished** (`pending_user_dns_configuration`), so Base44's emails don't use it today |
| CNAME | _domainconnect | _domainconnect.gd.domaincontrol.com | GoDaddy default |
| NS, SOA | @ | GoDaddy | GoDaddy default |

**No MX records**: nobody receives email at @storywall.io today. Railway needs CNAME flattening or a dynamic ALIAS record at the root (docs.railway.com/networking/domains/working-with-domains#adding-a-root-domain); GoDaddy's record list offers neither as far as we know (*not fully verified*), so the plan is to move DNS to Cloudflare (free) in Phase 1, keeping every record above.

**i. AI models.** `structureStory` calls Base44 `InvokeLLM` with **no model specified** (Base44's default model; which one is *not verified*), JSON-schema output, optional image `file_urls`, two calls per run (structure + verify, up to 2 attempts). `generateImage` calls Base44 `GenerateImage`; code comments mention Qwen-Image-3.0 image-to-image (`existing_image_urls`). Base44 also stores an unused `DASHSCOPE_API_KEY` (DashScope = Alibaba's Qwen API), which fits that. `suggestSkills` calls z.ai directly (`glm-5.3-flash`).

**j. z.ai key.** Oz can create z.ai keys (a new one will be made for Supabase; see decision 8).

### Test accounts (live Base44)

- Admin + premium: `leopteh`.
- Normal user: `leo`.
- Credentials: stored by Oz as environment variables in the cloud environment settings (never in chat or repo).

## Product behaviour notes (confirmed by Oz, 2026-10-09)

- **Archive:** an archived story is hidden from the public wall; only its owner still sees it and can unarchive it, which makes it visible on the wall again.
- **Profile search today:** the only search in the app is the small "Search profiles by name or username…" box on the "This profile is private" page (`PrivateProfileState.jsx` → `searchProfiles`, signed-in users only). It is existing behaviour and is migrated as-is.
- **Link previews during the migration:** the new app shows the same generic card Base44 shows today (static tags in `index.html`). Per-person previews come after the migration.

## Base44 behaviour found while writing tests (2026-10-09)

Recorded as-is ("works the same"); Oz decides whether any is fixed instead.
- **Private wall locks out its owner:** once private, the owner's own wall also shows "This profile is private", so Settings (and the switch back) can't be reached. **Fixed in the new app** (decision 17).
- **Profile search on the private page** returns "No profiles found" to signed-out visitors (the search needs a sign-in); signed-in users get results.
- **Reordering stories can't be reached:** `ReorderStories` exists but nothing opens it.
- **No "Replace this story?" question for templates:** `TemplateConfirmModal` isn't used; a template saves the current story as a draft, then starts a new one.
- **Delete and archive are saved after the story leaves the screen;** reloading within a split second can cancel the save.
- **Generate keeps the user's sentences but may drop ones that aren't story** (e.g. a leading label), and makes about 3 pictures per run; deleting the draft doesn't delete those picture files (nor do any other deletes).
- **When skills are suggested, the "tag your own" box is hidden;** it appears only when matching finds nothing.

## After migration (not doing now)

Oz's backlog for after go-live. Nothing here is built during the migration.

1. **Per-person link previews** (decision 10): when a wall link is shared (WhatsApp, LinkedIn, iMessage, Slack), show that person's name, headline and photo instead of the generic StoryWall card. Also replace Base44's stored description ("A streamlined visual project management and collaboration workspace for creative teams."), which doesn't describe StoryWall.
2. **Search / discovery** (decision 11): keyword search across profiles, skill tags and stories, e.g. recruiters finding candidates, people finding stories to read.
3. **AI-assistant integration (MCP)** (decision 12): let AI assistants act on a StoryWall account. Base44 had an unfinished, switched-off version (`src/pages/OAuthConsent.jsx`, no route); it is not migrated.
4. **Analytics** (decision 9).
5. **Change-password screen** for signed-in users (today there's only "Forgot password?"). Then Oz changes the `leopteh` test password (decision 15).
6. **Likes / follows / saves / comments:** tables exist in Base44 but no screens and no data. Decide whether to build the feature; the empty tables are not migrated.
