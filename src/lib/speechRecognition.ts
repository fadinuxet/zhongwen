import { pinyin } from 'pinyin-pro'
import type { Card } from '../db/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Browser speech recognition (Web Speech API). Free, but routes audio online. */
export function recognitionSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

export interface Recognition {
  promise: Promise<string[]>
  stop: () => void
}

/** Listen once and resolve with the recognized alternatives (best first). */
export function recognizeOnce(lang = 'zh-CN'): Recognition {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  const rec = new Ctor()
  rec.lang = lang
  rec.interimResults = false
  rec.maxAlternatives = 5
  rec.continuous = false

  let settled = false
  const finish = (fn: () => void) => {
    if (settled) return
    settled = true
    fn()
  }

  const promise = new Promise<string[]>((resolve, reject) => {
    rec.onresult = (e: any) => {
      const res = e.results[0]
      const alts: string[] = []
      for (let i = 0; i < res.length; i++) alts.push(String(res[i].transcript))
      finish(() => resolve(alts))
    }
    rec.onerror = (e: any) => finish(() => reject(new Error(e?.error || 'recognition-error')))
    rec.onend = () => finish(() => resolve([]))
    try {
      rec.start()
    } catch (e) {
      finish(() => reject(e))
    }
  })

  return { promise, stop: () => { try { rec.stop() } catch { /* noop */ } } }
}

function normPinyin(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')
}

export type Verdict = 'correct' | 'wrong'

/**
 * Compare what the recognizer heard to the target word. Matches on the hanzi or
 * on toneless pinyin (so the right syllables count even if the tone wobbles).
 */
export function pronunciationVerdict(target: Card, transcripts: string[]): { verdict: Verdict; heard: string } {
  const heard = transcripts[0] ?? ''
  const tHanzi = target.hanzi
  const tPin = normPinyin(target.pinyin)
  for (const tr of transcripts) {
    const clean = tr.replace(/\s/g, '')
    if (!clean) continue
    if (clean === tHanzi || clean.includes(tHanzi)) return { verdict: 'correct', heard: clean }
    const trPin = normPinyin(pinyin(clean, { toneType: 'none' }))
    if (trPin && trPin === tPin) return { verdict: 'correct', heard: clean }
  }
  return { verdict: 'wrong', heard }
}
