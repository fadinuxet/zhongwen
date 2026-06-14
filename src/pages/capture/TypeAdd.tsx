import { useEffect, useMemo, useState } from 'react'
import { ensureDict, lookupGloss, searchEnglish, segment, type Dict, type EnHit } from '../../lib/dict'
import { makeDraft, type Draft } from '../../lib/capture'
import { pinyin } from 'pinyin-pro'

interface Props {
  onAdd: (drafts: Draft[]) => void
}

const firstSense = (gloss: string) => gloss.split('; ')[0] ?? ''

export default function TypeAdd({ onAdd }: Props) {
  const [q, setQ] = useState('')
  const [dict, setDict] = useState<Dict | null>(null)
  const [hits, setHits] = useState<EnHit[]>([])

  useEffect(() => {
    ensureDict().then(setDict).catch(() => setDict(null))
  }, [])

  const hasCJK = /[㐀-鿿]/.test(q)

  const tokens = useMemo(() => {
    if (!dict || !hasCJK || !q.trim()) return []
    const seg = segment(q, dict)
    return [...new Set(seg)]
  }, [q, dict, hasCJK])

  // English → Chinese, debounced (full-dictionary scan).
  useEffect(() => {
    if (!dict || hasCJK || q.trim().length < 1) {
      setHits([])
      return
    }
    const t = setTimeout(() => setHits(searchEnglish(q, dict, 40)), 250)
    return () => clearTimeout(t)
  }, [q, dict, hasCJK])

  const addToken = (w: string) => onAdd([makeDraft(w, firstSense(lookupGloss(w, dict!)), 'manual')])
  const addHit = (h: EnHit) => onAdd([makeDraft(h.hanzi, firstSense(h.gloss), 'manual')])
  const addWholePhrase = () => onAdd([makeDraft(q.trim(), firstSense(lookupGloss(q.trim(), dict!)), 'manual')])

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type English or Chinese…"
        autoFocus
        className="w-full rounded-xl bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {!dict ? (
        <p className="mt-4 text-center text-sm text-slate-400">Loading dictionary…</p>
      ) : !q.trim() ? (
        <p className="mt-4 text-center text-sm text-slate-400">
          Type an English word to find the Chinese, or paste Chinese to split it into words.
        </p>
      ) : hasCJK ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-slate-500">Tap a word to add</span>
            <button onClick={addWholePhrase} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              + Add whole phrase
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tokens.map((w) => {
              const gloss = lookupGloss(w, dict)
              return (
                <button
                  key={w}
                  onClick={() => addToken(w)}
                  className="rounded-xl bg-white px-3 py-2 text-left ring-1 ring-slate-200 hover:ring-brand-400"
                >
                  <div className="font-hanzi text-lg leading-tight text-slate-900">{w}</div>
                  <div className="text-[11px] leading-tight text-sky-600">{pinyin(w, { toneType: 'symbol' })}</div>
                  <div className="max-w-[40ch] truncate text-[11px] text-slate-500">{firstSense(gloss) || '—'}</div>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-2 px-1 text-xs font-medium text-slate-500">
            {hits.length ? 'Tap a match to add' : 'No matches found'}
          </div>
          <ul className="space-y-2">
            {hits.map((h) => (
              <li key={h.hanzi}>
                <button
                  onClick={() => addHit(h)}
                  className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-slate-200 hover:ring-brand-400"
                >
                  <div className="font-hanzi text-xl font-semibold text-slate-900">{h.hanzi}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-sky-600">{pinyin(h.hanzi, { toneType: 'symbol' })}</div>
                    <div className="truncate text-sm text-slate-600">{h.gloss}</div>
                  </div>
                  <span className="shrink-0 text-lg text-brand-500">+</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
