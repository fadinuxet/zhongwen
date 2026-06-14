import type { Card } from '../db/db'

export type QuizMode = 'mc' | 'type' | 'listen'
export type QuizDirection = 'cn-en' | 'en-cn'

export interface QuizOptions {
  mode: QuizMode
  direction: QuizDirection
  category: string // 'all' or a category name
  count: number
}

export interface Option {
  text: string
  sub?: string
}

export interface Question {
  kind: QuizMode
  card: Card
  promptMain: string
  promptSub?: string
  /** When set, a speaker control plays this hanzi (auto-played for listening). */
  audioText?: string
  // multiple-choice / listening
  options?: Option[]
  answerIndex?: number
  // typing
  expected?: string[]
  checkKind?: 'english' | 'pinyin'
  inputHint?: string
  correctText?: string
}

const firstSense = (english: string) => english.split(/[/;,]/)[0].trim()

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}

/** Pick distractor cards, preferring the same category for plausibility. */
function distractors(pool: Card[], target: Card, valueOf: (c: Card) => string, n: number): Card[] {
  const used = new Set([valueOf(target)])
  const pick = (from: Card[]) => {
    const out: Card[] = []
    for (const c of shuffle(from)) {
      const v = valueOf(c)
      if (c.id === target.id || used.has(v)) continue
      used.add(v)
      out.push(c)
      if (out.length >= n) break
    }
    return out
  }
  const sameCat = pick(pool.filter((c) => c.category === target.category))
  if (sameCat.length >= n) return sameCat
  return [...sameCat, ...pick(pool)].slice(0, n)
}

export function buildQuiz(allCards: Card[], opts: QuizOptions): Question[] {
  const usable = allCards.filter((c) => c.suspended === 0 && c.hanzi && c.english)
  const pool = opts.category === 'all' ? usable : usable.filter((c) => c.category === opts.category)
  if (pool.length < 4) return []

  const targets = sample(pool, Math.min(opts.count, pool.length))
  return targets.map((card) => makeQuestion(card, pool, opts))
}

function makeQuestion(card: Card, pool: Card[], opts: QuizOptions): Question {
  const correctEn = firstSense(card.english)

  if (opts.mode === 'listen') {
    const ds = distractors(pool, card, (c) => c.hanzi, 3)
    const opt = shuffle([card, ...ds])
    return {
      kind: 'listen',
      card,
      promptMain: '🔊',
      promptSub: 'Listen, then choose the word',
      audioText: card.hanzi,
      options: opt.map((c) => ({ text: c.hanzi, sub: c.pinyin })),
      answerIndex: opt.findIndex((c) => c.id === card.id),
    }
  }

  if (opts.mode === 'type') {
    if (opts.direction === 'cn-en') {
      return {
        kind: 'type',
        card,
        promptMain: card.hanzi,
        promptSub: card.pinyin,
        audioText: card.hanzi,
        checkKind: 'english',
        expected: card.english.split(/[/;,]/).map((s) => normText(s)).filter(Boolean),
        inputHint: 'Type the meaning in English',
        correctText: card.english,
      }
    }
    return {
      kind: 'type',
      card,
      promptMain: correctEn,
      checkKind: 'pinyin',
      expected: [normPinyin(card.pinyin)],
      inputHint: 'Type the pinyin (tones optional)',
      correctText: `${card.hanzi} · ${card.pinyin}`,
    }
  }

  // multiple choice
  if (opts.direction === 'cn-en') {
    const ds = distractors(pool, card, (c) => firstSense(c.english), 3)
    const opt = shuffle([card, ...ds])
    return {
      kind: 'mc',
      card,
      promptMain: card.hanzi,
      promptSub: card.pinyin,
      audioText: card.hanzi,
      options: opt.map((c) => ({ text: firstSense(c.english) })),
      answerIndex: opt.findIndex((c) => c.id === card.id),
    }
  }
  const ds = distractors(pool, card, (c) => c.hanzi, 3)
  const opt = shuffle([card, ...ds])
  return {
    kind: 'mc',
    card,
    promptMain: correctEn,
    options: opt.map((c) => ({ text: c.hanzi, sub: c.pinyin })),
    answerIndex: opt.findIndex((c) => c.id === card.id),
  }
}

// --- answer normalization ---

function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normPinyin(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip tone marks
    .replace(/v/g, 'u') // common ü → v typing
    .replace(/[^a-z]/g, '') // drop spaces, digits, punctuation
}

export function checkTyped(q: Question, raw: string): boolean {
  if (!q.expected) return false
  if (q.checkKind === 'pinyin') {
    const a = normPinyin(raw)
    return a.length > 0 && q.expected.includes(a)
  }
  const a = normText(raw)
  if (!a) return false
  return q.expected.some((e) => e === a || (a.length >= 3 && (e.includes(a) || a.includes(e))))
}

/** Categories present in the deck (for the quiz scope selector). */
export function quizCategories(cards: Card[]): { cat: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const c of cards) if (c.suspended === 0) counts.set(c.category, (counts.get(c.category) ?? 0) + 1)
  return [...counts.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).map(([cat, count]) => ({ cat, count }))
}
