import { useEffect, useMemo, useState } from 'react'
import { db, type Card } from '../../db/db'
import { useSettings } from '../../lib/SettingsContext'
import { speak } from '../../lib/speech'
import { recognitionSupported, recognizeOnce } from '../../lib/speechRecognition'
import { shadowScore } from '../../lib/shadow'
import { MicIcon, SpeakerIcon } from '../../components/Icons'

type Phase = 'setup' | 'playing' | 'done'
type RecState = 'idle' | 'listening' | 'result' | 'error'

function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

export default function Shadow() {
  const { settings } = useSettings()
  const [all, setAll] = useState<Card[] | null>(null)
  const [phase, setPhase] = useState<Phase>('setup')
  const [count, setCount] = useState(8)

  const [items, setItems] = useState<Card[]>([])
  const [idx, setIdx] = useState(0)
  const [total, setTotal] = useState(0)

  const [rec, setRec] = useState<RecState>('idle')
  const [pct, setPct] = useState(0)
  const [heard, setHeard] = useState('')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    db.cards.toArray().then(setAll)
  }, [])

  const pool = useMemo(() => (all ?? []).filter((c) => c.suspended === 0 && [...c.hanzi].length >= 3), [all])
  const current = items[idx]

  const play = (c: Card) => speak(c.hanzi, { voiceURI: settings.voiceURI, rate: settings.speechRate })

  function start() {
    setItems(sample(pool, Math.min(count, pool.length)))
    setIdx(0)
    setTotal(0)
    resetTurn()
    setPhase('playing')
  }
  function resetTurn() {
    setRec('idle')
    setPct(0)
    setHeard('')
    setErrMsg('')
  }

  useEffect(() => {
    if (phase === 'playing' && current) play(current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, phase])

  async function listen() {
    if (rec === 'listening' || !current) return
    setErrMsg('')
    setRec('listening')
    try {
      const transcripts = await recognizeOnce('zh-CN').promise
      if (transcripts.length === 0) {
        setRec('idle')
        setErrMsg("Didn't catch that — tap and repeat the sentence.")
        return
      }
      const s = shadowScore(current.hanzi, transcripts)
      setPct(s.pct)
      setHeard(s.heard)
      setTotal((t) => t + s.pct)
      setRec('result')
    } catch (e) {
      setErrMsg(
        String((e as Error).message).includes('not-allowed')
          ? 'Microphone blocked. Allow mic access and try again.'
          : "Couldn't hear you — check your mic.",
      )
      setRec('idle')
    }
  }

  function next() {
    if (idx + 1 >= items.length) setPhase('done')
    else {
      setIdx((i) => i + 1)
      resetTurn()
    }
  }

  if (!all) return <div className="px-4 pt-10 text-center text-slate-400">Loading…</div>

  if (!recognitionSupported()) {
    return (
      <div className="px-5 pt-safe sm:pt-10">
        <h1 className="mb-3 text-2xl font-bold text-slate-900">Shadowing</h1>
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          This browser doesn't support speech recognition. Try Chrome, Edge, or Safari (needs internet).
        </div>
      </div>
    )
  }

  if (phase === 'playing' && current) {
    const p = Math.round((idx / items.length) * 100)
    const good = pct >= 70
    return (
      <div className="px-4 pt-safe sm:pt-8">
        <div className="flex items-center gap-3 pt-3 sm:pt-0">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${p}%` }} />
          </div>
          <span className="text-xs tabular-nums text-slate-400">{idx + 1}/{items.length}</span>
        </div>

        <div className="flex flex-col items-center py-8 text-center">
          <div className="font-hanzi text-4xl font-bold leading-snug text-slate-900">{current.hanzi}</div>
          <div className="mt-2 text-lg text-sky-600">{current.pinyin}</div>
          <div className="text-sm text-slate-500">{current.english}</div>
          <button onClick={() => play(current)} className="mt-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200" aria-label="Hear it">
            <SpeakerIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          {rec !== 'result' ? (
            <>
              <button
                onClick={listen}
                disabled={rec === 'listening'}
                className={`flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 ${rec === 'listening' ? 'animate-pulse bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
              >
                <MicIcon className="h-10 w-10" />
              </button>
              <p className="mt-3 text-sm text-slate-500">{rec === 'listening' ? 'Listening… repeat the sentence' : 'Tap, then repeat it'}</p>
              {errMsg && <p className="mt-2 text-sm text-rose-600">{errMsg}</p>}
            </>
          ) : (
            <div className="w-full">
              <div className={`rounded-2xl p-4 text-center ${good ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-amber-50 ring-1 ring-amber-200'}`}>
                <div className={`text-3xl font-black ${good ? 'text-emerald-700' : 'text-amber-700'}`}>{pct}%</div>
                <div className="mt-1 text-sm text-slate-600">
                  Heard: <span className="font-hanzi text-base text-slate-900">{heard || '—'}</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={resetTurn} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200">Try again</button>
                <button onClick={next} className="flex-1 rounded-xl bg-slate-900 py-3 font-semibold text-white hover:bg-slate-800">{idx + 1 >= items.length ? 'See results' : 'Next'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    const avg = Math.round(total / Math.max(1, items.length))
    return (
      <div className="px-5 pt-safe text-center sm:pt-10">
        <div className="text-6xl">{avg >= 80 ? '🎙️' : '💪'}</div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{avg}% average</h1>
        <p className="text-slate-500">across {items.length} sentences</p>
        <div className="mt-6 flex gap-3">
          <button onClick={start} className="flex-1 rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500">Again</button>
          <button onClick={() => setPhase('setup')} className="flex-1 rounded-xl bg-slate-100 py-3 font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200">Options</button>
        </div>
      </div>
    )
  }

  // setup
  return (
    <div className="px-4 pt-safe sm:pt-8">
      <header className="mb-4 mt-4 px-1 sm:mt-0">
        <h1 className="text-2xl font-bold text-slate-900">Shadowing</h1>
        <p className="text-sm text-slate-500">Hear a sentence, then repeat it out loud. The fastest way to fluency.</p>
      </header>
      <div className="mb-6">
        <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Sentences</div>
        <div className="flex gap-2">
          {[5, 8, 12].map((n) => (
            <button key={n} onClick={() => setCount(n)} className={`flex-1 rounded-xl py-2.5 text-sm font-medium ring-1 transition-colors ${count === n ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-slate-600 ring-slate-200'}`}>{n}</button>
          ))}
        </div>
      </div>
      <button onClick={start} disabled={pool.length === 0} className="w-full rounded-xl bg-emerald-600 py-3.5 font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50">
        Start shadowing
      </button>
      <p className="mt-3 text-center text-[11px] text-slate-400">{pool.length} sentences available · uses your browser's speech recognition.</p>
    </div>
  )
}
