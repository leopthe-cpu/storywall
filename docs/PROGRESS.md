---
project: Storywall
updated: 2026-10-21
summary: Storywall has run on Railway + Supabase at storywall.io since 15 Oct, and Generate now runs as a server job in production. A batch of loading-screen, template, colour, theme-picker and privacy work (data export, account deletion) is on staging and waits for Oz to release it. Minimum age (16) and governing law (Ontario, Canada) are decided; the age gate, Terms, privacy policy and the Base44 shutdown are next.
---

## Doing
- [ ] Test the staging batch (PRs 93–121) and release develop to production @me #release #testing
  On develop, not yet merged to main: shared loaders, framework templates, colour variation, theme picker, more fonts, bigger text, data export, account deletion, age gate, Terms/Privacy and consent, change password, www redirect, faster page loads. Production needs Oz's approval.

## To do
- [ ] Faster AI steps: picture model and size, structuring model @claude #performance #ai
  Needs a small paid test (about $1–2) and Oz's OK first. Sonnet is kept unless a faster model passes the word-for-word check.
  Source: docs/performance-plan.md §B
- [ ] Smaller picture copies for Drafts and walls @claude #performance
  Check the stored sizes first. Supabase image resizing may need a paid plan.
  Source: docs/performance-plan.md §C; CLAUDE.md backlog "Image perf"
- [ ] Measure page load on a real phone, before and after @me #performance #testing
  Source: docs/performance-plan.md §C
- [ ] Generate input as an open canvas @claude #generate #later
  Freeform-style canvas with drag-and-drop pictures and a + button. Marked "later".
  Source: docs/generate-roadmap.md §B
- [ ] Data inventory: what is collected and where it goes @claude #legal
  Step 1 (research on PIPEDA, Law 25, CASL, CCPA, COPPA, GDPR, AI Act, DSA) is done and kept in Oz's Google Drive, not in this public repo. Step 2 is still to do.
  Source: docs/legal-and-privacy-plan.md Steps 1–2
- [ ] Check with the lawyer that untagged AI pictures meet the EU AI Act @me #legal #ai
  The in-app AI notice on the Generate screen is done (PR 118).
  Source: docs/legal-and-privacy-plan.md Step 3
- [ ] GDPR follow-up: records of processing, rights requests, DPIA, breach plan @claude #legal #later
  Source: docs/legal-and-privacy-plan.md Step 5
- [ ] Visitor tracking: wall views, story views, link clicks @claude #analytics
  The first thing to build after the migration (decision 34). Check the privacy-notice wording first.
  Source: docs/migration-plan.md "After migration" 4; docs/decisions.md 34
- [ ] Per-person link previews for shared walls @claude #sharing
  Also replace Base44's old stored description.
  Source: docs/migration-plan.md "After migration" 1; docs/decisions.md 10
- [ ] Profile, skill and story search @claude #discovery
  Source: docs/migration-plan.md "After migration" 2; docs/decisions.md 11
- [ ] Phase 7: LibreChat agent for Storywall @claude #infra
  Invite w0rkstufff, a staging-only Supabase token, a "StoryWall dev" agent, and an operating guide given in chat.
  Source: docs/migration-plan.md Phase 7
- [ ] Doc 111: split a card by hand when text overflows @claude #builder
  Source: CLAUDE.md "Open items / backlog"
- [ ] Rich text in cards (colour and style per word): half-day spike first, then an estimate @claude #builder #later
  Source: chat with Oz, 2026-10-17
- [ ] Reconcile the original doc 108 (Text FX) spec @me #builder
  Oz pastes the spec. Status unclear.
  Source: CLAUDE.md "Open items / backlog"
- [ ] Test the Sept image and text changes on real phones @me #testing
  Source: CLAUDE.md "Open items / backlog"

## Waiting
- [ ] Confirm three facts the Privacy Policy states @me #legal
  Production Supabase region (staging is ca-central-1); OpenRouter prompt logging off; then update src/lib/legal.js if anything differs.
  Source: PR 116
- [ ] Shut down Base44 after the fallback period @me #migration
  Keep it untouched for an agreed period, archive the source, cancel, and delete its copy of user data. Planned around 24 Oct, depending on tests.
  Source: docs/migration-plan.md Phase 6; CLAUDE.md on develop; docs/legal-and-privacy-plan.md Step 2
- [ ] OK the paid test spend for faster AI models @me #ai #decision
  About $1–2 of test runs. "Ask Oz before running."
  Source: docs/performance-plan.md §B
- [ ] Register the business name (sole proprietorship, Ontario) @me #legal
  Check the name against the Canadian Trademarks Database first: "Popmart" is close to the POP MART toy brand. The Terms name the business once registered.
  Source: chat with Oz, 2026-10-19
- [ ] Find a lawyer to review the Terms and Privacy Policy @me #legal
  A Canadian lawyer with EU/US privacy experience, before launch.
  Source: docs/legal-and-privacy-plan.md note and "Order"
- [ ] Set up privacy@storywall.io and name a privacy officer @me #legal
  Source: docs/legal-and-privacy-plan.md Step 3
- [ ] Accept each provider's DPA @me #legal
  Supabase, Railway, Cloudflare, Resend, SendGrid, OpenRouter and the model providers.
  Source: docs/legal-and-privacy-plan.md Steps 2–3
- [ ] Decide: likes, follows, saves and comments @me #decision
  The tables exist in Base44 only, with no screens or data.
  Source: docs/migration-plan.md "After migration" 6
- [ ] Decide: reserve the app's own page names as usernames @me #decision
  create, verify, onboarding, prompt-test.
  Source: docs/migration-plan.md "After migration" 8
- [ ] Decide: unused fields and the multi-textbox "coordinated shrink" @me #decision #builder
  panX, panY, zoomLevel, isPannable; keep or remove the coordinated shrink.
  Source: CLAUDE.md "Open items / backlog"

## Done
- [x] Phase 0: inventory, GitHub as the only source of truth @claude #migration (2026-10-09)
  Source: docs/migration-plan.md Phase 0
- [x] Phase 0.5: Playwright tests and screenshots of the live Base44 app @claude #testing (2026-10-09)
  Source: docs/migration-plan.md Phase 0.5
- [x] Environments: protected branches, CI, Railway, Supabase staging @claude #infra (2026-10-10)
  Source: docs/migration-plan.md Phase 1; docs/decisions.md 21
- [x] Resend email with 6-digit codes, staging then production @claude #email (2026-10-15)
  Source: docs/migration-plan.md Phases 1 and 6; docs/decisions.md 24–26
- [x] Database, storage and access rules on Supabase, with pgTAP tests @claude #database (2026-10-15)
  Source: docs/migration-plan.md Phases 2 and 6; docs/decisions.md 19
- [x] All 10 server functions ported, AI moved to OpenRouter @claude #ai (2026-10-10)
  Source: docs/migration-plan.md Phase 3; docs/decisions.md 20, 22
- [x] Frontend off Base44: auth, walls, builder, publish, Generate @claude #app (2026-10-14)
  Source: docs/migration-plan.md Phase 4; commit "Remove Base44 from the app" (PR 36)
- [x] Phase 5 parity run and approved intentional differences @me #testing (2026-10-14)
  Source: docs/migration-plan.md Phase 5; docs/decisions.md 36
- [x] Go live: storywall.io on Railway, DNS moved to Cloudflare @me #launch (2026-10-15)
  Source: docs/migration-plan.md Phase 6; docs/decisions.md 37–39
- [x] Production test run: 85 passed @claude #testing (2026-10-15)
  Source: docs/migration-plan.md Phase 6; docs/decisions.md 39
- [x] Generate layout engine and three card styles @claude #generate (2026-10-15)
  Source: commits PRs 52–55
- [x] Generate as a server job that keeps running when the tab closes @claude #generate #performance (2026-10-16)
  generation_jobs, startGeneration, generateJobImage; the old pipeline is kept as a backup.
  Source: docs/performance-plan.md §A; commits PRs 75–79, released in PR 92
- [x] Drafts placeholder, "story ready" toast and email @claude #generate (2026-10-16)
  Source: docs/performance-plan.md "Decided"; commits PRs 84–89
- [x] AI pictures stored as WebP @claude #performance (2026-10-16)
  Source: commit PR 91
- [x] Security: CSP header, shared rate limits, daily AI limits @claude #security (2026-10-16)
  Source: commits PRs 63, 65, 68–70
- [x] One shared loading screen, grid behind full-page loaders, "Sit back" card @claude #ux (2026-10-17)
  On staging only.
  Source: docs/generate-roadmap.md §A, §A2; commits PRs 93–95, 103–105
- [x] Colours take turns across a story's cards; theme picker @claude #generate (2026-10-17)
  On staging only.
  Source: docs/generate-roadmap.md §A3, §B (colours); commits PRs 96, 106–109
- [x] One template per story framework (11) @claude #templates (2026-10-17)
  On staging only.
  Source: docs/generate-roadmap.md §A4; commits PRs 97–98
- [x] "Download my data" and "Delete my account" in Settings @claude #privacy #legal (2026-10-17)
  On staging only.
  Source: docs/legal-and-privacy-plan.md Step 3; commits PRs 100–101
- [x] AI text requests only go to providers that don't store or train on data @claude #privacy #ai (2026-10-17)
  On staging only.
  Source: docs/legal-and-privacy-plan.md Step 2; commit PR 99

- [x] Minimum age 16, governing law Ontario, Canada @me #legal #decision (2026-10-19)
  Storywall is run by Oz as a sole proprietor in Ontario.
  Source: chat with Oz, 2026-10-19
- [x] Loading-screen percentage uses Pixelify Sans (free, SIL OFL) instead of FK Raster Grotesk @claude #brand (2026-10-17)
  Oz asked for a free pixel font, so the FK Raster licence check is no longer needed.
  Source: commit PR 104
- [x] More font pairings, brighter colours, slightly bigger text @claude #generate (2026-10-17)
  On staging only.
  Source: commits PRs 106–108

- [x] 16+ age gate and Terms/Privacy consent at sign-up, stored with version and date @claude #legal #app (2026-10-21)
  On staging only.
  Source: PRs 113, 117
- [x] Terms of Service and Privacy Policy pages, with report-content contact @claude #legal (2026-10-21)
  Draft for the lawyer's review. On staging only.
  Source: PR 116
- [x] AI notice on the Generate notes screen @claude #legal #ai (2026-10-21)
  Source: PR 118
- [x] Change password in Settings @claude #auth (2026-10-21)
  Source: PR 119
- [x] www.storywall.io redirects to storywall.io; "Storywall" spelling on screen @claude #infra #brand (2026-10-21)
  Source: PRs 114, 115
- [x] JavaScript split by page: main file 330 KB → 240 KB gzipped @claude #performance (2026-10-21)
  Source: PR 120
- [x] Profile picture: delayed spinner, loads first @claude #ux (2026-10-21)
  Source: PR 121
- [x] Compact slider style everywhere (already the default; the one other slider, ImageCropModal, is unused code) @claude #builder (2026-10-21)
  Source: src/components/creator/MinimalSlider.jsx

- [x] Scoped Supabase tokens per environment (staging and production), CLI deploys @me #infra (2026-10-21)
  Replaces the claude.ai Supabase connector for Storywall work; see CLAUDE.md "Supabase access".
  Source: PR 124
- [x] Production functions updated: startGeneration (theme), deleteAccount (new), structureStory and suggestSkills (no-training AI routing) @claude #release (2026-10-21)
  Deployed with the Supabase CLI from develop, staging first; all active, sign-in required. The frontend that uses the theme and account deletion reaches production with the develop → main release.
  Source: chat, 2026-10-21

- [x] privacy@storywall.io receives mail @me #legal (2026-10-21)
  Cloudflare Email Routing forwards it to Oz's inbox; test email arrived.
  Source: chat, 2026-10-21

## Marketing
- [ ] Plan marketing (nothing documented yet) @me
