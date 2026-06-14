import type { Card } from '../db/db'

export type Tone = 1 | 2 | 3 | 4 | 5

/** Detect the tone of a single-syllable pinyin from its diacritic. */
export function toneOf(pinyinStr: string): Tone {
  const d = pinyinStr.normalize('NFD')
  if (d.includes('̄')) return 1 // ā  macron
  if (d.includes('́')) return 2 // á  acute
  if (d.includes('̌')) return 3 // ǎ  caron
  if (d.includes('̀')) return 4 // à  grave
  return 5 // neutral / no mark
}

export interface ToneInfo {
  n: Tone
  label: string
  desc: string
  /** Tailwind color classes for the button accent. */
  color: string
}

export const TONES: ToneInfo[] = [
  { n: 1, label: '1st', desc: 'high · flat', color: 'text-rose-600' },
  { n: 2, label: '2nd', desc: 'rising', color: 'text-amber-600' },
  { n: 3, label: '3rd', desc: 'dip', color: 'text-emerald-600' },
  { n: 4, label: '4th', desc: 'falling', color: 'text-sky-600' },
  { n: 5, label: 'neutral', desc: 'light', color: 'text-slate-500' },
]

/** SVG path (in a 24×24 box) drawing each tone's pitch contour. */
export function toneContour(n: Tone): string {
  switch (n) {
    case 1:
      return 'M3 6 H21'
    case 2:
      return 'M4 19 L20 5'
    case 3:
      return 'M3 6 L8 18 L21 5'
    case 4:
      return 'M4 5 L20 19'
    default:
      return 'M11 12 h2'
  }
}

/** Single-character cards make clean one-tone targets for the trainer. */
export function toneTrainerPool(cards: Card[]): Card[] {
  return cards.filter((c) => c.suspended === 0 && [...c.hanzi].length === 1 && c.pinyin)
}
