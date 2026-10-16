// Test stories for the card lab (src/pages/CardLab.jsx, development only).
// "today" is the structure Generate produced for Oz's grocery test story on
// 2026-10-15; "target" is the same story structured as agreed on the card
// lab sheet; "stress" holds edge cases; "short-cards" holds the light cards
// from Oz's 2026-10-16 staging run. Pictures are AI images
// from the 2026-10-15 run. "photo-long-sentence" is card 7 of the
// 2026-10-16 production run: one sentence too long to sit under a picture.
export const CARD_LAB_FIXTURES = {
  "grocery-target": [
    {
      "text": "Why 40% never came back",
      "subtitle": "",
      "imageUrl": "https://igakvqlzvglvuqflngey.supabase.co/storage/v1/object/public/public-media/16fb633a-b7a8-4787-898e-5138278f1095/generated/776269aa-9105-4e72-ba75-26df6bddd66d.png"
    },
    {
      "text": "Fine on the surface",
      "subtitle": "In my first month as product manager for our grocery delivery app, the numbers looked fine on the surface. Orders were steady, but almost 40% of new customers never placed a second order. Leadership assumed it was pricing, and the plan on the table was a discount campaign."
    },
    {
      "text": "I wasn’t convinced.",
      "subtitle": "I spent two weeks calling customers who had ordered once and disappeared.",
      "imageUrl": "https://igakvqlzvglvuqflngey.supabase.co/storage/v1/object/public/public-media/16fb633a-b7a8-4787-898e-5138278f1095/generated/47c824b0-aaed-452f-8089-17085f4c07ef.png"
    },
    {
      "text": "",
      "subtitle": "Twenty-three calls in, a pattern showed up: people weren’t leaving because of price. They were leaving because their first delivery arrived with something missing or swapped, and nobody told them before the driver showed up."
    },
    {
      "text": "The problem wasn’t marketing. It was trust.",
      "subtitle": ""
    },
    {
      "text": "A nine-day fix",
      "subtitle": "So instead of the discount campaign, I pitched a small fix: a substitution message sent while the order was being picked, with one tap to approve or refuse the replacement. Engineering estimated three weeks. We shipped a simple version in nine days."
    },
    {
      "text": "60% → 74%",
      "subtitle": "Within two months, second orders from new customers went from 60% to 74%. Support tickets about missing items dropped by a third. The discount campaign was cancelled, which saved about $200k we had budgeted for it."
    },
    {
      "text": "What I took from it:",
      "subtitle": "when the data says “what”, talk to people to find out “why”. The most expensive fix is the one that solves the wrong problem."
    }
  ],
  "grocery-today": [
    {
      "text": "My first month as product manager",
      "subtitle": "In my first month as product manager for our grocery delivery app.",
      "imageUrl": "https://igakvqlzvglvuqflngey.supabase.co/storage/v1/object/public/public-media/16fb633a-b7a8-4787-898e-5138278f1095/generated/776269aa-9105-4e72-ba75-26df6bddd66d.png"
    },
    {
      "text": "",
      "subtitle": "Orders were steady, but almost 40% of new customers never placed a second order.",
      "imageUrl": null
    },
    {
      "text": "The plan was a discount campaign",
      "subtitle": "and the plan on the table was a discount campaign.",
      "imageUrl": null
    },
    {
      "text": "I wasn’t convinced.",
      "subtitle": "I spent two weeks calling customers who had ordered once and disappeared.",
      "imageUrl": "https://igakvqlzvglvuqflngey.supabase.co/storage/v1/object/public/public-media/16fb633a-b7a8-4787-898e-5138278f1095/generated/47c824b0-aaed-452f-8089-17085f4c07ef.png"
    },
    {
      "text": "Twenty-three calls in, a pattern showed up",
      "subtitle": "people weren’t leaving because of price.",
      "imageUrl": null
    },
    {
      "text": "",
      "subtitle": "They were leaving because their first delivery arrived with something missing or swapped,",
      "imageUrl": null
    },
    {
      "text": "",
      "subtitle": "and nobody told them before the driver showed up.",
      "imageUrl": null
    },
    {
      "text": "The problem wasn’t marketing. It was trust.",
      "subtitle": "",
      "imageUrl": "https://igakvqlzvglvuqflngey.supabase.co/storage/v1/object/public/public-media/16fb633a-b7a8-4787-898e-5138278f1095/generated/f2e8780f-d8dd-4144-bdf4-289751147dc9.png"
    },
    {
      "text": "So instead of the discount campaign, I pitched a small fix:",
      "subtitle": "a substitution message sent while the order was being picked,",
      "imageUrl": null
    },
    {
      "text": "",
      "subtitle": "with one tap to approve or refuse the replacement. Engineering estimated three weeks.",
      "imageUrl": null
    },
    {
      "text": "We shipped a simple version in nine days.",
      "subtitle": "",
      "imageUrl": "https://igakvqlzvglvuqflngey.supabase.co/storage/v1/object/public/public-media/16fb633a-b7a8-4787-898e-5138278f1095/generated/dcefcb35-45c5-4206-bbcf-536fa234b64a.png"
    },
    {
      "text": "Within two months,",
      "subtitle": "second orders from new customers went from 60% to 74%. Support tickets about missing items dropped by a third.",
      "imageUrl": "https://igakvqlzvglvuqflngey.supabase.co/storage/v1/object/public/public-media/16fb633a-b7a8-4787-898e-5138278f1095/generated/ffb7ad31-8332-475e-9975-e59bf25c9c4e.png"
    },
    {
      "text": "The discount campaign was cancelled,",
      "subtitle": "which saved about $200k we had budgeted for it.",
      "imageUrl": null
    },
    {
      "text": "What I took from it:",
      "subtitle": "when the data says “what”, talk to people to find out “why”.",
      "imageUrl": null
    },
    {
      "text": "The most expensive fix is the one that solves the wrong problem.",
      "subtitle": "",
      "imageUrl": "https://igakvqlzvglvuqflngey.supabase.co/storage/v1/object/public/public-media/16fb633a-b7a8-4787-898e-5138278f1095/generated/0a2df7d8-7f14-4af7-a41c-2ebc47b8ee25.png"
    }
  ],
  "stress": [
    {
      "text": "A cover title that is quite a bit longer than it should be for a cover",
      "subtitle": "",
      "imageUrl": "https://igakvqlzvglvuqflngey.supabase.co/storage/v1/object/public/public-media/16fb633a-b7a8-4787-898e-5138278f1095/generated/f2e8780f-d8dd-4144-bdf4-289751147dc9.png"
    },
    {
      "text": "Everything at once",
      "subtitle": "This paragraph is deliberately long so the layout has to move whole sentences to a continuation card instead of shrinking the text below the minimum size. This paragraph is deliberately long so the layout has to move whole sentences to a continuation card instead of shrinking the text below the minimum size. This paragraph is deliberately long so the layout has to move whole sentences to a continuation card instead of shrinking the text below the minimum size. This paragraph is deliberately long so the layout has to move whole sentences to a continuation card instead of shrinking the text below the minimum size."
    },
    {
      "text": "Photo with a long caption",
      "subtitle": "A photo card whose text is longer than the space under the picture. The picture gets shorter first. If that is not enough, the last sentences move to the next card. Nothing is cut and nothing overlaps.",
      "imageUrl": "https://igakvqlzvglvuqflngey.supabase.co/storage/v1/object/public/public-media/16fb633a-b7a8-4787-898e-5138278f1095/generated/dcefcb35-45c5-4206-bbcf-536fa234b64a.png"
    },
    {
      "text": "Supercalifragilisticexpialidocious-and-even-longer-words",
      "subtitle": "Long unbroken words must wrap by characters instead of spilling off the card."
    },
    {
      "text": "Short.",
      "subtitle": ""
    }
  ],
  "short-cards": [
    { "text": "Why 40% never came back", "subtitle": "" },
    { "text": "", "subtitle": "Their first order showed up with something missing or swapped for something else, and nobody told them until the driver was at the door." },
    { "text": "", "subtitle": "Eng said three weeks. We got a basic version out in nine days." },
    { "text": "What changed", "subtitle": "Two months later repeat orders from new customers went from 60% to 74%. Tickets about missing items dropped by about a third. We killed the discount campaign too, which saved us around $200k." },
    { "text": "The problem wasn’t marketing. It was trust.", "subtitle": "" }
  ],
  "photo-long-sentence": [
    { "text": "Why 40% never came back", "subtitle": "" },
    { "text": "A much smaller fix", "subtitle": "I pushed back on the discounts and pitched something way smaller: send a message while the order is being picked, and let people approve or refuse the replacement with one tap.", "imageUrl": "https://igakvqlzvglvuqflngey.supabase.co/storage/v1/object/public/public-media/16fb633a-b7a8-4787-898e-5138278f1095/generated/47c824b0-aaed-452f-8089-17085f4c07ef.png" },
    { "text": "", "subtitle": "I pushed back on the discounts and pitched something way smaller: send a message while the order is being picked, and let people approve or refuse the replacement with one tap.", "imageUrl": "https://igakvqlzvglvuqflngey.supabase.co/storage/v1/object/public/public-media/16fb633a-b7a8-4787-898e-5138278f1095/generated/47c824b0-aaed-452f-8089-17085f4c07ef.png" },
    { "text": "", "subtitle": "Eng said three weeks. We got a basic version out in nine days." }
  ]
};
