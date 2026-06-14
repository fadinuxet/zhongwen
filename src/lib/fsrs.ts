import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs'
import type { Card } from '../db/db'

const params = generatorParameters({
  enable_fuzz: true,
  maximum_interval: 36500,
})

const scheduler = fsrs(params)

/** The four grading buttons, in display order. */
export const RATINGS = [
  { rating: Rating.Again, label: 'Again', hint: '<1m', color: 'bg-rose-600 hover:bg-rose-500' },
  { rating: Rating.Hard, label: 'Hard', hint: '', color: 'bg-amber-600 hover:bg-amber-500' },
  { rating: Rating.Good, label: 'Good', hint: '', color: 'bg-emerald-600 hover:bg-emerald-500' },
  { rating: Rating.Easy, label: 'Easy', hint: '', color: 'bg-sky-600 hover:bg-sky-500' },
] as const

/** FSRS state fields for a brand-new card (immediately due). */
export function freshScheduling(now: Date = new Date()): FsrsCard {
  return createEmptyCard(now)
}

/** Pull the FSRS-relevant fields out of a stored Card record. */
function toFsrsCard(card: Card): FsrsCard {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review,
  }
}

/** Grade a card and return its next FSRS state. */
export function gradeCard(card: Card, rating: Grade, now: Date = new Date()): FsrsCard {
  const { card: next } = scheduler.next(toFsrsCard(card), now, rating)
  return next
}

/** Preview the next interval for every rating without committing — used on grade buttons. */
export function previewIntervals(card: Card, now: Date = new Date()): Record<number, string> {
  const out: Record<number, string> = {}
  for (const { rating } of RATINGS) {
    const { card: next } = scheduler.next(toFsrsCard(card), now, rating as Grade)
    out[rating] = formatInterval(next.due.getTime() - now.getTime())
  }
  return out
}

function formatInterval(ms: number): string {
  const mins = ms / 60000
  if (mins < 1) return '<1m'
  if (mins < 60) return `${Math.round(mins)}m`
  const hours = mins / 60
  if (hours < 24) return `${Math.round(hours)}h`
  const days = hours / 24
  if (days < 30) return `${Math.round(days)}d`
  const months = days / 30
  if (months < 12) return `${Math.round(months)}mo`
  return `${(days / 365).toFixed(1)}y`
}
