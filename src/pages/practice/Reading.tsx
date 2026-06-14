import { useEffect, useMemo, useState } from 'react'
import { db, type Card } from '../../db/db'
import { ensureDict, type Dict } from '../../lib/dict'
import { analyzeReadability, type ReadableSentence } from '../../lib/reading'
import { useSettings } from '../../lib/SettingsContext'
import { speak, speechSupported } from '../../lib/speech'
import { SpeakerIcon } from '../../components/Icons'
import ArabicGloss from '../../components/ArabicGloss'

export default function Reading() {
  const { settings } = useSettings()
  const [cards, setCards] = useState<Card[] | null>(null)
  const [dict, setDict] = useState<Dict | null>(null)

  useEffect(() => {
    db.cards.toArray().then(setCards)
    ensureDict().then(setDict)
  }, [])

  const analysis = useMemo(() => (cards && dict ? analyzeReadability(cards, dict) : []), [cards, dict])
  const readable = useMemo(() => analysis.filter((s) => s.readable), [analysis])
  const almost = useMemo(() => analysis.filter((s) => s.missing.length === 1).slice(0, 30), [analysis])

  const play = (hanzi: string) => speak(hanzi, { voiceURI: settings.voiceURI, rate: settings.speechRate })

  if (!cards || !dict) {
    return <div className="px-4 pt-10 text-center text-slate-400">Loading…</div>
  }

  return (
    <div className="px-4 pt-safe sm:pt-8">
      <header className="mb-4 mt-4 px-1 sm:mt-0">
        <h1 className="text-2xl font-bold text-slate-900">Sentences you can read</h1>
        <p className="text-sm text-slate-500">
          Phrases from your deck unlock once you know every word in them.
        </p>
      </header>

      {readable.length === 0 && almost.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          Keep studying — sentences unlock here as you learn the words inside them.
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <span className="text-sm font-semibold text-emerald-700">✓ {readable.length} you can read</span>
          </div>
          <ul className="space-y-2">
            {readable.map((s) => (
              <li key={s.card.id}>
                <div className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-emerald-200">
                  <div className="min-w-0 flex-1">
                    <Sentence s={s} />
                    <div className="truncate text-sm text-sky-700">{s.card.pinyin}</div>
                    <div className="truncate text-sm text-slate-500">{s.card.english}</div>
                    <ArabicGloss card={s.card} className="truncate text-start text-sm text-slate-500" />
                  </div>
                  {speechSupported() && (
                    <button onClick={() => play(s.card.hanzi)} aria-label="Play" className="shrink-0 rounded-full bg-slate-100 p-2 text-slate-600 ring-1 ring-slate-200">
                      <SpeakerIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {almost.length > 0 && (
            <>
              <div className="mb-3 mt-6 px-1 text-sm font-semibold text-amber-700">
                ◷ Almost — learn one more word to unlock
              </div>
              <ul className="space-y-2">
                {almost.map((s) => (
                  <li key={s.card.id}>
                    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                      <Sentence s={s} />
                      <div className="mt-1 text-xs text-slate-500">
                        learn{' '}
                        <span className="font-hanzi font-semibold text-rose-600">{s.missing[0]}</span> to unlock
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Sentence({ s }: { s: ReadableSentence }) {
  return (
    <div className="font-hanzi text-xl leading-snug">
      {s.words.map((w, i) => (
        <span key={i} className={w.known ? 'text-slate-900' : 'text-rose-500'}>
          {w.text}
        </span>
      ))}
    </div>
  )
}
