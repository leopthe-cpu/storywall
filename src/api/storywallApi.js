import { getSupabase } from '@/api/supabaseClient';

// The app's data layer on Supabase: one small function per thing the pages
// do today through the Base44 SDK, so each page can be switched over on its
// own (migration plan, Phase 4). Nothing imports this yet.
//
// Base44 → here:
//   auth.me / updateMe                → me() / updateMe()
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

// ---------- Auth (sign-up, codes and password reset come with Phase 4 step 2)

export async function signIn(email, password) {
  return check(await getSupabase().auth.signInWithPassword({ email, password }));
}

export async function signOut() {
  return check(await getSupabase().auth.signOut());
}

// What the UI may show about the signed-in user: { is_admin, is_premium }.
export async function myAccess() {
  if (!(await currentUser())) return { is_admin: false, is_premium: false };
  const rows = check(await getSupabase().rpc('my_access'));
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { is_admin: !!row?.is_admin, is_premium: !!row?.is_premium };
}

// The signed-in user's own profile plus their email (from Supabase Auth,
// shown only to themselves) and access flags; null when signed out.
export async function me() {
  const user = await currentUser();
  if (!user) return null;
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
