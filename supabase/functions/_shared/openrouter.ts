// OpenRouter calls shared by the AI functions (decision 20: all AI goes
// through Oz's OpenRouter account). The key is the OPENROUTER_API_KEY Edge
// Function secret, set in the Supabase dashboard, never in code.
// Request shapes follow OpenRouter's docs (checked Oct 2026):
//   - chat:   POST /api/v1/chat/completions, response_format json_schema
//   - images: POST /api/v1/images, data[].b64_json + media_type
// Every response reports its own cost (usage.cost, USD), which is logged so
// model choices can be compared on real numbers.

const BASE_URL = 'https://openrouter.ai/api/v1';

// Which model does what. Each can be switched with an Edge Function secret
// of the same name, without a code change; these defaults are only the
// starting point until Oz picks models from the side-by-side test.
export const MODELS = {
  structure: () => Deno.env.get('STRUCTURE_MODEL') || 'anthropic/claude-haiku-5.5',
  skills: () => Deno.env.get('SKILLS_MODEL') || 'anthropic/claude-haiku-5.5',
  // Base44 generated pictures with Qwen-Image-3.0; same family by default.
  image: () => Deno.env.get('IMAGE_MODEL') || 'qwen/qwen-image-3',
};

export class OpenRouterError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function apiKey(): string {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) throw new OpenRouterError('OPENROUTER_API_KEY is not set', 500);
  return key;
}

async function post(path: string, body: unknown, timeoutMs: number) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey()}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // OpenRouter errors carry { error: { message, code } }; log the message,
    // never the request (it contains the user's story).
    throw new OpenRouterError(data?.error?.message || `OpenRouter HTTP ${res.status}`, res.status);
  }
  return data;
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

// Pulls the JSON value out of a model's text answer. Structured outputs
// should already be pure JSON, but not every provider enforces the schema
// strictly, so code fences and stray text around it are tolerated.
export function parseJsonContent(content: unknown): unknown {
  if (typeof content !== 'string' || !content.trim()) return null;
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    const obj = text.match(/[[{][\s\S]*[\]}]/);
    if (!obj) return null;
    try {
      return JSON.parse(obj[0]);
    } catch {
      return null;
    }
  }
}

// One chat call that must answer with JSON matching `schema`.
export async function chatJson(opts: {
  model: string;
  name: string;
  schema: Record<string, unknown>;
  system?: string;
  user: string | ContentPart[];
  temperature?: number;
  timeoutMs?: number;
}): Promise<{ data: unknown; cost: number | null; model: string }> {
  const messages = [
    ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
    { role: 'user', content: opts.user },
  ];
  const res = await post('/chat/completions', {
    model: opts.model,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: { name: opts.name, strict: true, schema: opts.schema },
    },
    // Only route to providers that honour response_format for this model.
    provider: { require_parameters: true },
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  }, opts.timeoutMs ?? 90_000);
  return {
    data: parseJsonContent(res?.choices?.[0]?.message?.content),
    cost: typeof res?.usage?.cost === 'number' ? res.usage.cost : null,
    model: res?.model || opts.model,
  };
}

// One chat call with a free-text answer (for prompts that describe their own
// output format, like the skill tags prompt).
export async function chatText(opts: {
  model: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ content: string; cost: number | null }> {
  const res = await post('/chat/completions', {
    model: opts.model,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    ...(opts.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {}),
  }, opts.timeoutMs ?? 30_000);
  const content = res?.choices?.[0]?.message?.content;
  return {
    content: typeof content === 'string' ? content : '',
    cost: typeof res?.usage?.cost === 'number' ? res.usage.cost : null,
  };
}

// One picture. Returns the raw bytes; the caller stores them.
export async function generateImageBytes(opts: {
  model: string;
  prompt: string;
  aspectRatio?: string;
  referenceUrls?: string[];
  timeoutMs?: number;
}): Promise<{ bytes: Uint8Array; mediaType: string; cost: number | null }> {
  const res = await post('/images', {
    model: opts.model,
    prompt: opts.prompt,
    n: 1,
    ...(opts.aspectRatio ? { aspect_ratio: opts.aspectRatio } : {}),
    ...(opts.referenceUrls?.length
      ? { input_references: opts.referenceUrls.map((url) => ({ type: 'image_url', image_url: { url } })) }
      : {}),
  }, opts.timeoutMs ?? 120_000);
  const image = res?.data?.[0];
  if (!image?.b64_json) throw new OpenRouterError('No image returned', 502);
  return {
    bytes: Uint8Array.from(atob(image.b64_json), (c) => c.charCodeAt(0)),
    mediaType: image.media_type || 'image/png',
    cost: typeof res?.usage?.cost === 'number' ? res.usage.cost : null,
  };
}
