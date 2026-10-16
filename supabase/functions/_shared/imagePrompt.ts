// No-people rule for AI picture prompts, on the server (moved from the
// browser pipeline, src/lib/generatePipeline.js, for Generate jobs). The
// structuring prompt already forbids people; this is the backstop: sentences
// that describe a face or a person are removed, and a prompt that can't be
// cleaned gets no picture at all (the old fixed fallback scene put the same
// unrelated picture on every story).
//
// Differs from the browser version on purpose: that one appended "No visible
// face, no person visible…" and then re-checked the result, which matched
// its own "face" and "person" and so dropped every cleaned prompt. Here the
// added line doesn't mention people at all, so the prompt never names them.

const FACE_KEYWORDS =
  /\b(face|faces|eye|eyes|smiling|smile|looking|looked|portrait|person|people|man|woman|boy|girl|character|expression|gaze|stare)\b/i;

// Returns the prompt to send, or null when the card should get no picture.
export function cleanImagePrompt(prompt: unknown): string | null {
  if (typeof prompt !== 'string' || !prompt.trim()) return null;
  if (!FACE_KEYWORDS.test(prompt)) return prompt.trim();
  const kept = prompt.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s && !FACE_KEYWORDS.test(s));
  const base = kept.join('. ');
  if (base.length < 10) return null;
  return `${base}. Objects, places and details only.`;
}
