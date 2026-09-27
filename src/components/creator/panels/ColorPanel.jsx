import { useState } from 'react';
import ColorPicker from '@/components/creator/ColorPicker';
import { getCardTokens } from '@/lib/colorTokens';

// Card Theme panel — gallery + edit mode pattern.
// Gallery view: list of all color tokens on the card (Background + Fonts).
// Edit mode: color picker for a single token with a per-item "Apply to all"
// checkbox next to the hex field. Unchecked (default) = current card only;
// checked = every card in the story. The checkbox resets to unchecked each
// time an item is opened.
export default function ColorPanel({ card, tokens, cardIndex, onApplyTokenColor, onPreviewColor }) {
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [applyToAll, setApplyToAll] = useState(false);
  const [originalColor, setOriginalColor] = useState(null);

  // ── Edit mode: color picker for a selected token ──
  if (selectedTokenId) {
    const token = tokens.find(t => t.id === selectedTokenId);

    // Checking "Apply to all" re-commits the current color story-wide
    // immediately, so the order (checkbox before vs. after color pick)
    // doesn't matter — checking the box at any point applies the current
    // color to every card.
    const handleApplyToAllChange = (checked) => {
      setApplyToAll(checked);
      if (!checked) return;
      const currentColor = token?.color || '#000000';
      const newTokenId = onApplyTokenColor({
        tokenId: selectedTokenId,
        newColor: currentColor,
        storyWide: true,
        originalColor,
      });
      if (newTokenId && newTokenId !== selectedTokenId) {
        setSelectedTokenId(newTokenId);
      }
      setOriginalColor(currentColor);
    };

    return (
      <ColorPicker
        color={token?.color || '#000000'}
        applyToAll={applyToAll}
        onApplyToAllChange={handleApplyToAllChange}
        onChange={(c) => onPreviewColor?.({ tokenId: selectedTokenId, newColor: c })}
        onCommit={(finalColor) => {
          const newTokenId = onApplyTokenColor({
            tokenId: selectedTokenId,
            newColor: finalColor,
            storyWide: applyToAll,
            originalColor,
          });
          // Track the token that now represents this color on the card.
          // Both card-only and story-wide commits create a new dedicated
          // token — update selectedTokenId so subsequent live-preview picks
          // update the token the card actually uses, not the stale original.
          if (newTokenId && newTokenId !== selectedTokenId) {
            setSelectedTokenId(newTokenId);
          }
          setOriginalColor(finalColor);
        }}
        onClose={() => { setSelectedTokenId(null); setApplyToAll(false); }}
        dark
      />
    );
  }

  // ── Gallery view: all color tokens on this card ──
  const cardTokens = getCardTokens(card, tokens);

  const openToken = (t) => {
    setApplyToAll(false);
    setOriginalColor(t.color);
    setSelectedTokenId(t.id);
  };

  return (
    <div className="px-4 py-3">
      {cardTokens.length === 0 ? (
        <p className="text-white/30 text-xs">No color tokens on this card yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cardTokens.map(t => (
            <button
              key={t.id}
              onClick={() => openToken(t)}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
            >
              <div
                className="w-8 h-8 rounded-lg border border-white/20 flex-shrink-0"
                style={{ backgroundColor: t.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium">{t.roles.join(', ')}</div>
                <div className="text-white/40 text-xs font-mono">{t.color}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}