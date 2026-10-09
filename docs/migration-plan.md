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

## Phase 0, step 4h: domain (partial)

- storywall.io is registered at GoDaddy (Oz). DNS provider and records: pending (screenshot from GoDaddy).
- Today storywall.io resolves to `216.24.57.1` (Base44's hosting; response headers show Cloudflare + Render). This is the rollback target.
- Railway needs CNAME flattening or a dynamic ALIAS record for a root domain (docs.railway.com/networking/domains/working-with-domains#adding-a-root-domain). Unverified whether GoDaddy DNS offers either; if not, DNS moves to Cloudflare (free) in Phase 1, keeping every existing record.

## After migration (not doing now)

- Likes / follows / saves / comments: tables exist but no screens. Decide whether to drop the tables or build the feature.
