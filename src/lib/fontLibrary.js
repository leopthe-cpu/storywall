// Font library — each font tagged with a role for pairing logic.
// Display: used for card headlines (bold/condensed), rendered at 700+ weight.
// Accent: used for subtitles or emphasized words, rendered at ≤500 weight.
// Neutral: Inter (default), unrestricted — doesn't count toward display/accent limit.

export const FONT_LIBRARY = [
  // Neutral (default)
  { family: 'Inter', role: 'neutral', weights: [400, 500, 600, 700] },

  // Display
  { family: 'Oswald', role: 'display', weights: [300, 400, 500, 600, 700] },
  { family: 'Anton', role: 'display', weights: [400] },
  { family: 'Alfa Slab One', role: 'display', weights: [400] },
  { family: 'Righteous', role: 'display', weights: [400] },
  { family: 'Changa One', role: 'display', weights: [400] },

  // Accent
  { family: 'Fraunces', role: 'accent', weights: [300, 400, 500, 600, 700] },
  { family: 'Playfair Display', role: 'accent', titleOnly: true, weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Space Grotesk', role: 'accent', weights: [300, 400, 500, 600, 700] },
  { family: 'DM Sans', role: 'accent', weights: [400, 500, 700] },
  { family: 'Syne', role: 'accent', weights: [400, 500, 600, 700, 800] },
  { family: 'Comfortaa', role: 'accent', weights: [300, 400, 500, 600, 700] },
];

export const NEUTRAL_FONTS = FONT_LIBRARY.filter(f => f.role === 'neutral');
export const DISPLAY_FONTS = FONT_LIBRARY.filter(f => f.role === 'display');
export const ACCENT_FONTS = FONT_LIBRARY.filter(f => f.role === 'accent');

export function getFontRole(family) {
  const font = FONT_LIBRARY.find(f => f.family === family);
  return font?.role || null;
}

export function isDisplayFont(family) {
  return getFontRole(family) === 'display';
}

export function isAccentFont(family) {
  return getFontRole(family) === 'accent';
}

export function isTitleOnlyFont(family) {
  const font = FONT_LIBRARY.find(f => f.family === family);
  return !!font?.titleOnly;
}