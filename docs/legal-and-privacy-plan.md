# Legal and privacy plan (before public launch)

Oz, 2026-10-16: StoryWall needs Terms of Service and a Privacy Policy that cover what we actually do with user data, for users in Canada, the US and Europe, with no blind spots. GDPR compliance is the goal; we take it one step at a time. Status: planned, not started.

Note: this plan and the documents it produces are drafts by an AI assistant, not legal advice. A lawyer (Canadian, with EU/US privacy experience) should review the final Terms and Privacy Policy before launch.

## Step 1. Research (laws and what they require)

For each law: who it applies to, what the Terms/Policy must say, and what the product must do (features, not just text). Use primary sources (the laws and regulators' guidance), not summaries.

- Canada:
  - PIPEDA (federal private-sector privacy law), plus any update in force by launch.
  - Quebec Law 25: privacy officer, privacy impact assessments, consent rules, breach register.
  - CASL (anti-spam): consent for marketing e-mails.
- United States:
  - California (CCPA/CPRA): notice at collection, "do not sell or share", and the rights to know, delete and correct. Check whether StoryWall meets the thresholds; even if it doesn't yet, follow it as best practice.
  - Other state privacy laws (Virginia, Colorado, Connecticut, Texas, …): same check.
  - COPPA: users under 13. We should set a minimum age and say so.
  - CAN-SPAM: rules for e-mails.
  - DMCA: a notice-and-takedown process for copyrighted content users post.
- Europe:
  - EU GDPR and UK GDPR: a legal basis for each use of data; the rights to access, correct, delete, export, object and restrict; consent records; data processing agreements with every provider; international transfer safeguards (EU–US Data Privacy Framework or standard contractual clauses); breach notification within 72 hours; records of processing; whether an EU/UK representative is needed.
  - ePrivacy rules: cookies and local storage. Consent is needed before any non-essential tracking, which matters for the planned visitor tracking (decision 34).
  - EU AI Act: transparency duties for AI-generated content (Generate, AI pictures).
  - Digital Services Act: duties for platforms that host user content (notice and action, terms clarity), and whether any apply at our size.

## Step 2. Data inventory (what StoryWall collects and where it goes)

Built from the code and the live setup, so the Policy matches reality:

- **Account:** e-mail, password (hashed, Supabase Auth), name, username.
- **Profile:** headline, bio, location, skills, links, profile picture, private/public setting.
- **Stories:** cards (text, pictures, videos, audio), titles, skill tags, drafts.
- **Generate:** the raw notes typed into Generate (kept private), plus attached pictures.
- **AI processing:**
  - Story text and notes go to OpenRouter and on to the model providers it routes to (structuring, skill suggestions).
  - Picture prompts go to the image model.
  - Check each provider's data retention and training policy.
- **Usage data:** AI call counts per day (the new limit), logs at Supabase, Railway, Cloudflare and Resend.
- **Providers (sub-processors):** Supabase (database, storage, auth, functions), Railway (web hosting), Cloudflare (DNS), Resend and SendGrid (e-mail), OpenRouter and the model providers, GoDaddy (domain only), GitHub (code only, no user data).
  - Base44 too, until it is shut down: it still holds a copy of the old app's data, which must be deleted when the fallback ends.
- **Where the data lives:** the Supabase and Railway regions (check), which decides whether data leaves Canada/the EU.
- **Retention:** how long each kind of data is kept, and what happens to it after an account is deleted.

## Step 3. Product changes the laws require (build before or with the documents)

- **Account deletion** from Settings, which removes the profile, stories, notes, files and the auth record. Published media in public storage must be removed too.
- **Data export** ("download my data"): profile, stories, notes and files as a zip or JSON.
- **Sign-up consent:** "I agree to the Terms and Privacy Policy", with the date and version stored.
- **Age gate:** a minimum age at sign-up (13 for the US/COPPA; up to 16 in some EU countries; to decide).
- **Cookie and storage notice:** a consent banner only if we add non-essential tracking (decision 34). Today the app uses only essential storage (the sign-in session); check this.
- **Marketing e-mail consent**, if we ever send newsletters (CASL, GDPR).
- **Report content and copyright takedown:** a contact address or form.
- **AI disclosure:** say that Generate uses AI and that pictures may be AI-generated. Oz decided there's no tag on each picture; check that this is acceptable under the AI Act transparency rules.
- **Privacy contact:** an address for requests (privacy@storywall.io), and a named privacy officer (Quebec Law 25).
- **Vendor agreements:** sign or accept the data processing agreement (DPA) of each provider in Step 2.
- **Breach plan:** who does what, and the deadlines (GDPR 72 hours; PIPEDA "as soon as feasible").

## Step 4. The documents

- **Terms of Service:**
  - who may use it (age), accounts;
  - user content: the user keeps ownership and gives StoryWall a licence to host and show it;
  - acceptable use, AI features (output may be wrong; the user is responsible for what they publish), premium access;
  - takedown process, ending accounts, disclaimers, limit of liability, governing law (Ontario/Canada?), changes to the terms, contact.
- **Privacy Policy:**
  - what we collect and why (legal basis per use), AI processing, sharing with providers (sub-processor list);
  - international transfers, retention, security, user rights and how to use them;
  - children, cookies and storage, changes, contact and privacy officer, the right to complain to a regulator (OPC, CAI, EU authorities, UK ICO).
- **Optional:** a short, plain-language summary at the top of each.
- **Where they live:** pages at storywall.io/terms and storywall.io/privacy, linked from sign-up, the footer and Settings.

## Step 5. GDPR compliance, one step at a time (after launch basics)

1. Records of processing (from the Step 2 inventory).
2. DPAs signed with all providers; transfer safeguards confirmed.
3. A process for handling user rights requests (within 1 month).
4. A data protection impact assessment for AI processing of user stories.
5. Breach plan tested.
6. Decide on an EU/UK representative (needed if we target EU/UK users without an establishment there).

## Order

Research (Step 1) and inventory (Step 2) first; then draft the documents (Step 4) and list the product changes (Step 3) together; then build deletion, export and sign-up consent; then the lawyer review; then launch.
