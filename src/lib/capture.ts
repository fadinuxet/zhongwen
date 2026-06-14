import { pinyin } from 'pinyin-pro'
import { Rating, State } from 'ts-fsrs'
import { db, type Card, type CardSource } from '../db/db'
import { freshScheduling, gradeCard } from './fsrs'
import { arabicFor } from './arabic'

/** A candidate card awaiting review in the capture tray. */
export interface Draft {
  hanzi: string
  pinyin: string
  english: string
  category: string
  source: CardSource
}

export function makeDraft(
  hanzi: string,
  english: string,
  source: CardSource,
  category = 'captured',
): Draft {
  return {
    hanzi,
    pinyin: pinyin(hanzi, { toneType: 'symbol' }),
    english,
    category,
    source,
  }
}

/** Which of the given hanzi already exist in the deck (so we don't add duplicates). */
export async function existingHanzi(hanzis: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  if (hanzis.length === 0) return found
  await db.cards
    .where('hanzi')
    .anyOf(hanzis)
    .each((c) => found.add(c.hanzi))
  return found
}

export interface SaveResult {
  saved: number
  /** Re-encountered words that were due, so the sighting counted as a review. */
  wildReviews: number
  /** Re-encountered words that weren't due yet — noted, not rescheduled. */
  wildNoted: number
}

/**
 * Record a real-world re-encounter of a word you already have. Bumps how often
 * you've seen it, and — if the card was due — treats the sighting as a "Good"
 * review (seeing it in the wild IS a repetition). Returns true if it counted as a review.
 */
async function recordWildSighting(card: Card, now: number): Promise<boolean> {
  const dueNow = card.state !== State.New && card.due.getTime() <= now
  const patch: Partial<Card> = {
    frequency: (card.frequency ?? 0) + 1,
    wildSightings: (card.wildSightings ?? 0) + 1,
    lastSeenWild: now,
    updatedAt: now,
  }
  if (dueNow) {
    const next = gradeCard(card, Rating.Good, new Date(now))
    Object.assign(patch, {
      due: next.due,
      stability: next.stability,
      difficulty: next.difficulty,
      elapsed_days: next.elapsed_days,
      scheduled_days: next.scheduled_days,
      reps: next.reps,
      lapses: next.lapses,
      state: next.state,
      last_review: next.last_review,
    })
  }
  await db.cards.update(card.id!, patch)
  if (dueNow) await db.reviews.add({ cardId: card.id!, rating: Rating.Good, reviewedAt: now, elapsedMs: 0 })
  return dueNow
}

/**
 * Persist reviewed drafts. New words become cards; words already in your deck are
 * recorded as "seen in the wild" re-encounters (which can count as reviews).
 */
export async function saveDrafts(drafts: Draft[]): Promise<SaveResult> {
  const now = Date.now()
  const hanzis = [...new Set(drafts.map((d) => d.hanzi.trim()).filter(Boolean))]
  const existing = await db.cards.where('hanzi').anyOf(hanzis).toArray()
  const existingByHanzi = new Map(existing.map((c) => [c.hanzi, c]))

  const seen = new Set<string>()
  const toAdd: Card[] = []
  let wildReviews = 0
  let wildNoted = 0
  for (const d of drafts) {
    const hz = d.hanzi.trim()
    if (!hz || seen.has(hz)) continue
    seen.add(hz)
    const known = existingByHanzi.get(hz)
    if (known) {
      ;(await recordWildSighting(known, now)) ? wildReviews++ : wildNoted++
      continue
    }
    toAdd.push({
      hanzi: hz,
      pinyin: d.pinyin || pinyin(hz, { toneType: 'symbol' }),
      english: d.english.trim(),
      arabic: arabicFor(hz) || undefined,
      category: d.category.trim() || 'captured',
      frequency: 0,
      sourceFiles: '',
      source: d.source,
      tags: [],
      suspended: 0,
      createdAt: now,
      updatedAt: now,
      ...freshScheduling(new Date(now)),
    })
  }
  if (toAdd.length) await db.cards.bulkAdd(toAdd)
  return { saved: toAdd.length, wildReviews, wildNoted }
}
