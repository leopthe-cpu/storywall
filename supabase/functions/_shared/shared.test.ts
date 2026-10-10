// Unit tests for the shared helpers: `deno test supabase/functions/_shared`.
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert@1';
import { isAllowedUsername, normalizeUsername } from './username.ts';
import { getClientIP, isRateLimited } from './rateLimit.ts';
import { collectDraftRefs, draftPath, isOwnDraft, replaceRefs } from './media.ts';

const UID = '00000000-0000-0000-0000-00000000000a';

Deno.test('usernames: same rules as the app', () => {
  assertEquals(normalizeUsername('  Leo '), 'leo');
  assert(isAllowedUsername('leopteh'));
  assert(isAllowedUsername('a_b-c'));
  assertFalse(isAllowedUsername('ab'), 'too short');
  assertFalse(isAllowedUsername('a'.repeat(31)), 'too long');
  assertFalse(isAllowedUsername('-abc'), 'leading hyphen');
  assertFalse(isAllowedUsername('abc-'), 'trailing hyphen');
  assertFalse(isAllowedUsername('Leo'), 'uppercase must be normalised first');
  assertFalse(isAllowedUsername('admin'), 'reserved');
  assertFalse(isAllowedUsername('a b'), 'space');
});

Deno.test('rate limit: 20 per minute per IP, then refused until the window passes', () => {
  const ip = `test-${crypto.randomUUID()}`;
  for (let i = 0; i < 20; i++) assertFalse(isRateLimited(ip, 20, 60_000, 1_000 + i));
  assert(isRateLimited(ip, 20, 60_000, 1_100));
  assertFalse(isRateLimited(ip, 20, 60_000, 70_000), 'window passed');
});

Deno.test('client IP: x-real-ip, else the last x-forwarded-for hop', () => {
  assertEquals(getClientIP(new Request('http://x', { headers: { 'x-real-ip': '1.1.1.1' } })), '1.1.1.1');
  assertEquals(
    getClientIP(new Request('http://x', { headers: { 'x-forwarded-for': '9.9.9.9, 2.2.2.2' } })),
    '2.2.2.2',
  );
  assertEquals(getClientIP(new Request('http://x')), 'unknown');
});

Deno.test('draft file references: own folder only, no path tricks', () => {
  assertEquals(draftPath(`drafts/${UID}/a.png`), `${UID}/a.png`);
  assertEquals(draftPath('https://x/a.png'), null);
  assertEquals(draftPath('public-media/a.png'), null);
  assertEquals(draftPath(`drafts/${UID}/../other/a.png`), null);
  assertEquals(draftPath('drafts//a.png'), null);
  assert(isOwnDraft(`drafts/${UID}/a.png`, UID));
  assertFalse(isOwnDraft('drafts/00000000-0000-0000-0000-00000000000b/a.png', UID));
  assertFalse(isOwnDraft(`drafts/${UID}x/a.png`, UID), 'prefix of another id');
});

Deno.test('cards: collect draft media and swap in public URLs, leave the rest', () => {
  const cards = [
    { elements: [
      { type: 'image', image_url: `drafts/${UID}/a.png` },
      { type: 'text', content: 'hi', image_url: `drafts/${UID}/not-media.png` },
      { type: 'audio', image_url: `drafts/${UID}/a.webm` },
    ] },
    { elements: [{ type: 'image', image_url: 'https://cdn/x.png' }, { type: 'video', image_url: `drafts/${UID}/a.png` }] },
  ];
  assertEquals(collectDraftRefs(cards).sort(), [`drafts/${UID}/a.png`, `drafts/${UID}/a.webm`]);
  const out = replaceRefs(cards, { [`drafts/${UID}/a.png`]: 'https://pub/a.png' });
  assertEquals(out[0].elements![0].image_url, 'https://pub/a.png');
  assertEquals(out[0].elements![1].image_url, `drafts/${UID}/not-media.png`);
  assertEquals(out[1].elements![1].image_url, 'https://pub/a.png');
  assertEquals(out[1].elements![0].image_url, 'https://cdn/x.png');
});
