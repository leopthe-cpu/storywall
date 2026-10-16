# Generate (AI Carousel Builder): roadmap

Oz's direction, 2026-10-16. Order agreed for the next sessions:

1. Test the last builder fixes on staging, fix what comes up.
2. Performance work across the app (Generate first: it's the only slow part).
3. The new Generate loading screen (section A).
4. Next week or later: decide what to build next. Sections B and C are documented here so the performance work doesn't have to be redone for them.

## A. Generate loading screen (do after performance)

Replaces `src/components/creator/GenerateProgress.jsx` (today: white screen, spinner, a percentage that sits at 0% for a long time and then jumps to 33%).

- **Background:** the paper grid that drifts down, as on the skills loading screen (`GridBackdrop` with `drift`, `.grid-drift` in `src/index.css`). It drifts a bit faster than today (3s per grid cell is too slow).
- **Percentage:** set in the StoryWall logo font, FK Raster Grotesk (https://fonts.floriankarsten.com/fk-raster-grotesk). Before shipping, check the font's licence for web use and self-host it. It isn't in the repo yet.
- **Smooth progress:** the number moves often, never long pauses then big jumps. It eases towards the next real step (structuring, each picture, layout) and holds just below it until that step really finishes, the way the skills loader does today. With the pictures made at the same time, each finished picture is a real step.
- **Rotating lines while you wait** (in the style of The Sims loading screens). They change every few seconds. Ideas:
  - Finding your hook…
  - Cutting the boring part (there wasn't one)…
  - Putting your best sentence first…
  - Counting the 'we's and the 'I's…
  - Making the numbers look like numbers…
  - Choosing a font your future boss will like…
  - Lining things up to the pixel…
  - Leaving room to breathe…
  - Asking the cards to stand up straight…
  - Turning notes into a story…
  - Hiding the typos you didn't make…
  - Saving a seat for your photos…
  - Making you look good. Easy job.
- **Floating card under the progress,** in the style of the "you're already signed in" card on sign-up: "Sit back, we'll finish this for you. You can leave: your story will be waiting in Drafts in the builder." This depends on generation running without the tab being open (section D).

## B. Generate input: an open canvas instead of a text form (later)

- **Free canvas, like Apple Freeform.** The text cursor is always blinking, so you can type or paste right away.
- **Pictures:** drag and drop them onto the canvas (desktop), or attach them. They appear at the bottom of the canvas, and you can move them anywhere.
- **+ button** (the only way on phones, also on desktop) that adds:
  - **Media:** pictures now, videos later.
  - **Colours:** pick a suggested 3-colour theme, then edit it. The three colours take turns as background and text colours across the cards (see Oz's examples: light / dark / accent cards). Themes: build our own set of good combinations (ideas from palette sites such as Color Hunt; check their terms, and whether they offer any data access, before using anything from them).
  - **Stat (much later):** a chart. In Generate, the AI picks the chart type from context (line, pie, circles…). Chart designs to be discussed. A chart gallery for the manual builder is a separate idea.
- **Text over pictures:** text always sits on top of pictures, with a fade behind it for contrast.
- **Grabbing a picture behind text (desktop):** when the pointer rests on text that has a picture behind it, after 2 seconds the picture comes to the front so it can be grabbed and moved. It goes back when the pointer leaves the picture.

## C. Product vision to keep in mind (no work planned yet)

- **Card shapes:** vertical (4:5 or similar, Instagram-style), square (today), horizontal (16:9).
- **All storytelling formats:** pictures and videos now, audio notes later.

What this means for the performance work, so it doesn't need redoing:

- **Layout engine** (`src/lib/cardLayout.js`, `src/lib/aiStyleTemplates.js`): don't add more code that assumes a square card. Today `CARD = 320` is both width and height. New code should take width and height separately, so other card shapes only need different numbers.
- **Picture sizes and thumbnails:** store sizes that also work for a tall card (e.g. 1080 wide by 1350 high) and a wide one, not only square crops. Thumbnail variants should cover every shape.
- **Picture generation:** ask for the shape the card needs, instead of always the same size.
- **Media pipeline:** keep it type-agnostic (image / video / audio), so audio fits in without a rewrite.

## D. Generate keeps going when the tab closes (part of the performance work)

- Generation runs on the server as a background job, not in the browser. The result is saved straight into the user's Drafts.
- While it's running, Drafts shows a placeholder the same size as a normal draft: it can't be opened, says "Formatting your story…" and shows the drifting-grid animation. When the job finishes, it becomes a normal draft.
- Today the browser runs every step and the cards are saved only after all of them finish. Closing the tab loses the result, but the AI cost has already been spent.
