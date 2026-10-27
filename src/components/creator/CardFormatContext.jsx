import { createContext, useContext } from 'react';
import { LEGACY_CARD_SIZE, cardSizeOf, getCardSize } from '@/lib/cardGeometry';

// The fallback card size for the cards being shown (decision 45). Each card
// stores its own size (card.card_size); this only covers cards saved before
// that, which take their story's posts.card_size. It's provided once around
// a story (StoryCard on a wall, DraftEntry per draft, TemplateRow per
// template); without a provider it's square, which is what every card was
// before card sizes.
const CardFormatContext = createContext(LEGACY_CARD_SIZE);

export function CardFormatProvider({ value, children }) {
  return (
    <CardFormatContext.Provider value={getCardSize(value).id}>
      {children}
    </CardFormatContext.Provider>
  );
}

// The fallback size id ('1:1', '4:5', …) of the story being shown.
export function useCardFormat() {
  return useContext(CardFormatContext);
}

// The size of one card ({ id, width, height, exportWidth, exportHeight }):
// its own, else its story's. Every renderer sizes a card through this.
export function useCardSize(card) {
  return getCardSize(cardSizeOf(card, useContext(CardFormatContext)));
}
