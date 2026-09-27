// Color token system — each story maintains a set of named color tokens.
// Elements reference tokens by id instead of storing hardcoded colors.
// The same token can be used by different element types on different cards.

let _counter = 0;
export function generateTokenId() {
  return `tk-${Date.now()}-${_counter++}`;
}

// Resolve a token id to its color, falling back to the hardcoded value.
export function resolveColor(tokenId, tokens, fallback) {
  if (!tokenId || !tokens || !tokens.length) return fallback;
  const token = tokens.find(t => t.id === tokenId);
  return token?.color || fallback;
}

// Migrate a story's cards from hardcoded colors to tokens.
// Returns { cards, tokens } — cards now have background_token/color_token refs.
export function migrateToTokens(cards, existingTokens = []) {
  if (!cards || !cards.length) return { cards, tokens: existingTokens };

  const tokens = [...existingTokens];
  const colorToToken = {};
  tokens.forEach(t => {
    const key = t.color.toLowerCase();
    if (!colorToToken[key]) colorToToken[key] = t.id;
  });

  const getOrCreateToken = (color) => {
    if (!color) return null;
    const key = color.toLowerCase();
    if (colorToToken[key]) return colorToToken[key];
    const id = generateTokenId();
    tokens.push({ id, name: `Color ${tokens.length + 1}`, color });
    colorToToken[key] = id;
    return id;
  };

  const migratedCards = cards.map(card => {
    const newCard = { ...card };
    if (card.background_color && !card.background_token) {
      newCard.background_token = getOrCreateToken(card.background_color);
    }
    if (card.elements) {
      newCard.elements = card.elements.map(el => {
        if (el.type === 'text' && el.color && !el.color_token) {
          return { ...el, color_token: getOrCreateToken(el.color) };
        }
        return el;
      });
    }
    return newCard;
  });

  return { cards: migratedCards, tokens };
}

// Get the roles a token plays on a specific card.
export function getTokenRolesOnCard(card, tokenId) {
  const roles = [];
  if (card.background_token === tokenId) roles.push('Background');
  (card.elements || []).forEach(el => {
    if (el.type === 'text' && el.color_token === tokenId) {
      if (el.text_type === 'header') roles.push('Title');
      else if (el.text_type === 'subheader') roles.push('Subtitle');
      else roles.push('Body Text');
    }
  });
  return [...new Set(roles)];
}

// Get all tokens used on a card, enriched with their roles on that card.
export function getCardTokens(card, tokens) {
  const usedIds = new Set();
  if (card.background_token) usedIds.add(card.background_token);
  (card.elements || []).forEach(el => {
    if (el.type === 'text' && el.color_token) usedIds.add(el.color_token);
  });
  return [...usedIds].map(id => {
    const token = tokens.find(t => t.id === id);
    if (!token) return null;
    return { ...token, roles: getTokenRolesOnCard(card, id) };
  }).filter(Boolean);
}

// Update a token's color (story-wide change — all references update automatically).
export function updateTokenColor(tokens, tokenId, newColor) {
  return tokens.map(t => t.id === tokenId ? { ...t, color: newColor } : t);
}

// Create a new token.
export function createToken(color, tokens) {
  const id = generateTokenId();
  const name = `Color ${tokens.length + 1}`;
  return { id, name, color };
}

// Find an existing token by color, or create a new one.
// Returns { token, tokens } — tokens array includes the found/created token.
export function findOrCreateToken(color, tokens) {
  const key = color.toLowerCase();
  const existing = tokens.find(t => t.color.toLowerCase() === key);
  if (existing) return { token: existing, tokens };
  const token = createToken(color, tokens);
  return { token, tokens: [...tokens, token] };
}

// Apply a color change for a token, either story-wide or card-only.
// - storyWide=true: update the token's color → all cards/elements using it update.
// - storyWide=false: create a new token, reassign only this card's elements.
// Returns { cards, tokens }
export function applyTokenColorChange({ cards, tokens, cardIndex, tokenId, newColor, storyWide }) {
  if (storyWide) {
    // "Apply to all" = this color applies to the SAME ROLE(S) the selected
    // token plays on the current card, on EVERY card in the story —
    // regardless of which token each card previously used.
    //
    // We reassign the matching role on all cards to a fresh dedicated token
    // instead of mutating the original token. This is necessary because:
    //  (a) template stories create one token per distinct color, so other
    //      cards may use different tokens for the same role — mutating one
    //      token leaves them untouched;
    //  (b) a token may serve different roles on different cards (e.g.
    //      background here, title elsewhere) — mutating it would wrongly
    //      recolor those other roles.
    const roles = getTokenRolesOnCard(cards[cardIndex], tokenId);
    const newToken = createToken(newColor, tokens);
    const newTokens = [...tokens, newToken];
    const newCards = cards.map(c => {
      const nc = { ...c };
      if (roles.includes('Background')) {
        nc.background_token = newToken.id;
        nc.background_color = newColor;
      }
      if (c.elements) {
        nc.elements = c.elements.map(el => {
          if (el.type !== 'text') return el;
          const elRole =
            el.text_type === 'header' ? 'Title' :
            el.text_type === 'subheader' ? 'Subtitle' : 'Body Text';
          if (roles.includes(elRole)) {
            return { ...el, color_token: newToken.id, color: newColor };
          }
          return el;
        });
      }
      return nc;
    });
    return { cards: newCards, tokens: newTokens };
  }
  const newToken = createToken(newColor, tokens);
  const newTokens = [...tokens, newToken];
  const newCards = cards.map((c, i) => {
    if (i !== cardIndex) return c;
    const nc = { ...c };
    if (c.background_token === tokenId) {
      nc.background_token = newToken.id;
      nc.background_color = newColor;
    }
    if (c.elements) {
      nc.elements = c.elements.map(el => {
        if (el.type === 'text' && el.color_token === tokenId) {
          return { ...el, color_token: newToken.id, color: newColor };
        }
        return el;
      });
    }
    return nc;
  });
  return { cards: newCards, tokens: newTokens };
}