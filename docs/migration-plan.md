# Migration plan: Base44 → Railway + Supabase + Resend

Status: **Phase 0 (inventory) in progress.** Decisions are logged in [`decisions.md`](decisions.md).

Goal: the new app behaves exactly like the Base44 app (frozen at Base44 commit `e359934`, published 2026-10-08 19:49 UTC). No new features during the migration (see "After migration" at the end).

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

## After migration (not doing now)

Oz's backlog for after go-live. Nothing here is built during the migration.

1. **Per-person link previews** (decision 10): when a wall link is shared (WhatsApp, LinkedIn, iMessage, Slack), show that person's name, headline and photo instead of the generic StoryWall card. Also replace Base44's stored description ("A streamlined visual project management and collaboration workspace for creative teams."), which doesn't describe StoryWall.
2. **Search / discovery** (decision 11): keyword search across profiles, skill tags and stories, e.g. recruiters finding candidates, people finding stories to read.
3. **AI-assistant integration (MCP)** (decision 12): let AI assistants act on a StoryWall account. Base44 had an unfinished, switched-off version (`src/pages/OAuthConsent.jsx`, no route); it is not migrated.
4. **Analytics** (decision 9).
5. **Likes / follows / saves / comments:** tables exist in Base44 but no screens and no data. Decide whether to build the feature; the empty tables are not migrated.
