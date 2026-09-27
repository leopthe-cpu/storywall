// Server-side premium check — the ONLY place premium access is decided.
//
// Premium is stored in the PremiumGrant entity, deliberately kept separate
// from user-editable profile data. PremiumGrant rows can only be
// created/edited/deleted by admins (see base44/entities/PremiumGrant.jsonc).
// Admins are always premium. Never add an access flag to the User entity.
//
// The client also reads PremiumGrant to show/hide the Generate UI, but that
// is cosmetic only — every premium backend function must call this.
//
// Usage:
//   if (!(await hasPremium(base44, user))) {
//     return Response.json({ error: 'Premium required' }, { status: 403 });
//   }

// deno-lint-ignore no-explicit-any
export async function hasPremium(base44: any, user: { id?: string; role?: string } | null): Promise<boolean> {
  if (!user?.id) return false;
  if (user.role === 'admin') return true;
  // Service role: the lookup must not depend on the caller's own permissions.
  const grants = await base44.asServiceRole.entities.PremiumGrant.filter({ user_id: user.id });
  return Array.isArray(grants) && grants.length > 0;
}
