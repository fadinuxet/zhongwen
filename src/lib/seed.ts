import { db, getMeta, setMeta, type Card } from '../db/db'
import { freshScheduling } from './fsrs'
import { arabicFor } from './arabic'
import seedData from '../data/seed.json'

interface SeedRow {
  hanzi: string
  pinyin: string
  english: string
  category: string
  frequency: number
  source_files: string
}

const SEED_FLAG = 'seeded'

// Shared across concurrent callers (e.g. React StrictMode's double-invoked effect)
// so the seed can never run twice and duplicate the deck.
let seedPromise: Promise<void> | null = null

/** Populate the deck from the bundled starter dataset on first launch. Idempotent. */
export function ensureSeeded(): Promise<void> {
  if (!seedPromise) seedPromise = doSeed()
  return seedPromise
}

async function doSeed(): Promise<void> {
  const already = await getMeta<boolean>(SEED_FLAG, false)
  if (already) return

  const now = Date.now()
  const rows = seedData as SeedRow[]
  const cards: Card[] = rows.map((r) => {
    const fsrs = freshScheduling(new Date(now))
    return {
      hanzi: r.hanzi,
      pinyin: r.pinyin ?? '',
      english: r.english ?? '',
      arabic: arabicFor(r.hanzi) || undefined,
      category: r.category?.trim() || 'uncategorized',
      frequency: r.frequency ?? 0,
      sourceFiles: r.source_files ?? '',
      source: 'seed',
      tags: [],
      suspended: 0,
      createdAt: now,
      updatedAt: now,
      ...fsrs,
    }
  })

  // Run the empty-check and insert inside one transaction so two callers can't
  // both observe an empty table and both seed.
  await db.transaction('rw', db.cards, db.meta, async () => {
    if ((await db.cards.count()) === 0) await db.cards.bulkAdd(cards)
    await setMeta(SEED_FLAG, true)
  })
}

/**
 * Remove duplicate cards (same hanzi), keeping the most-studied copy. Self-healing
 * cleanup for decks that got double-seeded by an earlier race. Returns # removed.
 */
export async function dedupeDeck(): Promise<number> {
  const all = await db.cards.toArray()
  const byHanzi = new Map<string, typeof all>()
  for (const c of all) {
    const arr = byHanzi.get(c.hanzi)
    if (arr) arr.push(c)
    else byHanzi.set(c.hanzi, [c])
  }
  const toDelete: number[] = []
  for (const group of byHanzi.values()) {
    if (group.length < 2) continue
    // Keep the most reviewed, then the oldest, then lowest id; drop the rest.
    group.sort((a, b) => b.reps - a.reps || a.createdAt - b.createdAt || a.id! - b.id!)
    for (const c of group.slice(1)) toDelete.push(c.id!)
  }
  if (toDelete.length) await db.cards.bulkDelete(toDelete)
  return toDelete.length
}
