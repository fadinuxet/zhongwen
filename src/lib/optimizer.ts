import type { Card } from '../db/db'
import { isKnown } from './reading'

export interface WordSuggestion {
  card: Card
  /** How many currently-locked sentences this word would make fully readable. */
  unlocks: number
  /** How often it appears in your captures. */
  frequency: number
}

/**
 * The genius bit: rank the words you *haven't* learned by leverage — how many
 * locked sentences each would unlock, then how often it shows up in your captures.
 * The shortest path to reading your own world.
 */
export function suggestNextWords(cards: Card[], limit = 8): WordSuggestion[] {
  const knownChars = new Set<string>()
  for (const c of cards) if (isKnown(c)) for (const ch of c.hanzi) knownChars.add(ch)

  // Locked multi-character cards → the set of characters still blocking them.
  const locked: Set<string>[] = []
  for (const c of cards) {
    if (c.suspended || [...c.hanzi].length < 2) continue
    const missing = new Set<string>()
    for (const ch of c.hanzi) if (!knownChars.has(ch)) missing.add(ch)
    if (missing.size > 0 && missing.size <= 4) locked.push(missing)
  }

  // Only suggest atomic units worth learning — single characters and short words,
  // not whole phrases.
  const candidates = cards.filter(
    (c) => !isKnown(c) && c.suspended === 0 && c.hanzi && [...c.hanzi].length <= 2,
  )
  const scored = candidates.map((c) => {
    const chars = new Set([...c.hanzi])
    let unlocks = 0
    for (const miss of locked) {
      let covers = true
      for (const m of miss) {
        if (!chars.has(m)) {
          covers = false
          break
        }
      }
      if (covers) unlocks++
    }
    return { card: c, unlocks, frequency: c.frequency ?? 0 }
  })

  scored.sort(
    (a, b) => b.unlocks - a.unlocks || b.frequency - a.frequency || a.card.hanzi.localeCompare(b.card.hanzi),
  )
  return scored.filter((w) => w.unlocks > 0 || w.frequency > 1).slice(0, limit)
}
