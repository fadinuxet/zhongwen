import Dexie, { type Table } from 'dexie'
import { State } from 'ts-fsrs'

export type CardSource = 'seed' | 'manual' | 'paste' | 'screenshot' | 'photo'

/**
 * A study card. FSRS scheduling state is embedded flat on the record so it can be
 * passed straight into ts-fsrs and so `due`/`state` can be indexed by IndexedDB.
 */
export interface Card {
  id?: number
  hanzi: string
  pinyin: string
  english: string
  category: string
  frequency: number
  sourceFiles: string
  source: CardSource
  tags: string[]
  /** User flag: suspended cards are hidden from the review/Today queue. */
  suspended: 0 | 1
  /** Times this word was re-encountered "in the wild" (re-captured) after learning it. */
  wildSightings?: number
  lastSeenWild?: number
  createdAt: number
  updatedAt: number

  // --- Embedded FSRS card state ---
  due: Date
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  state: State
  last_review?: Date
}

export interface ReviewLog {
  id?: number
  cardId: number
  rating: number
  reviewedAt: number
  elapsedMs: number
}

/** A wrong answer in a quiz/tone drill — feeds the confusion radar. */
export interface Confusion {
  id?: number
  type: 'tone' | 'quiz'
  cardId: number
  /** The correct answer (tone number as string, or the card hanzi). */
  target: string
  /** What the user chose instead. */
  chosen: string
  at: number
}

/** Arbitrary key/value store for settings, the seed flag, and daily counters. */
export interface MetaRow {
  key: string
  value: unknown
}

export class StudyDB extends Dexie {
  cards!: Table<Card, number>
  reviews!: Table<ReviewLog, number>
  meta!: Table<MetaRow, string>
  confusions!: Table<Confusion, number>

  constructor() {
    super('zhongwen')
    this.version(1).stores({
      cards: '++id, category, frequency, due, state, suspended, hanzi',
      reviews: '++id, cardId, reviewedAt',
      meta: 'key',
    })
    this.version(2).stores({
      confusions: '++id, type, at',
    })
  }
}

/** Log a wrong answer for the confusion radar (best-effort). */
export async function logConfusion(c: Omit<Confusion, 'id'>): Promise<void> {
  try {
    await db.confusions.add(c)
  } catch {
    /* non-critical */
  }
}

export const db = new StudyDB()

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
