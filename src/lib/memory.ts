import { DECAY, FACTOR, State } from 'ts-fsrs'
import { db, type Card } from '../db/db'

/** Probability you'd recall a card right now (FSRS forgetting curve), 0–1. */
export function retrievability(card: Card, now = Date.now()): number {
  if (card.state === State.New || !card.last_review) return 0
  const days = Math.max(0, (now - new Date(card.last_review).getTime()) / 86400000)
  const r = Math.pow(1 + (FACTOR * days) / card.stability, DECAY)
  return Math.min(1, Math.max(0, r))
}

export interface DeckHealth {
  studied: number
  strong: number
  ok: number
  fading: number
  weak: number
  avg: number
}

export function deckHealth(cards: Card[], now = Date.now()): DeckHealth {
  let strong = 0
  let ok = 0
  let fading = 0
  let weak = 0
  let sum = 0
  let studied = 0
  for (const c of cards) {
    if (c.suspended || c.state === State.New) continue
    studied++
    const r = retrievability(c, now)
    sum += r
    if (r >= 0.9) strong++
    else if (r >= 0.75) ok++
    else if (r >= 0.5) fading++
    else weak++
  }
  return { studied, strong, ok, fading, weak, avg: studied ? sum / studied : 0 }
}

/** Studied cards most at risk of being forgotten (lowest retrievability first). */
export function fadingCards(cards: Card[], limit = 12, now = Date.now()): { card: Card; r: number }[] {
  return cards
    .filter((c) => !c.suspended && c.state !== State.New)
    .map((c) => ({ card: c, r: retrievability(c, now) }))
    .filter((x) => x.r < 0.85)
    .sort((a, b) => a.r - b.r)
    .slice(0, limit)
}

export interface DayCount {
  date: string
  count: number
}

function dayKey(ts: number): string {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}

/** Reviews-per-day for the last `days` days (for a contribution-style heatmap). */
export async function reviewHeatmap(days = 119): Promise<DayCount[]> {
  const since = Date.now() - days * 86400000
  const logs = await db.reviews.where('reviewedAt').aboveOrEqual(since).toArray()
  const counts = new Map<string, number>()
  for (const l of logs) counts.set(dayKey(l.reviewedAt), (counts.get(dayKey(l.reviewedAt)) ?? 0) + 1)
  const out: DayCount[] = []
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start.getTime() - i * 86400000)
    const key = dayKey(d.getTime())
    out.push({ date: key, count: counts.get(key) ?? 0 })
  }
  return out
}

export interface ToneConfusion {
  target: string
  chosen: string
  count: number
}

export async function toneConfusions(): Promise<ToneConfusion[]> {
  const all = await db.confusions.where('type').equals('tone').toArray()
  const m = new Map<string, number>()
  for (const c of all) {
    const k = `${c.target}>${c.chosen}`
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([k, count]) => {
      const [target, chosen] = k.split('>')
      return { target, chosen, count }
    })
    .sort((a, b) => b.count - a.count)
}

export async function quizMisses(limit = 8): Promise<{ cardId: number; count: number }[]> {
  const all = await db.confusions.where('type').equals('quiz').toArray()
  const m = new Map<number, number>()
  for (const c of all) m.set(c.cardId, (m.get(c.cardId) ?? 0) + 1)
  return [...m.entries()]
    .map(([cardId, count]) => ({ cardId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
