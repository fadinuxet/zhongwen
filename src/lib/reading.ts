import { State } from 'ts-fsrs'
import type { Card } from '../db/db'
import { segment, type Dict } from './dict'

/** A word counts as "known" once you've started learning it (past the New state). */
export function isKnown(card: Card): boolean {
  return card.suspended === 0 && card.state !== State.New
}

export interface ReadableSentence {
  card: Card
  words: { text: string; known: boolean }[]
  knownCount: number
  total: number
  readable: boolean
  missing: string[]
}

/**
 * For every multi-character card, decide whether you can read it — i.e. every word
 * it segments into is also a word you've learned. Sorted: fully readable first, then
 * "almost there", by how many words you're missing.
 */
export function analyzeReadability(cards: Card[], dict: Dict): ReadableSentence[] {
  const knownCards = cards.filter(isKnown)
  const knownWords = new Set(knownCards.map((c) => c.hanzi))
  const knownChars = new Set<string>()
  for (const c of knownCards) for (const ch of c.hanzi) knownChars.add(ch)
  // A word is readable if you've learned it, or you know every character in it.
  const wordKnown = (w: string) => knownWords.has(w) || [...w].every((ch) => knownChars.has(ch))

  const out: ReadableSentence[] = []
  for (const c of cards) {
    if (c.suspended) continue
    if ([...c.hanzi].length < 2) continue
    const tokens = segment(c.hanzi, dict)
    if (tokens.length < 2) continue
    const words = tokens.map((t) => ({ text: t, known: wordKnown(t) }))
    const missing = [...new Set(words.filter((w) => !w.known).map((w) => w.text))]
    out.push({
      card: c,
      words,
      knownCount: words.filter((w) => w.known).length,
      total: words.length,
      readable: missing.length === 0,
      missing,
    })
  }
  out.sort((a, b) => a.missing.length - b.missing.length || b.total - a.total)
  return out
}

export interface WorldReadability {
  pct: number
  knownWords: number
  totalWords: number
}

/**
 * What share of the Chinese *you actually encounter* you can now read — weighted by
 * how often each word appeared in your captures (the `frequency` field).
 */
export function worldReadablePct(cards: Card[]): WorldReadability {
  let known = 0
  let total = 0
  let knownWords = 0
  let totalWords = 0
  for (const c of cards) {
    if (c.suspended) continue
    const f = Math.max(1, c.frequency ?? 1)
    total += f
    totalWords += 1
    if (isKnown(c)) {
      known += f
      knownWords += 1
    }
  }
  return { pct: total ? Math.round((known / total) * 100) : 0, knownWords, totalWords }
}
