import { createContext, useContext } from 'react';
import { LEGACY_CARD_SIZE, getCardSize } from '@/lib/cardGeometry';

// The card size of the story being shown (posts.card_size: '1:1', '4:5'),
// decision 45. Every card of a story has the same size, so it's provided once
// around a whole story — the builder (StoryCreator) and each story on a wall
// (StoryCard) — and every renderer underneath (canvas, thumbnails, preview,
// panels) reads the same value instead of each being passed its own copy.
// Without a provider it's square, which is what every story was before.
const CardFormatContext = createContext(LEGACY_CARD_SIZE);

export function CardFormatProvider({ value, children }) {
  return (
    <CardFormatContext.Provider value={getCardSize(value).id}>
      {children}
    </CardFormatContext.Provider>
  );
}

// The size id ('1:1', '4:5'); pass it to getCardSize() for the dimensions.
export function useCardFormat() {
  return useContext(CardFormatContext);
}
