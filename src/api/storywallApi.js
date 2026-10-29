import { getSupabase } from '@/api/supabaseClient';

// The app's data layer on Supabase: one small function per thing the pages
// do today through the Base44 SDK, so each page can be switched over on its
// own (migration plan, Phase 4). Nothing imports this yet.
//
// Base44 → here:
//   auth.me / updateMe                → getMe() / updateMe()
//   PremiumGrant.filter, role==='admin' → myAccess()  (the UI hint only;
//                                       the server functions are the real gate)
//   Post.filter/get/create/update/delete/bulkUpdate → filterPosts() … reorderPosts()
//   OnboardingDraft.*                 → *OnboardingDraft*()
//   Media.deleteMany                  → removeFromMediaLibrary()
//   functions.invoke                  → invokeFunction()
//   Core.UploadPrivateFile            → uploadPrivateFile()  → { file_uri }
//   Core.UploadPublicFile / UploadFile → uploadPublicFile()   → { file_url }
//
// Field names follow the database: created_at / updated_at (Base44:
// created_date / updated_date), media.url (Base44: image_url).

const DRAFTS_BUCKET = 'drafts';
const PUBLIC_BUCKET = 'public-media';

// Profile columns the browser may change (the database grants exactly
// these; username goes through the setUsername function).
const PROFILE_FIELDS = [
  'full_name', 'display_name', 'headline', 'bio', 'location', 'profile_image',
  'skills', 'links', 'is_private',
];

// Base44 record fields that have no column here. author_id is set by the
// database from the signed-in user; author_username is read from the
// profile instead of stored (decision 19f). Any other unknown field is left
// in so the database rejects it loudly rather than dropping it silently.
const POST_IGNORED = ['id', 'author_id', 'author_username', 'created_by', 'created_date', 'updated_date'];

// Errors look like the Base44 SDK's (axios) so existing handlers that read
// e.response.data.error or e.status keep working.
function apiError(message, status, data) {
  const err = new Error(message || 'Request failed');
  err.status = status;
  err.response = { status, data };
  return err;
}

function check({ data, error, status }) {
  if (error) throw apiError(error.message, status, error);
  return data;
}

// '-updated_at' → newest first, 'created_at' → oldest first (Base44's sort strings).
function applySort(query, sort) {
  if (!sort) return query;
  const desc = sort.startsWith('-');
  return query.order(desc ? sort.slice(1) : sort, { ascending: !desc });
}

async function currentUser() {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

async function requireUser() {
  const user = await currentUser();
  if (!user) throw apiError('You need to sign in.', 401, { error: 'You need to sign in.' });
  return user;
}

// ---------- Auth

// Base44's wording where we know it ("Invalid email or password"), and
// plain words instead of Supabase's technical ones elsewhere.
const AUTH_MESSAGES = {
  invalid_credentials: 'Invalid email or password',
  otp_expired: "That code didn't work. Check it and try again.",
  over_email_send_rate_limit: 'Please wait a minute before asking for another code.',
  same_password: 'Choose a password different from your current one.',
};

function authFail(error, status) {
  const message = AUTH_MESSAGES[error.code] || error.message;
  return apiError(message, error.status || status, { message, code: error.code });
}

async function auth(call) {
  const { data, error, status } = await call;
  if (error) throw authFail(error, status);
  return data;
}

export async function signIn(email, password) {
  return auth(getSupabase().auth.signInWithPassword({ email, password }));
}

// Creates the account and emails a 6-digit code (the "Confirm sign up"
// template uses {{ .Token }}). Returns { needsCode } — false only if the
// project ever stops requiring email confirmation, in which case the user
// is already signed in.
// `ageConfirmed`: the sign-up form's consent box, which starts "I'm 16 or older" (minimum age 16,
// Oz 2026-10-19). `termsVersion`: the version of the Terms and Privacy
// Policy the person agreed to (LEGAL_VERSION, src/lib/legal.js). Both are
// kept on the account with the date, as a record of what was confirmed.
export async function signUp(email, password, { ageConfirmed = false, termsVersion = null } = {}) {
  const now = new Date().toISOString();
  const data = await auth(getSupabase().auth.signUp({
    email,
    password,
    options: {
      data: {
        ...(ageConfirmed ? { age_confirmed_16: now } : {}),
        ...(termsVersion ? { terms_version: termsVersion, terms_accepted_at: now } : {}),
      },
    },
  }));
  // For an address that already has a confirmed account, Supabase sends no
  // email and returns a user with no identities instead of an error.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    const message = 'An account with this email already exists. Sign in instead.';
    throw apiError(message, 409, { message, code: 'user_already_exists' });
  }
  return { needsCode: !data.session };
}

// Checks the emailed code; on success the user is signed in.
export async function verifySignupCode(email, code) {
  return auth(getSupabase().auth.verifyOtp({ email, token: code, type: 'email' }));
}

export async function resendSignupCode(email) {
  return auth(getSupabase().auth.resend({ type: 'signup', email }));
}

// Password reset by code (replaces Base44's hosted page): Supabase emails a
// 6-digit code (the "Reset password" template uses {{ .Token }}). For an
// address with no account it sends nothing and still succeeds, so the
// screen never reveals whether an account exists.
export async function requestPasswordReset(email) {
  return auth(getSupabase().auth.resetPasswordForEmail(email));
}

// A correct code signs the user in (a recovery session), which is what
// allows setting the new password next.
export async function verifyPasswordResetCode(email, code) {
  return auth(getSupabase().auth.verifyOtp({ email, token: code, type: 'recovery' }));
}

export async function setNewPassword(password) {
  return auth(getSupabase().auth.updateUser({ password }));
}

// Signs out this browser only. Supabase's default ('global') would also sign
// the user out on every other device, which Base44 didn't do.
export async function signOut() {
  return check(await getSupabase().auth.signOut({ scope: 'local' }));
}

// What the UI may show about the signed-in user: { is_admin, is_premium,
// is_lifetime } (tiers are separate, decision 50; admins have all three).
export async function myAccess() {
  if (!(await currentUser())) return { is_admin: false, is_premium: false, is_lifetime: false };
  const rows = check(await getSupabase().rpc('my_access'));
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { is_admin: !!row?.is_admin, is_premium: !!row?.is_premium, is_lifetime: !!row?.is_lifetime };
}

// The signed-in user's own profile plus their email (from Supabase Auth,
// shown only to themselves) and access flags. Throws (status 401) when
// signed out, like Base44's auth.me(), which every caller relies on.
export async function getMe() {
  const user = await requireUser();
  const sb = getSupabase();
  const [profile, access] = await Promise.all([
    sb.from('profiles').select('*').eq('id', user.id).single().then(check),
    myAccess(),
  ]);
  return { ...profile, email: user.email, ...access };
}

export async function updateMe(fields) {
  const user = await requireUser();
  const changes = Object.fromEntries(Object.entries(fields || {}).filter(([k]) => PROFILE_FIELDS.includes(k)));
  return check(await getSupabase().from('profiles').update(changes).eq('id', user.id).select('*').single());
}

// ---------- Stories

function splitPost(fields) {
  const row = Object.fromEntries(Object.entries(fields || {}).filter(([k]) => !POST_IGNORED.includes(k)));
  const hasNotes = Object.prototype.hasOwnProperty.call(row, 'raw_notes');
  const notes = row.raw_notes;
  delete row.raw_notes;
  return { row, hasNotes, notes };
}

// Story notes (raw_notes) live in the owner-only post_notes table so
// visitors never receive them (privacy requirements, decision 19d).
async function saveNotes(postId, notes) {
  check(await getSupabase().from('post_notes')
    .upsert({ post_id: postId, raw_notes: notes || '' }, { onConflict: 'post_id' }));
}

// Equality filters, e.g. { author_id, status: 'draft' }, as Base44's filter().
export async function filterPosts(filter = {}, sort = '-updated_at', limit) {
  let query = applySort(getSupabase().from('posts').select('*').match(filter), sort);
  if (limit) query = query.limit(limit);
  return check(await query);
}

// One story, with its notes when the reader is its owner.
export async function getPost(id) {
  const sb = getSupabase();
  const post = check(await sb.from('posts').select('*').eq('id', id).single());
  const notes = check(await sb.from('post_notes').select('raw_notes').eq('post_id', id).maybeSingle());
  return notes ? { ...post, raw_notes: notes.raw_notes } : post;
}

// A story to open in the builder. Wall and archive lists don't carry the
// owner-only notes, and without them a Generate story reopens as a plain
// one. If they can't be loaded, the story opens as listed: saving it then
// leaves the stored notes as they are.
export async function getPostForEditing(post) {
  try { return await getPost(post.id); } catch { return post; }
}

export async function createPost(fields) {
  const { row, hasNotes, notes } = splitPost(fields);
  const post = check(await getSupabase().from('posts').insert(row).select('*').single());
  if (hasNotes && notes) await saveNotes(post.id, notes);
  return hasNotes ? { ...post, raw_notes: notes } : post;
}

export async function updatePost(id, fields) {
  const { row, hasNotes, notes } = splitPost(fields);
  let post = null;
  if (Object.keys(row).length) {
    post = check(await getSupabase().from('posts').update(row).eq('id', id).select('*').single());
  }
  if (hasNotes) await saveNotes(id, notes);
  return post;
}

export async function deletePost(id) {
  check(await getSupabase().from('posts').delete().eq('id', id));
}

// [{ id, display_order }, …] as Base44's bulkUpdate for the wall order.
export async function reorderPosts(items) {
  const sb = getSupabase();
  await Promise.all(items.map(({ id, display_order }) =>
    sb.from('posts').update({ display_order }).eq('id', id).then(check)));
}

// ---------- Data export ("Download my data")

// Everything StoryWall stores about the signed-in user, as one object: the
// profile, every story (drafts, published, archived) with its private notes,
// the media library, Generate runs and onboarding drafts. Right of access /
// portability (GDPR Art. 15 and 20, LGPD Art. 18). Media files are listed
// by link, not copied in: public files open directly, private draft files
// are references the app signs on demand.
// Each read goes through the user's own access rules, so it can only ever
// return the user's own rows.
export async function exportMyData() {
  const user = await requireUser();
  const sb = getSupabase();
  const [profile, posts, media, jobs, onboarding] = await Promise.all([
    sb.from('profiles').select('*').eq('id', user.id).single().then(check),
    sb.from('posts').select('*').eq('author_id', user.id).order('created_at', { ascending: true }).then(check),
    sb.from('media').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).then(check),
    sb.from('generation_jobs').select('id, post_id, status, created_at, finished_at, error')
      .eq('user_id', user.id).order('created_at', { ascending: true }).then(check),
    sb.from('onboarding_drafts').select('*').eq('user_id', user.id).then(check),
  ]);
  const notes = posts.length
    ? check(await sb.from('post_notes').select('post_id, raw_notes').in('post_id', posts.map((p) => p.id)))
    : [];
  const notesByPost = Object.fromEntries(notes.map((n) => [n.post_id, n.raw_notes]));
  return {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile,
    stories: posts.map((p) => (notesByPost[p.id] ? { ...p, raw_notes: notesByPost[p.id] } : p)),
    media_library: media,
    generate_runs: jobs,
    onboarding_drafts: onboarding,
  };
}

// Deletes the signed-in user's account, files and data for good (the
// deleteAccount function). `confirm` is the username typed back.
export async function deleteMyAccount(confirm) {
  await invokeFunction('deleteAccount', { confirm });
}

// ---------- Onboarding drafts (owner-only)

export async function listOnboardingDrafts() {
  const user = await requireUser();
  return check(await getSupabase().from('onboarding_drafts').select('*').eq('user_id', user.id));
}

export async function createOnboardingDraft({ step, data }) {
  return check(await getSupabase().from('onboarding_drafts').insert({ step, data }).select('*').single());
}

export async function updateOnboardingDraft(id, { step, data }) {
  return check(await getSupabase().from('onboarding_drafts').update({ step, data }).eq('id', id).select('*').single());
}

export async function deleteOnboardingDraft(id) {
  check(await getSupabase().from('onboarding_drafts').delete().eq('id', id));
}

// ---------- Media library (rows are added only by the registerMedia function)

export async function removeFromMediaLibrary(url) {
  const user = await requireUser();
  check(await getSupabase().from('media').delete().eq('user_id', user.id).eq('url', url));
}

// ---------- Server functions

// Returns { data } like Base44's functions.invoke; a non-2xx answer throws
// with e.response = { status, data } holding the function's JSON body.
export async function invokeFunction(name, body) {
  const { data, error, response } = await getSupabase().functions.invoke(name, { body });
  if (!error) return { data };
  const res = response || error.context;
  let payload = null;
  if (res && typeof res.json === 'function') {
    try { payload = await res.json(); } catch { /* not JSON */ }
  }
  throw apiError(payload?.error || error.message, res?.status, payload);
}

// ---------- Walls

// The same fields getPublicProfile returns for a public wall.
const WALL_PROFILE_FIELDS = 'id, username, full_name, display_name, headline, bio, location, skills, links, profile_image';
const WALL_POST_FIELDS = 'id, author_id, title, status, cards, color_tokens, cover_image, tags, display_order, pinned_at, ai_generated, generation_style, card_size, created_at, updated_at';

// A wall as the page shows it: { status: 'public' | 'private' | 'not_found',
// user, posts }. Visitors get exactly what getPublicProfile returns. The
// owner of a PRIVATE wall gets their own wall back (decision 17: on Base44 a
// private wall locked its owner out of it and of Settings, so it could never
// be made public again); the database lets owners read their own rows.
export async function getWall(username) {
  const { data } = await invokeFunction('getPublicProfile', { username });
  if (data?.status !== 'private') return data;
  const user = await currentUser();
  if (!user) return data;
  const sb = getSupabase();
  const own = check(await sb.from('profiles').select(WALL_PROFILE_FIELDS)
    .eq('id', user.id).eq('username', data.user?.username || username).maybeSingle());
  if (!own) return data;
  const posts = check(await sb.from('posts').select(WALL_POST_FIELDS)
    .eq('author_id', user.id).eq('status', 'published'));
  return { status: 'public', user: own, posts };
}

// The signed-in author's unique views per story (Lifetime, decision 50):
// { [post_id]: count }. Empty for everyone else (the database decides).
export async function myStoryViewTotals() {
  const rows = check(await getSupabase().rpc('my_story_view_totals')) || [];
  return Object.fromEntries(rows.map((r) => [r.post_id, Number(r.unique_views) || 0]));
}

// ---------- File uploads (each user writes only inside their own folder)

function fileExtension(file) {
  const match = /\.[a-z0-9]{1,8}$/i.exec(file?.name || '');
  return match ? match[0].toLowerCase() : '';
}

async function upload(bucket, file) {
  const user = await requireUser();
  const path = `${user.id}/${crypto.randomUUID()}${fileExtension(file)}`;
  check(await getSupabase().storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  }));
  return path;
}

// Private builder media: referenced as "drafts/<uid>/<file>"; shown through
// signed links from resolveDraftMedia and copied to public-media on publish.
export async function uploadPrivateFile(file) {
  const path = await upload(DRAFTS_BUCKET, file);
  return { file_uri: `${DRAFTS_BUCKET}/${path}` };
}

// Public files (profile photos, Prompt Test reference images): a public URL.
export async function uploadPublicFile(file) {
  const path = await upload(PUBLIC_BUCKET, file);
  return { file_url: getSupabase().storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl };
}
