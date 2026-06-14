import { pinyin } from 'pinyin-pro'
import type { Card } from '../db/db'

/* ------------------------------------------------------------------ *
 * Example sentence: a short carrier sentence built around the headword,
 * with pinyin from pinyin-pro. Only generated for simple word-type
 * entries — entries that are already phrases/sentences return null so we
 * never show grammatically wrong or duplicated Chinese.
 * ------------------------------------------------------------------ */

export interface Example {
  hanzi: string
  pinyin: string
  english: string
}

const IRREGULAR_VERB: Record<string, string> = {
  went: 'go', bought: 'buy', did: 'do', ate: 'eat', drank: 'drink', saw: 'see', came: 'come',
}

function firstSense(english: string): string {
  return english.split(/[/;,(]/)[0].trim().toLowerCase()
}

function mk(hanzi: string, english: string): Example {
  // Drop CJK punctuation (and the space pinyin-pro leaves before it) from the reading.
  const py = pinyin(hanzi, { toneType: 'symbol' })
    .replace(/[。，！？、「」]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { hanzi, pinyin: py, english }
}

export function exampleSentence(card: Card): Example | null {
  const cat = card.category
  const en = firstSense(card.english)

  // Verbs in this deck embed 我 (+了/过). Reduce to the base verb.
  if (cat === 'verbs') {
    const base = card.hanzi.replace(/^我/, '').replace(/[了过着]$/, '')
    if (!base || [...base].length > 3) return null
    let v = en.replace(/^(i|we|you|they|he|she)\s+/, '')
    v = IRREGULAR_VERB[v] ?? v
    return mk(`我想${base}。`, `I want to ${v}.`)
  }

  // Skip anything that is already a phrase or sentence.
  if ([...card.hanzi].length > 3) return null
  if (/[。！？，、,.!?]/.test(card.hanzi)) return null
  if (/你|您|他|她|它|们|吗|呢|吧|啊|嘛/.test(card.hanzi)) return null

  const w = card.hanzi
  switch (cat) {
    case 'food':
      return mk(`我想吃${w}。`, `I want to eat ${en}.`)
    case 'emotions':
      return mk(`我觉得很${w}。`, `I feel ${en}.`)
    case 'opposites':
      return mk(`它很${w}。`, `It is ${en}.`)
    case 'directions':
      return mk(`在${w}边。`, `On the ${en} side.`)
    case 'numbers':
      return mk(`我有${w}个。`, `I have ${en}.`)
    case 'body':
    case 'family':
      return mk(`这是我的${w}。`, `This is my ${en}.`)
    case 'zodiac':
    case 'nature':
      return mk(`我喜欢${w}。`, `I like ${en}.`)
    case 'characters':
      return mk(`这个字是${w}。`, `This character means "${en}".`)
    case 'furniture':
    case 'electronics':
    case 'transportation':
    case 'HSK1':
    case 'vocabulary':
      return mk(`这是${w}。`, `This is ${en}.`)
    default:
      return null
  }
}
