import { hexToRgb, rgbToHex, contrastRatio } from '@/lib/colorContrast';

// Profile colours (decision 49, Lifetime per decision 50): three colours a
// supporter picks — background, text and tags — turned into the wall's
// colour variables (--wall-* in src/index.css). Everything else on the wall
// follows them: secondary text, lines and icons are the text colour mixed
// into the background; buttons are the text colour with background-coloured
// labels; tag text is black or white, whichever reads better; a selected tag
// swaps its colours. The top bar is not themed but switches to the light
// colour when the background is too dark for it.

export const HEX = /^#[0-9a-fA-F]{6}$/;
export const PLAIN_THEME = { bg: '#F4F2EC', text: '#262624', tag: '#FFFFFF' };
const TOPBAR_DARK = '#262624';
const TOPBAR_LIGHT = '#F4F2EC';

export function isValidWallTheme(theme) {
  return !!theme && HEX.test(theme.bg) && HEX.test(theme.text) && HEX.test(theme.tag);
}

// `amount` (0..1) of colour b mixed into colour a.
function mix(a, b, amount) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * amount, g: x.g + (y.g - x.g) * amount, b: x.b + (y.b - x.b) * amount });
}

const readableOn = (bg) => (contrastRatio(bg, '#000000') >= contrastRatio(bg, '#FFFFFF') ? '#000000' : '#FFFFFF');

// Whether the top bar switches to its light colour on this theme's
// background (the logo image must switch with it).
export function wallTopbarIsLight(theme) {
  return isValidWallTheme(theme) && contrastRatio(theme.bg, TOPBAR_DARK) < 3;
}

// The CSS variables for a theme, as a style object ({ '--wall-bg': … }), or
// null for the plain theme (no theme, or an invalid one).
export function wallThemeVars(theme) {
  if (!isValidWallTheme(theme)) return null;
  const { bg, text, tag } = theme;
  const tagText = readableOn(tag);
  return {
    '--wall-bg': bg,
    '--wall-grid': mix(bg, text, 0.1),
    '--wall-surface': mix(bg, text, 0.06),
    '--wall-skeleton': mix(bg, text, 0.04),
    '--wall-text': text,
    '--wall-title': text,
    '--wall-text-2': mix(text, bg, 0.3),
    '--wall-text-3': mix(text, bg, 0.45),
    '--wall-btn': text,
    '--wall-btn-hover': mix(text, bg, 0.12),
    '--wall-btn-text': bg,
    '--wall-tag': tag,
    '--wall-tag-text': tagText,
    '--wall-tag-border': mix(tag, tagText, 0.12),
    '--wall-tag-border-hover': mix(tag, tagText, 0.4),
    '--wall-tag-selected': tagText,
    '--wall-tag-selected-text': tag,
    '--wall-topbar': wallTopbarIsLight(theme) ? TOPBAR_LIGHT : TOPBAR_DARK,
  };
}
