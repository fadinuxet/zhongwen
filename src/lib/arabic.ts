import arData from '../data/seedAr.json'

/** Chinese → Arabic gloss map for the bundled starter vocabulary (keyed by hanzi). */
const AR = arData as Record<string, string>

/** Arabic translation for a hanzi word, or '' if the word isn't in the bundled map. */
export function arabicFor(hanzi: string): string {
  return AR[hanzi]?.trim() ?? ''
}

/**
 * Arabic gloss for a card. Prefers a value stored on the card (set at seed/capture
 * time) and falls back to the bundled map — so decks seeded before Arabic existed
 * still show translations, keyed by their unchanging hanzi.
 */
export function cardArabic(card: { hanzi: string; arabic?: string }): string {
  return card.arabic?.trim() || arabicFor(card.hanzi)
}
