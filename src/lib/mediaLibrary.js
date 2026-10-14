import { invokeFunction } from '@/api/storywallApi';

// Add a file to the signed-in user's media library. Media records are
// created only by the registerMedia server function (the table is not
// writable from the browser) — see supabase/functions/registerMedia.
// Throws on failure; callers treat the library save as best-effort.
export async function registerMedia({ image_url, media_type = 'image', duration = 0 }) {
  const res = await invokeFunction('registerMedia', { image_url, media_type, duration });
  if (res?.data?.error) throw new Error(res.data.error);
  return res?.data?.media;
}
