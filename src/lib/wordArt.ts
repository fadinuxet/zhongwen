import artMap from '../data/artMap.json'
import type { Card } from '../db/db'

const KEYWORDS = artMap.keywords as [string[], string][]
const CATEGORIES = artMap.categories as Record<string, string>

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const charCache = new Map<string, string>()

/** Pick the OpenMoji concept (an emoji char) that best matches a card's meaning. */
export function wordEmojiChar(card: Card): string {
  const key = card.english + '|' + card.category
  const hit = charCache.get(key)
  if (hit) return hit
  const text = card.english.toLowerCase()
  let e = ''
  for (const [keywords, emoji] of KEYWORDS) {
    if (keywords.some((k) => new RegExp(`(^|[^a-z])${escapeRe(k)}([^a-z]|$)`).test(text))) {
      e = emoji
      break
    }
  }
  if (!e) e = CATEGORIES[card.category] ?? CATEGORIES[''] ?? '📖'
  charCache.set(key, e)
  return e
}

/** Emoji → OpenMoji filename slug (codepoints, uppercase hex, FE0F stripped). */
export function emojiToSlug(emoji: string): string {
  return [...emoji]
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16).toUpperCase())
    .join('-')
}

/** Path to the bundled OpenMoji illustration for a card. */
export function wordArtSrc(card: Card): string {
  return `${import.meta.env.BASE_URL}openmoji/${emojiToSlug(wordEmojiChar(card))}.svg`
}
