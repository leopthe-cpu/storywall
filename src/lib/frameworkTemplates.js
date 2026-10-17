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
  {
    id: 'framework-rice',
    name: 'RICE: Reach, Impact, Confidence, Effort',
    framework: 'RICE',
    style: 'field-notes',
    cards: [
      { text: 'How we picked one feature out of forty' },
      {
        text: 'Forty ideas, one team',
        subtitle: 'Our backlog had forty feature requests and every team was sure theirs came first. We could build two that quarter.',
      },
      { text: 'Reach', subtitle: 'How many users would it touch each month? Search improvements: 12,000. Dark mode: 3,000.' },
      { text: 'Impact', subtitle: 'How much would it move the goal for each of them? We scored it from 0.25 for minimal to 3 for massive.' },
      { text: 'Confidence and effort', subtitle: 'How sure were we of those numbers, and how many weeks would it take? Guesses lost points.' },
      { text: 'Search won, by a lot.' },
      {
        text: 'What changed',
        subtitle: 'Roadmap meetings stopped being fights. People debated the scores, not each other.',
        picture: true,
      },
    ],
  },
  {
    id: 'framework-before-after-bridge',
    name: 'Before → After → Bridge',
    framework: 'Before→After→Bridge',
    style: 'condensed',
    cards: [
      { text: 'From four-hour reports to four minutes' },
      {
        text: 'Before',
        subtitle: 'Every Monday I spent four hours copying numbers from five tools into one slide deck.',
        picture: true,
      },
      { text: 'After', subtitle: 'Now the report builds itself overnight and lands in everyone’s inbox at 8 am.' },
      {
        text: 'The bridge',
        subtitle: 'I learned enough SQL to connect the five tools to one dashboard, then automated the email. It took three weekends.',
      },
      { text: 'Four hours back, every week.' },
      { text: 'Why it mattered', subtitle: 'Those hours went into talking to customers, which is where our next two features came from.' },
    ],
  },
  {
    id: 'framework-problem-solution-impact',
    name: 'Problem → Solution → Impact',
    framework: 'Problem→Solution→Impact',
    style: 'poster',
    cards: [
      { text: 'The checkout that lost us one sale in five' },
      {
        text: 'The problem',
        subtitle: 'One in five shoppers left at the payment step. Most of them were on phones.',
        picture: true,
      },
      {
        text: 'The solution',
        subtitle: 'We cut the form from eleven fields to four and added the phone’s built-in wallet as the first option.',
      },
      { text: 'Abandoned checkouts: 21% → 9%.' },
      { text: 'The impact', subtitle: 'That was worth about $40k a month, from a change that took two sprints.' },
    ],
  },
  {
    id: 'framework-turning-point',
    name: 'Turning Point',
    framework: 'Turning Point',
    style: 'field-notes',
    cards: [
      { text: 'The day I stopped saying yes to everything' },
      { text: 'Where I was', subtitle: 'Six projects, no focus. I was busy all day and proud of it, but nothing was getting finished.' },
      {
        text: 'The moment',
        subtitle: 'My manager asked which project I would keep if I could only keep one. I couldn’t answer.',
        picture: true,
      },
      { text: 'I said no to four of them.' },
      { text: 'What happened next', subtitle: 'The two I kept shipped within a month. One became the team’s biggest launch of the year.' },
      { text: 'What I learned', subtitle: 'Saying no isn’t letting people down. It’s choosing what gets done well.' },
    ],
  },
  {
    id: 'framework-origin-story',
    name: 'Origin Story',
    framework: 'Origin Story',
    style: 'condensed',
    cards: [
      { text: 'How a spreadsheet became my career' },
      {
        text: 'It started small',
        subtitle: 'I built a spreadsheet to track my running club’s race times. Twelve people used it.',
        picture: true,
      },
      { text: 'Then it grew', subtitle: 'Other clubs asked for a copy. Within a year, four hundred runners were using it every week.' },
      {
        text: 'The leap',
        subtitle: 'I taught myself to code so I could turn it into an app. That project got me my first developer job.',
      },
      { text: 'Every big thing started as a small fix.' },
      { text: 'Why I tell this story', subtitle: 'It’s still how I work: find a small problem people care about and make it better.' },
    ],
  },
  {
    id: 'framework-failure-lesson-comeback',
    name: 'Failure → Lesson → Comeback',
    framework: 'Failure→Lesson→Comeback',
    style: 'poster',
    cards: [
      { text: 'The launch that flopped' },
      {
        text: 'The failure',
        subtitle: 'We spent six months on a feature for teams. On launch day, nine people tried it.',
        picture: true,
      },
      { text: 'The lesson', subtitle: 'We had built what we assumed teams wanted. We never asked a single one before we started.' },
      { text: 'The comeback', subtitle: 'Next time we interviewed thirty teams first and shipped a small version in three weeks.' },
      { text: '900 teams in the first month.' },
      { text: 'What I do now', subtitle: 'No project starts until I’ve spoken to five people who would use it.' },
    ],
  },
  {
    id: 'framework-by-the-numbers',
    name: 'By The Numbers',
    framework: 'By The Numbers',
    style: 'condensed',
    cards: [
      { text: 'My first year as a team lead, in numbers' },
      { text: '6 → 11', subtitle: 'The team almost doubled. I hired five people, and all of them are still here.' },
      { text: '14 releases', subtitle: 'Up from five the year before, with fewer bugs reported after each one.' },
      {
        text: '92%',
        subtitle: 'The team’s score in the yearly engagement survey, the highest in the department.',
        picture: true,
      },
      { text: '1 thing I’d do differently', subtitle: 'Delegate sooner. I held on to too much in the first three months.' },
    ],
  },
  {
    id: 'framework-build-measure-learn',
    name: 'Build → Measure → Learn',
    framework: 'Build→Measure→Learn',
    style: 'field-notes',
    cards: [
      { text: 'Testing an idea in one week instead of six months' },
      {
        text: 'Build',
        subtitle: 'Instead of building the full feature, we made a simple landing page with a sign-up button.',
        picture: true,
      },
      { text: 'Measure', subtitle: 'We sent it to 2,000 customers. 340 clicked sign up, far more than the 50 we needed to go ahead.' },
      { text: 'Learn', subtitle: 'The comments told us which part people cared about most, so we built that part first.' },
      { text: 'One week. $200. A clear yes.' },
      { text: 'Why I work this way', subtitle: 'A cheap test beats a confident guess, every time.' },
    ],
  },
  {
    id: 'framework-mentor-story',
    name: 'Mentor Story',
    framework: 'Mentor Story',
    style: 'poster',
    cards: [
      { text: 'The advice that changed how I work' },
      {
        text: 'Who she was',
        subtitle: 'My first manager, who had led design teams for twenty years.',
        picture: true,
      },
      { text: 'What she told me', subtitle: '“Show your work before it’s ready. Feedback is cheapest when the idea is still rough.”' },
      { text: 'Why it was hard', subtitle: 'I hated showing unfinished work. It felt like admitting I didn’t know what I was doing.' },
      { text: 'Rough drafts, early and often.' },
      { text: 'What it changed', subtitle: 'My projects stopped getting redone at the end. Now I teach the same thing to my own team.' },
    ],
  },
  {
    id: 'framework-career-timeline',
    name: 'Career Timeline',
    framework: 'Career Timeline',
    style: 'condensed',
    cards: [
      { text: 'Ten years, four roles, one thread' },
      { text: '2016: Support', subtitle: 'I answered customer emails and learned what made people angry, and what made them stay.' },
      { text: '2019: Operations', subtitle: 'I fixed the processes behind the complaints I used to answer.' },
      {
        text: '2022: Product',
        subtitle: 'I moved into product to fix the causes, not just the symptoms.',
        picture: true,
      },
      { text: '2025: Head of Product', subtitle: 'Now I lead the team, and every new hire spends their first week on support.' },
      { text: 'The thread: start with the customer.' },
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
