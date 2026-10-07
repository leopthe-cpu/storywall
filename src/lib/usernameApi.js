import { base44 } from '@/api/base44Client';

// Save the signed-in user's username through the setUsername backend
// function, which enforces format, reserved names and uniqueness server-side
// and records the claim that public profiles resolve through. Never write
// `username` with auth.updateMe — a self-written name isn't served.
export async function saveUsername(username) {
  try {
    const res = await base44.functions.invoke('setUsername', { username });
    if (res?.data?.error) throw new Error(res.data.error);
    return res?.data?.username;
  } catch (e) {
    // Non-2xx responses throw; surface the server's message when present.
    const msg = e?.response?.data?.error || e?.message;
    throw new Error(msg || 'Failed to save username. Please try again.');
  }
}
