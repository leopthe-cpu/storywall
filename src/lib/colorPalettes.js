import { contrastRatio } from '@/lib/colorContrast';

// Colour themes for Generate (Oz 2026-10-17): 3-colour palettes shown as
// squares, like Color Hunt, that the user can pick before generating, or
// make their own. A theme replaces the style's three colours (Background,
// Text, Accent); the fonts still come from the style. Without a pick, each
// style keeps its own colours.
//
// Our own combinations (not taken from Color Hunt or any palette site).
// Every theme clears AA contrast (4.5:1) for text on its background and
// for an accent card (accent against background or text), checked by
// themeProblems below.
export const COLOR_THEMES = [
  { id: 'forest', name: 'Forest', dominant: '#0F5C4A', ink: '#FFF3DC', accent: '#FFC53D' },
  { id: 'night', name: 'Night', dominant: '#1D1F4E', ink: '#F7F5EF', accent: '#FF6B3D' },
  { id: 'berry', name: 'Berry', dominant: '#7A1F3D', ink: '#FFF1E6', accent: '#FFB4A2' },
  { id: 'lemon', name: 'Lemon', dominant: '#FFE14D', ink: '#141414', accent: '#FF5C93' },
  { id: 'cobalt', name: 'Cobalt', dominant: '#0B3D91', ink: '#F4F7FF', accent: '#38E0B5' },
  { id: 'plum', name: 'Plum', dominant: '#F7F0E6', ink: '#24163A', accent: '#6C3CF0' },
  { id: 'coral', name: 'Coral', dominant: '#FF6B6B', ink: '#1B1B3A', accent: '#FFE66D' },
  { id: 'sailor', name: 'Sailor', dominant: '#F4F1DE', ink: '#1D3557', accent: '#F4A261' },
  { id: 'slate', name: 'Slate', dominant: '#2B2D42', ink: '#EDF2F4', accent: '#FF6F59' },
  { id: 'candy', name: 'Candy', dominant: '#FFF8F0', ink: '#3D1A6E', accent: '#FF7AB6' },
  { id: 'lagoon', name: 'Lagoon', dominant: '#004E64', ink: '#F2FDFF', accent: '#FFB800' },
  { id: 'lime', name: 'Lime', dominant: '#E9FF70', ink: '#1A1A1A', accent: '#7B2CBF' },
  { id: 'apricot', name: 'Apricot', dominant: '#F0EAD6', ink: '#4A1D75', accent: '#FF9F45' },
  { id: 'ink', name: 'Ink', dominant: '#111111', ink: '#FAFAFA', accent: '#00D1B2' },
];

const HEX = /^#[0-9a-f]{6}$/i;

// Only the three colours travel with a run (the server checks the same).
export function themeColors(theme) {
  if (!theme || ![theme.dominant, theme.ink, theme.accent].every((c) => HEX.test(c || ''))) return null;
  return { dominant: theme.dominant.toUpperCase(), ink: theme.ink.toUpperCase(), accent: theme.accent.toUpperCase() };
}

// A style with a theme's colours instead of its own.
export function withTheme(style, theme) {
  const colors = themeColors(theme);
  return colors ? { ...style, ...colors } : style;
}

// What a home-made theme gets wrong, for the hint under the editor. A
// theme with problems can still be used (it's the user's choice): text
// that's hard to read is flagged, and an accent nothing reads on is simply
// never used as a card background (see cardSchemes).
export function themeProblems(theme) {
  const problems = [];
  if (contrastRatio(theme.dominant, theme.ink) < 4.5) problems.push('text');
  if (Math.max(contrastRatio(theme.accent, theme.dominant), contrastRatio(theme.accent, theme.ink)) < 4.5) problems.push('accent');
  return problems;
}

// Home-made themes live in this browser only (a convenience, like a
// remembered filter): nothing about the story depends on them, since the
// colours themselves are saved with each run.
const CUSTOM_KEY = 'storywall.customThemes';

export function loadCustomThemes() {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    return Array.isArray(list) ? list.filter((t) => t?.id && themeColors(t)) : [];
  } catch {
    return [];
  }
}

export function saveCustomThemes(list) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  } catch {
    // Private mode or storage blocked: the theme still works for this visit.
  }
}
