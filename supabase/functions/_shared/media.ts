// Where uploaded files live (see supabase/migrations/20261010170000_storage.sql).
// A private file is referenced as "drafts/<user id>/<file>"; anything that
// starts with http(s):// is a public URL.

export const DRAFTS_BUCKET = 'drafts';
export const PUBLIC_BUCKET = 'public-media';
export const MEDIA_TYPES = ['image', 'video', 'audio'] as const;

export const isPublicUrl = (v: unknown): v is string =>
  typeof v === 'string' && /^https?:\/\//i.test(v);

// "drafts/<uid>/a/b.png" → "<uid>/a/b.png" (the path inside the bucket), or
// null if it isn't a draft file reference.
export function draftPath(ref: unknown): string | null {
  if (typeof ref !== 'string') return null;
  const prefix = `${DRAFTS_BUCKET}/`;
  if (!ref.startsWith(prefix)) return null;
  const path = ref.slice(prefix.length);
  if (!path || path.includes('..') || path.startsWith('/')) return null;
  return path;
}

// True when a draft file reference is inside the given user's own folder.
export function isOwnDraft(ref: unknown, userId: string): boolean {
  const path = draftPath(ref);
  return !!path && path.startsWith(`${userId}/`);
}

// Media elements on a story's cards carry their file in `image_url` (for
// images, video and audio alike, as in Base44).
type Element = { type?: string; image_url?: unknown; [k: string]: unknown };
type Card = { elements?: Element[]; [k: string]: unknown };

export function isMediaElement(el: Element): boolean {
  return el.type === 'image' || el.type === 'video' || el.type === 'audio';
}

export function collectDraftRefs(cards: Card[]): string[] {
  const refs = new Set<string>();
  for (const card of cards) {
    for (const el of card?.elements || []) {
      if (isMediaElement(el) && draftPath(el.image_url)) refs.add(el.image_url as string);
    }
  }
  return [...refs];
}

export function replaceRefs(cards: Card[], map: Record<string, string>): Card[] {
  return cards.map((card) => ({
    ...card,
    elements: (card.elements || []).map((el) =>
      isMediaElement(el) && typeof el.image_url === 'string' && map[el.image_url]
        ? { ...el, image_url: map[el.image_url] }
        : el
    ),
  }));
}
