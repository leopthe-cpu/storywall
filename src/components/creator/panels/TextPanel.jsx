import { useState, useEffect } from 'react';
import { Plus, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import ColorPicker from '@/components/creator/ColorPicker';
import ThumbMenu from '@/components/creator/ThumbMenu';
import MinimalSlider from '@/components/creator/MinimalSlider';
import { REFERENCE_CARD_SIZE } from '@/components/creator/CanvasArea';
import { getFontRole, isTitleOnlyFont } from '@/lib/fontLibrary';
import FontPicker from '@/components/creator/panels/FontPicker';
import SizeStepper from '@/components/creator/SizeStepper';
import { resolveColor, findOrCreateToken } from '@/lib/colorTokens';
import { TEXT_FX_LIST, TEXT_WARP_LIST, getTextEffectStyle, hasTextWarp } from '@/lib/textEffects';
import WarpedText from '@/components/creator/WarpedText';

// Effects/Warp pill styling: every pill that's in use (non-zero) is white;
// the one whose slider is currently open additionally gets a ring so you can
// still tell which one the slider below belongs to. Unused pills stay dim.
function pillClass(inUse, isOpen) {
  if (isOpen) return 'bg-white text-black font-medium ring-2 ring-white/70 ring-offset-2 ring-offset-black';
  if (inUse) return 'bg-white text-black';
  return 'bg-white/10 text-white/60 hover:bg-white/15';
}

const TILE = 64;
const THUMB_SCALE = TILE / REFERENCE_CARD_SIZE;
const TYPE_SCALE = [8, 12, 16, 20, 24, 28, 32, 36, 40, 48];

function TextThumb({ element, cardBg, tokens }) {
  const baseFontSize = element.font_size ? parseInt(element.font_size) : 14;
  const scaledFontSize = Math.max(1, Math.round(baseFontSize * THUMB_SCALE));
  const hasContent = !!(element.content && element.content.trim());
  const textDeco = [
    element.font_underline ? 'underline' : '',
    element.font_strikethrough ? 'line-through' : '',
  ].filter(Boolean).join(' ') || 'none';
  const warped = hasContent && hasTextWarp(element);
  return (
    <div className="w-full h-full overflow-hidden relative" style={{ backgroundColor: cardBg }}>
      <div
        className="absolute whitespace-pre-wrap break-words"
        style={{
          left: `${element.x ?? 16}%`,
          top: `${element.y ?? 20}%`,
          maxWidth: '80%',
          fontSize: scaledFontSize,
          fontWeight: element.font_weight || '400',
          color: hasContent ? resolveColor(element.color_token, tokens, element.color || '#000000') : '#9CA3AF',
          fontFamily: element.font_family || 'Inter',
          lineHeight: baseFontSize >= 32 ? '1.05' : '1.3',
          fontStyle: element.font_italic ? 'italic' : 'normal',
          textAlign: element.text_align || 'left',
          textDecoration: warped ? 'none' : textDeco,
          ...getTextEffectStyle(element, THUMB_SCALE),
        }}
      >
        {warped
          ? <WarpedText text={element.content} warp={element.text_warp} amount={element.text_warp_amount} decoration={textDeco} />
          : (element.content || 'Text')}
      </div>
    </div>
  );
}

export default function TextPanel({
  selectedElement, onUpdateElement, onUpdateCard, onAddElement,
  currentCard, onSelectElement, onDuplicateElement, onDeleteElement, onReorderElements,
  tokens = [], onSetTokens,
  cards = [], onNavigate,
  galleryResetToken,
}) {
  const [tab, setTab] = useState('gallery');
  const [showColorPicker, setShowColorPicker] = useState(false);
  // Holds the colorField name (e.g. 'text_fx_shadow_color') of whichever
  // effect's swatch was tapped, since multiple effects can be active at once
  // and each needs its own color picker target.
  const [effectColorField, setEffectColorField] = useState(null);
  // Which single Text FX effect currently has its slider expanded (accordion
  // — only one slider shown at a time, regardless of how many effects are
  // actually active/compounded). Reset whenever the selected text box changes
  // so a leftover "open" effect from a previous box doesn't carry over.
  const [openFxKey, setOpenFxKey] = useState(null);

  // A new card was just created — open on Gallery instead of whatever tab
  // was last used, even if this panel stayed mounted (no element is
  // selected on a fresh card, so the effect below wouldn't otherwise fire).
  useEffect(() => {
    if (galleryResetToken == null) return;
    setTab('gallery');
  }, [galleryResetToken]);

  // Flat list of every text box across all cards in the story
  const allTextElements = [];
  cards.forEach((card, idx) => {
    (card.elements || []).forEach(el => {
      if (el.type === 'text') {
        allTextElements.push({
          el,
          cardIdx: idx,
          cardBg: resolveColor(card.background_token, tokens, card.background_color || '#FFFFFF'),
        });
      }
    });
  });
  const formatEl = selectedElement || {};

  // Live color preview: update the hardcoded color on every drag.
  // Token assignment happens on close to avoid creating unused tokens
  // for intermediate drag colors.
  const handleColorChange = (c) => {
    onUpdateElement({ color: c, color_token: undefined });
  };

  // Text effect colors are plain hex, not tokenized (matches MediaPanel's
  // overlay_color pattern) — effects are a per-element accent, not a theme color.
  const handleEffectColorChange = (c) => {
    if (!effectColorField) return;
    onUpdateElement({ [effectColorField]: c });
  };

  // Tapping a pill is a single accordion action, not an independent on/off
  // toggle: tapping the ALREADY-OPEN pill erases that effect (resets to 0 and
  // closes it) — the same "click it again to erase" gesture as before, but
  // now scoped to whichever one slider is currently expanded. Tapping any
  // OTHER pill just opens its slider (turning the effect on at its default
  // strength only if it was still off at 0); it never resets an already-active
  // effect just by bringing its slider into view.
  const handleFxPillClick = (fx) => {
    if (openFxKey === fx.key) {
      onUpdateElement({ [fx.intensityField]: 0 });
      setOpenFxKey(null);
      return;
    }
    const current = formatEl[fx.intensityField] || 0;
    if (current === 0) {
      const updates = { [fx.intensityField]: fx.defaultOn };
      if (fx.needsColor && !formatEl[fx.colorField]) updates[fx.colorField] = '#000000';
      onUpdateElement(updates);
    }
    setOpenFxKey(fx.key);
  };

  // Warps are one-at-a-time (a box can't be both an arc and a wave), but they
  // share the same accordion as the Phase 1 effects above — still only one
  // slider on screen. Same gestures: tap the open warp again to erase it;
  // tap a different warp to switch to it (starting at its default strength);
  // tap the active-but-closed warp to just reopen its slider.
  const warpOpenKey = (w) => `warp:${w.key}`;
  const handleWarpPillClick = (w) => {
    if (openFxKey === warpOpenKey(w)) {
      onUpdateElement({ text_warp: 'none', text_warp_amount: 0 });
      setOpenFxKey(null);
      return;
    }
    if (formatEl.text_warp !== w.key || !(formatEl.text_warp_amount || 0)) {
      onUpdateElement({ text_warp: w.key, text_warp_amount: w.defaultOn });
    }
    setOpenFxKey(warpOpenKey(w));
  };

  // Clicking any text box on the canvas opens the Format panel immediately.
  // (Guarded so this doesn't fight the new-card gallery reset above: a
  // fresh card always clears the selection first, so selectedElement?.id
  // is already null here in that case.)
  useEffect(() => {
    if (selectedElement?.id) {
      setTab('format');
    }
    setOpenFxKey(null);
  }, [selectedElement?.id]);

  const addText = () => {
    const { token, tokens: newTokens } = findOrCreateToken('#000000', tokens);
    if (newTokens.length > tokens.length) onSetTokens?.(newTokens);
    onAddElement({
      type: 'text',
      content: '',
      x: 10, y: 40,
      font_family: 'Inter',
      font_size: '12',
      // Locked from the moment it's created: manually-added text boxes keep
      // whatever size they're given (default 12, or whatever the user later
      // sets via the size control) instead of being auto-resized to fit the
      // box once typing is done. The content-aware auto-estimate is for AI
      // Generate-mode's initial text shaping only — see computeEstimatedFontSize
      // in DraggableElement.jsx.
      font_size_locked: true,
      font_weight: '400',
      font_italic: false, font_underline: false, font_strikethrough: false,
      color: '#000000',
      color_token: token.id,
    });
    setTab('format');
  };

  // Font selection with card-level pairing enforcement:
  // - Display font → weight 700+, and update other display-font elements on the card to match
  // - Accent font → weight 400, and update other accent-font elements on the card to match
  // - Neutral font → no weight enforcement, no card-level swap
  // - At most one display font + one accent font per card
  const handleFontSelect = (family, role) => {
    if (isTitleOnlyFont(family) && selectedElement?.text_type === 'body') return;
    if (role === 'neutral') {
      onUpdateElement({ font_family: family });
      return;
    }

    const weight = role === 'display' ? '700' : '400';

    if (!onUpdateCard || !currentCard || !selectedElement) {
      onUpdateElement({ font_family: family, font_weight: weight });
      return;
    }

    // Update all text elements: selected element gets the new font,
    // other elements with the same role font get swapped to the new font too
    const newElements = currentCard.elements.map(el => {
      if (el.type !== 'text') return el;
      if (el.id === selectedElement.id) {
        return { ...el, font_family: family, font_weight: weight };
      }
      const elRole = getFontRole(el.font_family);
      if (elRole === role && el.font_family !== family) {
        return { ...el, font_family: family, font_weight: weight };
      }
      return el;
    });
    onUpdateCard({ elements: newElements });
  };

  const handleTextSelect = (cardIdx, elId) => {
    onNavigate?.(cardIdx);
    onSelectElement?.(elId);
    setTab('format');
  };

  if (showColorPicker && selectedElement) {
    return (
      <ColorPicker
        color={resolveColor(selectedElement.color_token, tokens, selectedElement.color || '#000000')}
        onChange={handleColorChange}
        onClose={() => {
          // On close, find or create a token for the final color and assign it.
          const finalColor = selectedElement.color || '#000000';
          const { token, tokens: newTokens } = findOrCreateToken(finalColor, tokens);
          if (newTokens.length > tokens.length) onSetTokens?.(newTokens);
          onUpdateElement({ color_token: token.id });
          setShowColorPicker(false);
        }}
        dark
      />
    );
  }

  if (effectColorField && selectedElement) {
    return (
      <ColorPicker
        color={selectedElement[effectColorField] || '#000000'}
        onChange={handleEffectColorChange}
        onClose={() => setEffectColorField(null)}
        dark
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tabs — fixed */}
      <div className="flex border-b border-white/10 flex-shrink-0">
        {['gallery', 'format', 'effects'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${tab === t ? 'text-white border-b-2 border-white' : 'text-white/40'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* GALLERY — all text boxes across every card */}
      {tab === 'gallery' && (
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 overflow-y-auto overscroll-contain px-4 py-3">
            <div className="flex flex-wrap gap-1">
              {/* Text type button */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                <button
                  onClick={addText}
                  className="rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center hover:border-white/50 transition-colors"
                  style={{ width: TILE, height: TILE }}
                >
                  <Plus size={16} className="text-white/40" />
                </button>
                <span className="text-[9px] text-white/20">Text</span>
              </div>

              {/* Text thumbnails — one per text box across all cards */}
              {allTextElements.map(({ el, cardIdx, cardBg: elCardBg }) => (
                <div key={el.id} className="flex-shrink-0 flex flex-col items-center gap-1.5">
                  <div
                    onClick={() => handleTextSelect(cardIdx, el.id)}
                    className={`rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      selectedElement?.id === el.id ? 'border-white' : 'border-white/20 hover:border-white/50'
                    }`}
                    style={{ width: TILE, height: TILE }}
                  >
                    <TextThumb element={el} cardBg={elCardBg} tokens={tokens} />
                  </div>
                  <ThumbMenu
                    onDuplicate={() => onDuplicateElement?.(el)}
                    onDelete={() => onDeleteElement?.(el.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FORMAT */}
      {tab === 'format' && (
        <div className="flex-1 min-h-0 relative">
          <div className={`absolute inset-0 overflow-y-auto overscroll-contain ${selectedElement ? '' : 'opacity-40 pointer-events-none'}`}>
            <div className="px-3 py-1.5 flex flex-col gap-1.5">
              {/* Size — type-scale stepper (shared component) */}
              <SizeStepper
                label="Size"
                value={formatEl.font_size}
                min={8}
                max={128}
                step={8}
                scaleSteps={TYPE_SCALE}
                onChange={(v) => onUpdateElement({ font_size: v })}
              />

              {/* Font — dropdown picker */}
              <div>
                <label className="text-white/30 text-[9px] uppercase tracking-wider mb-0.5 block">Font</label>
                <FontPicker
                  currentFont={formatEl.font_family || 'Inter'}
                  onSelect={handleFontSelect}
                  textType={formatEl.text_type}
                />
              </div>

              {/* Style + Color (combined row — color swatch first, then B I U S) */}
              <div className="flex items-center gap-1.5 mt-1">
                <button onClick={() => setShowColorPicker(true)}
                  className="w-7 h-7 rounded bg-white border border-white/40 flex-shrink-0 hover:scale-105 transition-transform"
                  title="Text color">
                  <div className="w-4 h-4 rounded-sm mx-auto border border-black/20" style={{ backgroundColor: resolveColor(formatEl.color_token, tokens, formatEl.color || '#000000') }} />
                </button>
                <button onClick={() => onUpdateElement({ font_weight: formatEl.font_weight === '700' ? '400' : '700' })}
                  className={`w-8 h-7 rounded text-xs font-bold transition-colors ${formatEl.font_weight === '700' ? 'bg-white text-black' : 'bg-white/10 text-white/60 hover:bg-white/15'}`}>
                  B
                </button>
                <button onClick={() => onUpdateElement({ font_italic: !formatEl.font_italic })}
                  className={`w-8 h-7 rounded text-xs italic transition-colors ${formatEl.font_italic ? 'bg-white text-black' : 'bg-white/10 text-white/60 hover:bg-white/15'}`}>
                  I
                </button>
                <button onClick={() => onUpdateElement({ font_underline: !formatEl.font_underline })}
                  className={`w-8 h-7 rounded text-xs underline transition-colors ${formatEl.font_underline ? 'bg-white text-black' : 'bg-white/10 text-white/60 hover:bg-white/15'}`}>
                  U
                </button>
                <button onClick={() => onUpdateElement({ font_strikethrough: !formatEl.font_strikethrough })}
                  className={`w-8 h-7 rounded text-xs line-through transition-colors ${formatEl.font_strikethrough ? 'bg-white text-black' : 'bg-white/10 text-white/60 hover:bg-white/15'}`}>
                  S
                </button>
              </div>

              {/* Alignment */}
              <div>
                <label className="text-white/30 text-[9px] uppercase tracking-wider mb-0.5 block">Align</label>
                <div className="flex gap-1">
                  {[
                    { val: 'left', Icon: AlignLeft },
                    { val: 'center', Icon: AlignCenter },
                    { val: 'right', Icon: AlignRight },
                  ].map(({ val, Icon }) => (
                    <button
                      key={val}
                      onClick={() => onUpdateElement({ text_align: val })}
                      className={`flex-1 h-7 rounded flex items-center justify-center transition-colors ${
                        (formatEl.text_align || 'left') === val ? 'bg-white text-black' : 'bg-white/10 text-white/60 hover:bg-white/15'
                      }`}
                    >
                      <Icon size={14} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Layer order */}
              <div>
                <label className="text-white/30 text-[9px] uppercase tracking-wider mb-0.5 block">Layer</label>
                <div className="flex gap-1">
                  <button onClick={() => onUpdateElement({ z_index: (formatEl.z_index ?? 1000) + 10 })}
                    className="flex-1 py-1 bg-white/10 text-white/70 text-[11px] rounded hover:bg-white/15 transition-colors">
                    Forward
                  </button>
                  <button onClick={() => onUpdateElement({ z_index: Math.max(1000, (formatEl.z_index ?? 1000) - 10) })}
                    className="flex-1 py-1 bg-white/10 text-white/70 text-[11px] rounded hover:bg-white/15 transition-colors">
                    Backward
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EFFECTS — doc 108's Text FX plan. Phase 1: 5 plain-CSS effects,
          independently toggleable and compoundable (e.g. Outline + Spacing).
          Phase 2: letter-level warps (Arc, Wave, Stairs, Bulge), one per box,
          compounding with Phase 1. */}
      {tab === 'effects' && (
        <div className="flex-1 min-h-0 relative">
          <div className={`absolute inset-0 overflow-y-auto overscroll-contain px-3 py-2 flex flex-col gap-3 ${selectedElement ? '' : 'opacity-40 pointer-events-none'}`}>
            {/* One pill per effect — always shows its own live %. Only the
                currently-OPEN effect (tapped most recently) highlights white
                and shows a slider; every other pill — whether it's actually
                active/compounded or still off — stays the same regular/dim
                color, just displaying whatever % it's currently at (0% if
                off). This is a deliberate accordion: any number of effects can
                be active/compounded at once, but only one slider is ever on
                screen, so re-tapping the open one is always "erase this
                effect", never ambiguous with adjusting a different one. */}
            <div className="flex flex-wrap gap-1.5">
              {TEXT_FX_LIST.map(fx => {
                const value = formatEl[fx.intensityField] || 0;
                const isOpen = openFxKey === fx.key;
                return (
                  <button
                    key={fx.key}
                    onClick={() => handleFxPillClick(fx)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${pillClass(value !== 0, isOpen)}`}
                  >
                    {fx.label}: {value}%
                  </button>
                );
              })}
            </div>

            {/* Only the open effect's slider is shown — smaller and centered
                rather than edge-to-edge, both to read as a focused single
                control and to keep drags away from the screen edge (avoids
                triggering the mobile browser's edge-swipe back gesture). A
                tick marks 0 — the value every effect erases back to. */}
            {TEXT_FX_LIST.filter(fx => fx.key === openFxKey).map(fx => (
              <div key={fx.key} className="flex flex-col items-center gap-1.5 py-1">
                {fx.needsColor && (
                  <button onClick={() => setEffectColorField(fx.colorField)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">
                    <div className="w-4 h-4 rounded border border-white/20" style={{ backgroundColor: formatEl[fx.colorField] || '#000000' }} />
                    <span className="text-white/60 text-[10px] font-mono">{formatEl[fx.colorField] || '#000000'}</span>
                  </button>
                )}
                <MinimalSlider
                  min={fx.min} max={fx.max}
                  value={formatEl[fx.intensityField] || 0}
                  resetValue={0}
                  compact
                  onChange={(v) => onUpdateElement({ [fx.intensityField]: v })}
                />
              </div>
            ))}

            {/* WARP — doc 108 Phase 2: letter-level distortions. One warp per
                box, compounds with every effect above. */}
            <div>
              <label className="text-white/30 text-[9px] uppercase tracking-wider mb-1 block">Warp</label>
              <div className="flex flex-wrap gap-1.5">
                {TEXT_WARP_LIST.map(w => {
                  const isActive = formatEl.text_warp === w.key && (formatEl.text_warp_amount || 0) !== 0;
                  const value = isActive ? formatEl.text_warp_amount : 0;
                  const isOpen = openFxKey === warpOpenKey(w);
                  return (
                    <button
                      key={w.key}
                      onClick={() => handleWarpPillClick(w)}
                      className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${pillClass(isActive, isOpen)}`}
                    >
                      {w.label}: {value}%
                    </button>
                  );
                })}
              </div>
            </div>

            {TEXT_WARP_LIST.filter(w => openFxKey === warpOpenKey(w)).map(w => (
              <div key={w.key} className="flex flex-col items-center gap-1 py-1">
                <MinimalSlider
                  min={-100} max={100}
                  value={formatEl.text_warp === w.key ? (formatEl.text_warp_amount || 0) : 0}
                  resetValue={0}
                  compact
                  onChange={(v) => onUpdateElement({ text_warp: w.key, text_warp_amount: v })}
                />
                <span className="text-white/30 text-[10px]">{w.hint}</span>
              </div>
            ))}

            {/* Live preview — same helpers the canvas/thumbnails use, so this
                always matches what actually renders (compounded effects,
                warp and all). */}
            <div className="mt-1 rounded-lg bg-black/30 flex items-center justify-center overflow-hidden" style={{ minHeight: 96, padding: '28px 12px' }}>
              <div
                style={{
                  fontSize: 22,
                  maxWidth: '100%',
                  textAlign: 'center',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'break-word',
                  fontWeight: formatEl.font_weight || '400',
                  fontFamily: formatEl.font_family || 'Inter',
                  fontStyle: formatEl.font_italic ? 'italic' : 'normal',
                  textTransform: formatEl.text_transform || 'none',
                  color: resolveColor(formatEl.color_token, tokens, formatEl.color || '#000000'),
                  ...getTextEffectStyle(formatEl, 1),
                }}
              >
                {hasTextWarp(formatEl)
                  ? <WarpedText
                      text={(formatEl.content && formatEl.content.trim()) || 'Preview'}
                      warp={formatEl.text_warp}
                      amount={formatEl.text_warp_amount}
                      decoration={[formatEl.font_underline ? 'underline' : '', formatEl.font_strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || 'none'}
                    />
                  : ((formatEl.content && formatEl.content.trim()) || 'Preview')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}