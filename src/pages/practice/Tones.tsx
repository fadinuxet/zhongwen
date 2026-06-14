import { useEffect, useMemo, useState } from 'react'
import { db, logConfusion, type Card } from '../../db/db'
import { useSettings } from '../../lib/SettingsContext'
import { speak } from '../../lib/speech'
import { TONES, toneContour, toneOf, toneTrainerPool, type Tone } from '../../lib/tones'
import { SpeakerIcon } from '../../components/Icons'

type Phase = 'setup' | 'playing' | 'done'

function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

function ToneGlyph({ n, className = '' }: { n: Tone; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={toneContour(n)} />
    </svg>
  )
}

export default function Tones() {
  const { settings } = useSettings()
  const [all, setAll] = useState<Card[] | null>(null)
  const [phase, setPhase] = useState<Phase>('setup')
  const [count, setCount] = useState(15)

  const [items, setItems] = useState<Card[]>([])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState<Tone | null>(null)

  useEffect(() => {
    db.cards.toArray().then(setAll)
  }, [])

  const pool = useMemo(() => (all ? toneTrainerPool(all) : []), [all])
  const current = items[idx]
  const answer = current ? toneOf(current.pinyin) : 5

  const play = (c: Card) => speak(c.hanzi, { voiceURI: settings.voiceURI, rate: settings.speechRate })

  function start() {
    setItems(sample(pool, Math.min(count, pool.length)))
    setIdx(0)
    setScore(0)
    setPicked(null)
    setPhase('playing')
  }

  // Auto-play each syllable.
  useEffect(() => {
    if (phase === 'playing' && current) play(current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, phase])

  function pick(t: Tone) {
    if (picked !== null) return
    setPicked(t)
    if (t === answer) setScore((s) => s + 1)
    else if (current) logConfusion({ type: 'tone', cardId: current.id!, target: String(answer), chosen: String(t), at: Date.now() })
  }

  function next() {
    if (idx + 1 >= items.length) setPhase('done')
    else {
      setIdx((i) => i + 1)
      setPicked(null)
    }
  }

  if (!all) return <div className="px-4 pt-10 text-center text-slate-400">Loading…</div>

  if (phase === 'playing' && current) {
    const pct = Math.round((idx / items.length) * 100)
    const answered = picked !== null
    return (
      <div className="px-4 pt-safe sm:pt-8">
        <div className="flex items-center gap-3 pt-3 sm:pt-0">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs tabular-nums text-slate-400">{idx + 1}/{items.length}</span>
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-600">{score}</span>
        </div>

        {/* Listen (the word is hidden until answered so you judge by ear) */}
        <div className="flex flex-col items-center py-8 text-center">
          <button
            onClick={() => play(current)}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-sky-200 active:scale-95"
            aria-label="Replay"
          >
            <SpeakerIcon className="h-10 w-10" />
          </button>
          <p className="mt-3 text-sm text-slate-400">Which tone did you hear?</p>
          {answered && (
            <div className="mt-4">
              <div className="font-hanzi text-5xl font-bold text-slate-900">{current.hanzi}</div>
              <div className="mt-1 text-xl text-sky-600">{current.pinyin}</div>
              <div className="text-sm text-slate-500">{current.english}</div>
            </div>
          )}
        </div>

        {/* Tone choices */}
        <div className="grid grid-cols-5 gap-2">
          {TONES.map((t) => {
            const isAnswer = t.n === answer
            const isPicked = t.n === picked
            const cls = !answered
              ? 'bg-white ring-slate-200 hover:ring-sky-400'
              : isAnswer
                ? 'bg-emerald-50 ring-emerald-400'
                : isPicked
                  ? 'bg-rose-50 ring-rose-400'
                  : 'bg-white ring-slate-200 opacity-50'
            return (
              <button
                key={t.n}
                onClick={() => pick(t.n)}
                disabled={answered}
                className={`flex flex-col items-center gap-1 rounded-xl py-3 ring-1 transition-colors ${cls}`}
              >
                <ToneGlyph n={t.n} className={`h-6 w-9 ${answered && isAnswer ? 'text-emerald-600' : t.color}`} />
                <span className="text-xs font-semibold text-slate-700">{t.label}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-5">
          {answered && (
            <button onClick={next} className="w-full rounded-xl bg-slate-900 py-3.5 font-semibold text-white hover:bg-slate-800">
              {idx + 1 >= items.length ? 'See results' : 'Next'}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    const pct = Math.round((score / items.length) * 100)
    return (
      <div className="px-5 pt-safe text-center sm:pt-10">
        <div className="text-6xl">{pct >= 80 ? '🎯' : pct >= 50 ? '👂' : '🎵'}</div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{score} / {items.length}</h1>
        <p className="text-slate-500">{pct}% tones correct</p>
        <div className="mt-6 flex gap-3">
          <button onClick={start} className="flex-1 rounded-xl bg-sky-600 py-3 font-semibold text-white hover:bg-sky-500">Again</button>
          <button onClick={() => setPhase('setup')} className="flex-1 rounded-xl bg-slate-100 py-3 font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200">Options</button>
        </div>
      </div>
    )
  }

  // setup
  return (
    <div className="px-4 pt-safe sm:pt-8">
      <header className="mb-4 mt-4 px-1 sm:mt-0">
        <h1 className="text-2xl font-bold text-slate-900">Tone trainer</h1>
        <p className="text-sm text-slate-500">Hear a character and identify its tone. {pool.length} single-character words available.</p>
      </header>

      {/* tone legend */}
      <div className="mb-5 grid grid-cols-5 gap-2">
        {TONES.map((t) => (
          <div key={t.n} className="flex flex-col items-center rounded-xl bg-white py-3 ring-1 ring-slate-200">
            <ToneGlyph n={t.n} className={`h-6 w-9 ${t.color}`} />
            <span className="mt-1 text-xs font-semibold text-slate-700">{t.label}</span>
            <span className="text-[10px] text-slate-400">{t.desc}</span>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Rounds</div>
        <div className="flex gap-2">
          {[10, 15, 25].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium ring-1 transition-colors ${count === n ? 'bg-sky-600 text-white ring-sky-600' : 'bg-white text-slate-600 ring-slate-200'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button onClick={start} disabled={pool.length < 4} className="w-full rounded-xl bg-sky-600 py-3.5 font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-50">
        Start
      </button>
    </div>
  )
}
