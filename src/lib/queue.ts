import { State, type Grade } from 'ts-fsrs'
import { db, setMeta, getMeta, type Card } from '../db/db'
import { gradeCard } from './fsrs'
import { loadSettings, type Settings } from './settings'

/** Local-time YYYY-MM-DD, used to scope per-day counters. */
export function todayKey(d: Date = new Date()): string {
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

interface NewIntroCounter {
  date: string
  count: number
}

async function newIntroducedToday(): Promise<number> {
  const c = await getMeta<NewIntroCounter>('newIntro', { date: '', count: 0 })
  return c.date === todayKey() ? c.count : 0
}

async function bumpNewIntroduced(): Promise<void> {
  const today = todayKey()
  const c = await getMeta<NewIntroCounter>('newIntro', { date: '', count: 0 })
  const count = c.date === today ? c.count + 1 : 1
  await setMeta('newIntro', { date: today, count })
}

/**
 * Build the study queue: due reviews first (oldest due first), then up to the
 * remaining daily allowance of new cards (highest frequency first).
 */
export async function buildQueue(settings?: Settings): Promise<Card[]> {
  const s = settings ?? (await loadSettings())
  const now = Date.now()

  const dueReviews = await db.cards
    .where('due')
    .belowOrEqual(new Date(now))
    .and((c) => c.state !== State.New && c.suspended === 0)
    .toArray()
  dueReviews.sort((a, b) => a.due.getTime() - b.due.getTime())
  const reviews = dueReviews.slice(0, settings ? settings.maxReviews : s.maxReviews)

  const remainingNew = Math.max(0, s.newPerDay - (await newIntroducedToday()))
  let newCards: Card[] = []
  if (remainingNew > 0) {
    newCards = await db.cards
      .where('state')
      .equals(State.New)
      .and((c) => c.suspended === 0)
      .toArray()
    newCards.sort((a, b) => b.frequency - a.frequency || a.id! - b.id!)
    newCards = newCards.slice(0, remainingNew)
  }

  return [...reviews, ...newCards]
}

export interface TodayStats {
  due: number
  reviewedToday: number
  newRemaining: number
  total: number
  streak: number
}

export async function getTodayStats(): Promise<TodayStats> {
  const queue = await buildQueue()
  const reviewedToday = await db.reviews.where('reviewedAt').aboveOrEqual(startOfToday()).count()
  const remainingNew = Math.max(0, (await loadSettings()).newPerDay - (await newIntroducedToday()))
  const total = await db.cards.count()
  return {
    due: queue.length,
    reviewedToday,
    newRemaining: remainingNew,
    total,
    streak: await computeStreak(),
  }
}

/** Consecutive days (ending today or yesterday) with at least one review. */
async function computeStreak(): Promise<number> {
  const logs = await db.reviews.orderBy('reviewedAt').reverse().limit(2000).toArray()
  if (logs.length === 0) return 0
  const days = new Set(logs.map((l) => todayKey(new Date(l.reviewedAt))))
  let streak = 0
  const cursor = new Date()
  // Allow the streak to still count if nothing has been reviewed yet *today*.
  if (!days.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (days.has(todayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Commit a grade: update the card's FSRS state and append a review log. */
export async function recordReview(card: Card, rating: Grade, elapsedMs: number): Promise<void> {
  const wasNew = card.state === State.New
  const now = new Date()
  const next = gradeCard(card, rating, now)

  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.update(card.id!, {
      due: next.due,
      stability: next.stability,
      difficulty: next.difficulty,
      elapsed_days: next.elapsed_days,
      scheduled_days: next.scheduled_days,
      reps: next.reps,
      lapses: next.lapses,
      state: next.state,
      last_review: next.last_review,
      updatedAt: now.getTime(),
    })
    await db.reviews.add({
      cardId: card.id!,
      rating,
      reviewedAt: now.getTime(),
      elapsedMs,
    })
  })

  if (wasNew) await bumpNewIntroduced()
}
