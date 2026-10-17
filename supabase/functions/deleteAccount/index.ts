import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { DRAFTS_BUCKET, PUBLIC_BUCKET } from '../_shared/media.ts';
import { isAdmin } from '../_shared/premium.ts';

// Deletes the caller's own account and everything in it ("Delete my
// account" in Settings; right to erasure, GDPR Art. 17 / LGPD Art. 18).
//
//   1. Every file in the user's folders (drafts/<id>/…, public-media/<id>/…).
//      Files aren't linked to the account in the database, so they don't go
//      with it; every upload path starts with the user's id.
//   2. The sign-in account. Every table that holds user data references it
//      with ON DELETE CASCADE (profiles → posts → post_notes, media,
//      generation_jobs, premium_grants, admins, onboarding_drafts, AI usage),
//      so the database rows go with it.
//
// Body: { confirm: "<username>" }  →  { deleted: true }
// The username must be typed back, so a stray or scripted call with a
// stolen session can't wipe an account by accident. Admin accounts can't be
// deleted here: removing the last admin would lock everyone out of admin
// tools; an admin first hands the role over (or it's done in the database).

const PAGE = 1000;
const REMOVE_BATCH = 500;

// deno-lint-ignore no-explicit-any
async function listAll(storage: any, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    for (const item of data || []) {
      const path = `${prefix}/${item.name}`;
      // Folders come back without an id: walk into them.
      if (item.id) files.push(path);
      else files.push(...await listAll(storage, bucket, path));
    }
    if (!data || data.length < PAGE) return files;
  }
}

// deno-lint-ignore no-explicit-any
async function removeFolder(storage: any, bucket: string, userId: string): Promise<number> {
  const files = await listAll(storage, bucket, userId);
  for (let i = 0; i < files.length; i += REMOVE_BATCH) {
    const { error } = await storage.from(bucket).remove(files.slice(i, i + REMOVE_BATCH));
    if (error) throw error;
  }
  return files.length;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const admin = ctx.supabaseAdmin;

      const body = await req.json().catch(() => ({}));
      const confirm = typeof body?.confirm === 'string' ? body.confirm.trim().replace(/^@/, '').toLowerCase() : '';
      const { data: profile, error: profileError } = await admin.from('profiles')
        .select('username').eq('id', userId).maybeSingle();
      if (profileError) throw profileError;
      // An account still in onboarding has no username: it confirms with "delete".
      const expected = (profile?.username || 'delete').toLowerCase();
      if (!confirm || confirm !== expected) {
        return Response.json({ error: 'Confirmation does not match' }, { status: 400 });
      }
      if (await isAdmin(admin, userId)) {
        return Response.json({ error: 'Admin accounts cannot be deleted here' }, { status: 403 });
      }

      // Files first: if this fails, the account still exists and the user can
      // try again, instead of being left with files nobody can reach.
      const drafts = await removeFolder(admin.storage, DRAFTS_BUCKET, userId);
      const publicFiles = await removeFolder(admin.storage, PUBLIC_BUCKET, userId);

      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;

      console.log(`[deleteAccount] deleted user=${userId} files=${drafts + publicFiles}`);
      return Response.json({ deleted: true }, { status: 200 });
    } catch (error) {
      console.log(`[deleteAccount] error: ${(error as Error)?.message || error}`);
      return Response.json({ error: 'Internal error' }, { status: 500 });
    }
  }),
};
