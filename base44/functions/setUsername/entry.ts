import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  normalizeUsername, isAllowedUsername, getUsernameClaim, claimUsernameIfUnclaimed,
} from '../../shared/username.ts';

// Sets the caller's username, enforcing the rules server-side: format,
// reserved words, and uniqueness. Writes a UsernameClaim (server-only entity)
// and mirrors the name onto the User record. Public profiles resolve names
// through the claim, so a username written straight to the User record
// (auth.updateMe bypassing this function) is never served.
//
// Body: { username }   Returns: { username } | { error } with 400/409.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const username = normalizeUsername(body?.username);
    if (!isAllowedUsername(username)) {
      return Response.json({ error: 'That username isn’t allowed.' }, { status: 400 });
    }

    // Resolve legacy (claim-less) holders first so a name an existing account
    // already uses is treated as taken.
    await claimUsernameIfUnclaimed(base44, username);
    const claim = await getUsernameClaim(base44, username);
    if (claim && claim.user_id !== user.id) {
      return Response.json({ error: 'That username is taken.' }, { status: 409 });
    }

    if (!claim) {
      await base44.asServiceRole.entities.UsernameClaim.create({ username, user_id: user.id });
    }

    // Release the caller's previous names so they become available again.
    const mine = await base44.asServiceRole.entities.UsernameClaim.filter({ user_id: user.id });
    for (const c of mine) {
      if (c.username !== username) await base44.asServiceRole.entities.UsernameClaim.delete(c.id);
    }

    await base44.asServiceRole.entities.User.update(user.id, { username });
    return Response.json({ username }, { status: 200 });
  } catch (error) {
    console.log(`[setUsername] error: ${(error as Error)?.message || error}`);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
