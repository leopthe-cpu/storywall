// Server-side premium check: the only place premium access is decided
// (port of base44/shared/premium.ts). Admins are always premium; everyone
// else needs a premium_grants row, which only admins can create. Every
// premium function must call this; the app hides the Generate UI too, but
// that is cosmetic only.
//
// Uses the admin client so the answer can't depend on the caller's own
// access rules.

// deno-lint-ignore no-explicit-any
export async function hasPremium(admin: any, userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const [adminRow, grantRow] = await Promise.all([
    admin.from('admins').select('user_id').eq('user_id', userId).maybeSingle(),
    admin.from('premium_grants').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  if (adminRow.error) throw adminRow.error;
  if (grantRow.error) throw grantRow.error;
  return !!adminRow.data || !!grantRow.data;
}

// deno-lint-ignore no-explicit-any
export async function isAdmin(admin: any, userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await admin.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return !!data;
}

// Admins may try another OpenRouter model for one call (model comparison,
// admin Prompt Test page); everyone else always gets the configured model.
// deno-lint-ignore no-explicit-any
export async function pickModel(admin: any, userId: string, requested: unknown, fallback: string): Promise<string> {
  if (typeof requested !== 'string' || !/^[\w.~:/-]{3,100}$/.test(requested)) return fallback;
  return (await isAdmin(admin, userId)) ? requested : fallback;
}
