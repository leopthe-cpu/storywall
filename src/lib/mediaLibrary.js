import { base44 } from '@/api/base44Client';

// Add a file to the signed-in user's media library. Media records are
// created only by the registerMedia backend function (the entity is not
// writable from the browser) — see base44/functions/registerMedia/entry.ts.
// Throws on failure; callers treat the library save as best-effort.
export async function registerMedia({ image_url, media_type = 'image', duration = 0 }) {
  const res = await base44.functions.invoke('registerMedia', { image_url, media_type, duration });
  if (res?.data?.error) throw new Error(res.data.error);
  return res?.data?.media;
}
