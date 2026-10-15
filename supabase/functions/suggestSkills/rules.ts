// Skill tagging rules, copied word for word from
// base44/functions/suggestSkills/entry.ts (prompt, keyword fast-path and
// answer parsing), so tags come out the same as before. Only `export` was
// added. Change them only on purpose, in their own commit.

export const SYSTEM_PROMPT_TEMPLATE = `You are a skill-tagging assistant for StoryWall, a career storytelling platform.

You will receive the plain text content from a single story card carousel — a person's account of a project, role, or experience. Your job is to infer {{tag_count}} professional skill or competency tags that this story demonstrates.

{{#if already_selected_tags}}
The user has already selected these tags, which are staying on their story — do not suggest these again or suggest close near-duplicates of them:
{{already_selected_tags}}
{{/if}}

Rules:
- Infer skills semantically. Do not just extract nouns that literally appear in the text — identify the underlying competencies the story demonstrates (e.g. a story about negotiating a vendor contract under a tight deadline demonstrates "Negotiation" and "Stakeholder Management", even if neither word appears).
- Each tag is 1-3 words, Title Case, no hashtags, no punctuation.
- Tags must be genuinely distinct from each other, and distinct from any already-selected tags listed above. Do not include near-duplicates (e.g. do not return both "UX Design" and "User Experience Design").
- Prefer tags a recruiter or collaborator would recognize and search for. Avoid vague tags like "Hard Work" or "Passion" — they are not verifiable skills.
- Always return exactly {{tag_count}} tags — never fewer. If the text is short or thin, infer more broadly from context, tone, and implied competencies (not just explicit statements) to reach the count. Even so, never pad with weak, generic, or unverifiable tags just to hit the number — every tag, including ones inferred from thin material, must still be a specific, recruiter-recognizable skill.
- Output ONLY a valid JSON array of strings. No preamble, no explanation, no markdown code fences, no trailing commentary, no reasoning text before or after the array.
  Example shape (not real output):
  ["Product Strategy", "Cross-functional Leadership", "Data Analysis"]`;

export function buildSystemPrompt(tagCount: number, alreadySelectedTags: string[]): string {
  let prompt = SYSTEM_PROMPT_TEMPLATE;

  // Handle {{#if already_selected_tags}}...{{/if}} conditional block
  const blockRegex = /\{\{#if already_selected_tags\}\}\n?([\s\S]*?)\n?\{\{\/if\}\}/;
  if (alreadySelectedTags.length > 0) {
    prompt = prompt.replace(blockRegex, (_match, content) => {
      return content.replace(/\{\{already_selected_tags\}\}/g, alreadySelectedTags.join(", "));
    });
  } else {
    prompt = prompt.replace(blockRegex, "");
  }

  // Collapse multiple blank lines left by removed block
  prompt = prompt.replace(/\n{3,}/g, "\n\n");

  // Replace {{tag_count}}
  prompt = prompt.replace(/\{\{tag_count\}\}/g, String(tagCount));

  return prompt.trim();
}

// Keyword fast-path — checked before ever calling the external AI. Each
// canonical skill tag lists a few distinctive trigger phrases/stems; if the
// story text contains one, that skill is considered matched with no network
// call at all. This does two things: (1) speeds up the common case where a
// story states its skills fairly directly (most publishes never touch the
// AI call), and (2) means an AI outage/timeout no longer has to mean zero
// tags — whatever keyword matches were found still come back.
// To extend: add a new "Skill Name": ["phrase one", "stem2"] entry. Keep
// triggers as multi-word phrases or distinctive word stems (e.g. "negotiat"
// rather than "led") to avoid false-positive substring matches.
export const SKILL_KEYWORDS: Record<string, string[]> = {
  "Product Strategy": ["product strategy", "product roadmap", "product vision", "prioritiz"],
  "Project Management": ["project management", "project manager", "gantt chart", "project timeline", "project plan"],
  "Negotiation": ["negotiat"],
  "Stakeholder Management": ["stakeholder"],
  "Leadership": ["led a team", "led the team", "team lead", "leadership", "managed a team", "managing a team"],
  "Cross-functional Leadership": ["cross-functional", "cross functional"],
  "Public Speaking": ["public speaking", "keynote", "presented at", "conference talk"],
  "Data Analysis": ["data analysis", "analyzed data", "sql quer", "data-driven", "data driven"],
  "UX Design": ["ux design", "user experience design", "wireframe", "usability test"],
  "UI Design": ["ui design", "user interface design", "figma"],
  "Software Engineering": ["software engineer", "wrote code", "shipped code", "codebase"],
  "Frontend Development": ["frontend", "front-end", "front end development"],
  "Backend Development": ["backend", "back-end", "api development", "database schema"],
  "Machine Learning": ["machine learning", "ml model", "trained a model", "neural network"],
  "Marketing Strategy": ["marketing strategy", "go-to-market", "go to market", "campaign strategy"],
  "Content Strategy": ["content strategy", "editorial calendar", "content calendar"],
  "Sales": ["closed a deal", "closed the deal", "sales quota", "hit quota", "hit their quota", "exceeded quota", "exceeded target", "sales pipeline", "cold outreach", "account executive"],
  "Customer Success": ["customer success", "customer retention", "reduced churn", "customer churn"],
  "Fundraising": ["raised funding", "seed round", "series a", "pitch deck", "raised capital"],
  "Budget Management": ["budget management", "cost savings", "financial planning"],
  "Hiring": ["hired the team", "recruiting", "interview process", "built the team"],
  "Mentorship": ["mentor"],
  "Public Relations": ["press release", "media coverage", "pr strategy"],
  "Brand Strategy": ["brand strategy", "brand identity", "rebrand"],
  "Operations": ["operations", "process improvement", "streamlined"],
  "Supply Chain Management": ["supply chain", "logistics", "inventory management"],
  "Event Planning": ["event planning", "organized an event", "conference planning"],
  "Copywriting": ["copywriting", "wrote copy", "ad copy"],
  "Video Production": ["video production", "filmed and edited", "edited a video"],
  "Graphic Design": ["graphic design", "illustrator", "photoshop"],
  "Photography": ["photography", "photo shoot"],
  "Legal Compliance": ["legal compliance", "regulatory review", "legal review"],
  "Risk Management": ["risk management", "risk assessment", "mitigat"],
  "Quality Assurance": ["quality assurance", "qa testing", "test coverage"],
  "DevOps": ["devops", "ci/cd", "deployment pipeline"],
  "Cloud Infrastructure": ["cloud infrastructure", "kubernetes", "aws infrastructure"],
  "Cybersecurity": ["cybersecurity", "security audit", "penetration test"],
  "Community Building": ["community building", "grew the community", "community management"],
  "Partnerships": ["strategic partnership", "strategic alliance", "co-marketing"],
  "Change Management": ["change management", "organizational change"],
  "Coaching": ["coached", "coaching"],
  "Research": ["conducted research", "user research", "market research"],
  "Writing": ["wrote a book", "published an article", "ghostwrit"],
  "Translation": ["translat"],
  "Teaching": ["taught a class", "curriculum design", "lesson plan"],
  "Nonprofit Management": ["nonprofit", "non-profit", "grant writing"],
};

// Case-insensitive substring match against the trigger list. Returns up to
// `count` matched skill tags, in SKILL_KEYWORDS's own order, skipping any
// already covered by `excludeLower` (already-selected tags).
export function matchKeywordSkills(text: string, count: number, excludeLower: Set<string>): string[] {
  const lower = text.toLowerCase();
  const matches: string[] = [];
  for (const [skill, keywords] of Object.entries(SKILL_KEYWORDS)) {
    if (matches.length >= count) break;
    if (excludeLower.has(skill.toLowerCase())) continue;
    if (keywords.some((kw) => lower.includes(kw))) {
      matches.push(skill);
    }
  }
  return matches;
}

// Robust JSON array extraction — handles code fences, thinking text, and
// other non-JSON preamble that the model might prepend to the actual output.
export function extractJsonArray(content: string): string[] {
  if (!content) return [];

  let cleaned = content.trim();

  // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Try direct parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((t: unknown) => typeof t === "string")
        .map((t: string) => t.trim())
        .filter(Boolean);
    }
  } catch {}

  // Try to find a JSON array anywhere in the content (handles thinking text
  // or other preamble before/around the actual JSON output)
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((t: unknown) => typeof t === "string")
          .map((t: string) => t.trim())
          .filter(Boolean);
      }
    } catch {}
  }

  return [];
}
