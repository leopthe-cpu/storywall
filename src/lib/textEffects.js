// Text FX (doc 108, Phase 1) — 5 plain-CSS-transform typography effects that
// can be toggled on independently and COMPOUND (e.g. Outline + Spacing both
// active on the same text at once), each with its own strength.
//
// Model: every effect has its own intensity field, which doubles as its
// on/off flag — 0 means off/no contribution, non-zero means active at that
// strength. There's no separate boolean anywhere, so a control's displayed
// "N%" and whether the effect is actually applied can never drift apart.
// Shadow/Outline/Glow/Echo range 0..100; Spacing ranges -100..100 (negative
// = tighter/more compact, the primary use case; positive = wider/airier).
//
// Shared by every place a text element is rendered (the editor canvas in
// DraggableElement.jsx, the gallery thumbnail + live preview in
// TextPanel.jsx, and the publish/preview/published-card renderer in
// CardThumb.jsx) so compounded effects always look the same everywhere,
// instead of three separately-maintained copies drifting apart — the exact
// "editor vs. published" divergence this app has hit before with overlays
// and text clipping.
//
// `scale` converts the effect's reference-px constants into whatever unit
// system the caller renders in: DraggableElement.jsx and TextPanel's gallery
// thumbnail both scale every value manually (pass their own scale factor),
// while CardThumb.jsx scales its whole card with one outer CSS transform
// (pass 1, since the outer transform already scales this uniformly).

// Declarative list driving both the panel UI (pills + sliders) and the style
// builder below, so adding/tuning an effect only means editing one entry.
export const TEXT_FX_LIST = [
  { key: 'shadow', label: 'Shadow', intensityField: 'text_fx_shadow_intensity', colorField: 'text_fx_shadow_color', needsColor: true, min: 0, max: 100, defaultOn: 30 },
  { key: 'outline', label: 'Outline', intensityField: 'text_fx_outline_intensity', colorField: 'text_fx_outline_color', needsColor: true, min: 0, max: 100, defaultOn: 30 },
  { key: 'glow', label: 'Glow', intensityField: 'text_fx_glow_intensity', colorField: 'text_fx_glow_color', needsColor: true, min: 0, max: 100, defaultOn: 30 },
  { key: 'echo', label: 'Echo', intensityField: 'text_fx_echo_intensity', colorField: 'text_fx_echo_color', needsColor: true, min: 0, max: 100, defaultOn: 30 },
  { key: 'spacing', label: 'Spacing', intensityField: 'text_fx_spacing', colorField: null, needsColor: false, min: -100, max: 100, defaultOn: -30 },
];

// Text Warp (doc 108, Phase 2) — letter-level distortions: each character is
// its own positioned/rotated/scaled box along a curve. Mutually exclusive with
// each other (one warp per text box), but they DO compound with every Phase 1
// effect above. Rendered by src/components/creator/WarpedText.jsx, used by the
// same three render paths as getTextEffectStyle so editor and published cards
// can't diverge. text_warp_amount ranges -100..100; 0 = off, and the sign
// flips the direction (hint shown under the slider).
export const TEXT_WARP_LIST = [
  { key: 'arc', label: 'Arc', defaultOn: 40, hint: 'Left curves down · right arches up' },
  { key: 'wave', label: 'Wave', defaultOn: 40, hint: 'Left and right flip the wave' },
  { key: 'stairs', label: 'Stairs', defaultOn: 40, hint: 'Left steps down · right steps up' },
  { key: 'bulge', label: 'Bulge', defaultOn: 40, hint: 'Left pinches · right inflates' },
];

export function hasTextWarp(element) {
  return !!(element && element.text_warp && TEXT_WARP_LIST.some((w) => w.key === element.text_warp) && (element.text_warp_amount || 0) !== 0);
}

function hexToRgb(hex) {
  const h = (typeof hex === 'string' ? hex : '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return {
    r: Number.isFinite(r) ? r : 0,
    g: Number.isFinite(g) ? g : 0,
    b: Number.isFinite(b) ? b : 0,
  };
}

export function getTextEffectStyle(element, scale = 1) {
  if (!element) return {};
  const style = {};
  const shadowLayers = [];
  const pxAbs = (n) => `${Math.max(0, n * scale)}px`;

  const shadowIntensity = element.text_fx_shadow_intensity || 0;
  if (shadowIntensity > 0) {
    const { r, g, b } = hexToRgb(element.text_fx_shadow_color);
    const t = shadowIntensity / 100;
    const offset = 1 + t * 7;   // 1..8 reference px
    const blur = t * 12;        // 0..12 reference px
    shadowLayers.push(`${pxAbs(offset)} ${pxAbs(offset)} ${pxAbs(blur)} rgba(${r},${g},${b},0.55)`);
  }

  const glowIntensity = element.text_fx_glow_intensity || 0;
  if (glowIntensity > 0) {
    const { r, g, b } = hexToRgb(element.text_fx_glow_color);
    const t = glowIntensity / 100;
    const b1 = 2 + t * 6, b2 = 6 + t * 14, b3 = 12 + t * 24;
    shadowLayers.push(
      `0 0 ${pxAbs(b1)} rgba(${r},${g},${b},0.9)`,
      `0 0 ${pxAbs(b2)} rgba(${r},${g},${b},0.7)`,
      `0 0 ${pxAbs(b3)} rgba(${r},${g},${b},0.5)`,
    );
  }

  const echoIntensity = element.text_fx_echo_intensity || 0;
  if (echoIntensity > 0) {
    const { r, g, b } = hexToRgb(element.text_fx_echo_color);
    const t = echoIntensity / 100;
    const step = 2 + t * 6; // 2..8 reference px
    shadowLayers.push(
      `${pxAbs(step)} ${pxAbs(step)} 0 rgba(${r},${g},${b},0.55)`,
      `${pxAbs(step * 2)} ${pxAbs(step * 2)} 0 rgba(${r},${g},${b},0.32)`,
      `${pxAbs(step * 3)} ${pxAbs(step * 3)} 0 rgba(${r},${g},${b},0.15)`,
    );
  }

  if (shadowLayers.length) style.textShadow = shadowLayers.join(', ');

  // Outline sets color:transparent so only the stroke shows — this only
  // affects the fill paint, not the shadow layers above (text-shadow is
  // painted from the glyph shapes independent of the fill's own alpha, so
  // Shadow/Glow/Echo remain visible even when combined with a hollow Outline).
  const outlineIntensity = element.text_fx_outline_intensity || 0;
  if (outlineIntensity > 0) {
    const t = outlineIntensity / 100;
    const width = 0.6 + t * 2.4; // 0.6..3 reference px
    const stroke = `${pxAbs(width)} ${element.text_fx_outline_color || '#000000'}`;
    style.color = 'transparent';
    style.WebkitTextStroke = stroke;
    style.textStroke = stroke;
  }

  // Spacing: negative = tighter/compact (the primary intent), positive =
  // wider/airier. Tightness is capped more conservatively than spread so
  // letters don't overlap into illegibility at the extreme end.
  const spacing = element.text_fx_spacing || 0; // -100..100
  if (spacing !== 0) {
    const refPx = spacing > 0 ? (spacing / 100) * 6 : (spacing / 100) * 2.5;
    style.letterSpacing = `${refPx * scale}px`;
  }

  return style;
}
