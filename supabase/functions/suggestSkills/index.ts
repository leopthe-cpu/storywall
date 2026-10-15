import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { chatText, MODELS } from '../_shared/openrouter.ts';
import { buildSystemPrompt, extractJsonArray, matchKeywordSkills } from './rules.ts';

// Suggests skill tags for a story at publish time. Port of
// base44/functions/suggestSkills: keyword fast-path first (no AI call when
// the story names its skills), then the AI for whatever is still missing,
// now on OpenRouter instead of Z.ai. Any signed-in user (not premium-only,
// as before). Always answers 200 with { tags } and error: true only when
// nothing usable came back, so the app can show its retry state.
// Body: { text, tag_count?, already_selected_tags? }  →  { tags, error? }

const TIMEOUT_MS = 20_000;
const MAX_TEXT = 20_000;

export default {
  fetch: withSupabase({ auth: 'user' }, async (req) => {
    const started = Date.now();
    try {
      const body = await req.json().catch(() => ({}));
      const text = typeof body?.text === 'string' ? body.text.slice(0, MAX_TEXT) : '';
      if (!text.trim()) return Response.json({ tags: [] }, { status: 200 });

      const tagCount = Math.max(1, Math.min(10, parseInt(body?.tag_count, 10) || 5));
      const alreadySelected: string[] = Array.isArray(body?.already_selected_tags)
        ? body.already_selected_tags
          .filter((t: unknown) => typeof t === 'string' && t.trim())
          .map((t: string) => t.trim())
          .slice(0, 50)
        : [];

      const excludeLower = new Set(alreadySelected.map((t) => t.toLowerCase()));
      const keywordTags = matchKeywordSkills(text, tagCount, excludeLower);
      if (keywordTags.length >= tagCount) {
        console.log(`[suggestSkills] keyword fast-path ${keywordTags.length}/${tagCount}, no AI call`);
        return Response.json({ tags: keywordTags }, { status: 200 });
      }

      // Ask the AI only for what the keywords didn't cover, and tell it about
      // the keyword matches so it doesn't repeat them.
      const model = MODELS.skills();
      let rawContent = '';
      try {
        const res = await chatText({
          model,
          system: buildSystemPrompt(tagCount - keywordTags.length, [...alreadySelected, ...keywordTags]),
          user: text,
          temperature: 0.4,
          maxTokens: 500,
          timeoutMs: TIMEOUT_MS,
        });
        rawContent = res.content;
        console.log(`[suggestSkills] model=${model} cost=$${res.cost?.toFixed(5) ?? '?'}`);
      } catch (e) {
        // An AI failure still returns whatever the keywords found.
        console.log(`[suggestSkills] AI call failed: ${(e as Error)?.name}: ${(e as Error)?.message}`);
      }

      const seen = new Set<string>();
      const tags: string[] = [];
      for (const t of [...keywordTags, ...extractJsonArray(rawContent)]) {
        const key = t.toLowerCase();
        if (seen.has(key) || excludeLower.has(key)) continue;
        seen.add(key);
        tags.push(t);
        if (tags.length >= tagCount) break;
      }
      console.log(`[suggestSkills] keyword=${keywordTags.length} total=${tags.length} duration=${Date.now() - started}ms`);
      const hasError = tags.length === 0 && rawContent === '';
      return Response.json({ tags, ...(hasError ? { error: true } : {}) }, { status: 200 });
    } catch (error) {
      console.log(`[suggestSkills] error: ${(error as Error)?.message || error}`);
      return Response.json({ tags: [], error: true }, { status: 200 });
    }
  }),
};
