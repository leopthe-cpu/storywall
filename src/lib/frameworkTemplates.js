import { buildAICards } from '@/lib/aiStyleTemplates';

// Framework templates (roadmap A4, Oz 2026-10-16): one ready-made story per
// story framework (STAR, RICE, …). Each is a short made-up story that shows
// the framework's beats; the user replaces the text and the picture
// placeholders with their own.
//
// They're written in the same shape the structuring AI returns
// ({ text: header, subtitle: body, picture }) and laid out by buildAICards, so
// templates get exactly the same layout as generated stories: per-card text
// sizes, the style's fonts, the colour variation across cards, and the card
// lab's checks.

// Same-origin file (public/templates/), so card export can read it. The link
// must be a full https address: the builder treats any other link as a
// private draft file and asks the server to sign it.
const placeholderUrl = () =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}/templates/photo-placeholder.svg`;

export const FRAMEWORK_TEMPLATES = [
  {
    id: 'framework-star',
    name: 'STAR: Situation, Task, Action, Result',
    framework: 'STAR',
    style: 'poster',
    cards: [
      { text: 'Why new users quit in week one' },
      {
        text: 'The situation',
        subtitle: 'Half of our new sign-ups stopped using the app within seven days. Nobody knew why.',
        picture: true,
      },
      {
        text: 'My task',
        subtitle: 'Find out what was driving people away and fix it within one quarter, with no extra budget.',
      },
      {
        text: 'What I did',
        subtitle: 'I watched twenty new users try the app. Most got stuck on the same setup screen, so we cut it from five steps to two.',
      },
      { text: 'Week-one retention: 48% → 71%.' },
      {
        text: 'What I learned',
        subtitle: 'An afternoon with real users beat a month of dashboards.',
        picture: true,
      },
    ],
  },
];

export const isFrameworkTemplate = (template) => FRAMEWORK_TEMPLATES.some((t) => t.id === template?.id);

// Lays a template out. Returns { cards, tokens } like a generated story.
// Cached per template, since the picker previews and the apply step both
// need it (callers must not mutate the result).
const built = new Map();
export function buildFrameworkTemplate(template) {
  if (!built.has(template.id)) {
    const structured = template.cards.map((c) => ({
      text: c.text || '',
      subtitle: c.subtitle || '',
      needsImage: !!c.picture,
      ...(c.picture ? { imageUrl: placeholderUrl(), imageType: 'image' } : {}),
    }));
    const promise = buildAICards(structured, template.style);
    // A failed build (e.g. a font didn't load) is retried next time.
    promise.catch(() => built.delete(template.id));
    built.set(template.id, promise);
  }
  return built.get(template.id);
}

// A fresh copy for a new story: new card and element ids each time, so two
// stories made from the same template never share ids.
export async function frameworkTemplateForStory(template) {
  const { cards, tokens } = await buildFrameworkTemplate(template);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    cards: cards.map((card, i) => {
      const id = `tpl-${template.id}-${i}-${suffix}`;
      const elements = card.elements.map((el) => ({ ...el, id: el.id.replace(card.id, id) }));
      return {
        ...card,
        id,
        elements,
        backgroundImageId: card.backgroundImageId ? card.backgroundImageId.replace(card.id, id) : undefined,
      };
    }),
    tokens: tokens.map((t) => ({ ...t })),
  };
}
