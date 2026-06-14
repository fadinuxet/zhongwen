import { useEffect, useMemo, useState } from 'react'
import { db, type Card } from '../../db/db'
import { titleCase } from '../../lib/format'
import { useSettings } from '../../lib/SettingsContext'
import { speak } from '../../lib/speech'
import { pronunciationVerdict, recognitionSupported, recognizeOnce } from '../../lib/speechRecognition'
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

export default function Pronounce() {
  const { settings } = useSettings()
  const [all, setAll] = useState<Card[] | null>(null)
  const [phase, setPhase] = useState<Phase>('setup')
  const [category, setCategory] = useState('all')
  const [count, setCount] = useState(10)

  const [words, setWords] = useState<Card[]>([])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)

  const [rec, setRec] = useState<RecState>('idle')
  const [heard, setHeard] = useState('')
  const [correct, setCorrect] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    db.cards.toArray().then(setAll)
  }, [])

  const categories = useMemo(() => {
    if (!all) return []
    const counts = new Map<string, number>()
    for (const c of all) if (c.suspended === 0 && c.pinyin) counts.set(c.category, (counts.get(c.category) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [all])

  const usable = useMemo(
    () => (all ?? []).filter((c) => c.suspended === 0 && c.hanzi && c.pinyin && (category === 'all' || c.category === category)),
    [all, category],
  )

  const current = words[idx]

  function start() {
    setWords(sample(usable, Math.min(count, usable.length)))
    setIdx(0)
    setScore(0)
    resetWord()
    setPhase('playing')
  }

  function resetWord() {
    setRec('idle')
    setHeard('')
    setCorrect(false)
    setErrMsg('')
  }

  // Play the target once when a new word appears.
  useEffect(() => {
    if (phase === 'playing' && current) speak(current.hanzi, { voiceURI: settings.voiceURI, rate: settings.speechRate })
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
        setErrMsg("Didn't catch that — tap and speak again.")
        return
      }
      const { verdict, heard: h } = pronunciationVerdict(current, transcripts)
      setHeard(h)
      setCorrect(verdict === 'correct')
      if (verdict === 'correct') setScore((s) => s + 1)
      setRec('result')
    } catch (e) {
      const name = String((e as Error).message)
      setErrMsg(
        name.includes('not-allowed')
          ? 'Microphone blocked. Allow mic access and try again.'
          : "Couldn't hear you — check your mic and try again.",
      )
      setRec('idle')
    }
  }

  function next() {
    if (idx + 1 >= words.length) setPhase('done')
    else {
      setIdx((i) => i + 1)
      resetWord()
    }
  }

  if (!all) return <div className="px-4 pt-10 text-center text-slate-400">Loading…</div>

  if (!recognitionSupported()) {
    return (
      <div className="px-5 pt-safe sm:pt-10">
        <h1 className="mb-3 text-2xl font-bold text-slate-900">Pronunciation</h1>
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          This browser doesn't support speech recognition. Try Chrome, Edge, or Safari (it needs an internet connection
          to recognize speech).
        </div>
      </div>
    )
  }

  if (phase === 'playing' && current) {
    const pct = Math.round((idx / words.length) * 100)
    return (
      <div className="px-4 pt-safe sm:pt-8">
        <div className="flex items-center gap-3 pt-3 sm:pt-0">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs tabular-nums text-slate-400">{idx + 1}/{words.length}</span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">{score}</span>
        </div>

        <div className="flex flex-col items-center py-8 text-center">
          <div className="font-hanzi text-7xl font-bold text-slate-900">{current.hanzi}</div>
          <div className="mt-2 text-2xl text-sky-600">{current.pinyin}</div>
          <div className="text-lg text-slate-600">{current.english}</div>
          <button
            onClick={() => speak(current.hanzi, { voiceURI: settings.voiceURI, rate: settings.speechRate })}
            className="mt-4 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            aria-label="Hear it"
          >
            <SpeakerIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          {rec !== 'result' ? (
            <>
              <button
                onClick={listen}
                disabled={rec === 'listening'}
                className={`flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 ${
                  rec === 'listening' ? 'animate-pulse bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                <MicIcon className="h-10 w-10" />
              </button>
              <p className="mt-3 text-sm text-slate-500">{rec === 'listening' ? 'Listening… say the word' : 'Tap, then say it out loud'}</p>
              {errMsg && <p className="mt-2 text-sm text-rose-600">{errMsg}</p>}
            </>
          ) : (
            <div className="w-full">
              <div className={`rounded-2xl p-4 text-center ${correct ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-rose-50 ring-1 ring-rose-200'}`}>
                <div className={`text-lg font-semibold ${correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {correct ? 'Nice! 👏' : 'Not quite'}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Heard: <span className="font-hanzi text-base text-slate-900">{heard || '—'}</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => { resetWord() }} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200">
                  Try again
                </button>
                <button onClick={next} className="flex-1 rounded-xl bg-slate-900 py-3 font-semibold text-white hover:bg-slate-800">
                  {idx + 1 >= words.length ? 'See results' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    const pct = Math.round((score / words.length) * 100)
    return (
      <div className="px-5 pt-safe text-center sm:pt-10">
        <div className="text-6xl">{pct >= 70 ? '🗣️' : '💪'}</div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{score} / {words.length}</h1>
        <p className="text-slate-500">{pct}% sounded right</p>
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
        <h1 className="text-2xl font-bold text-slate-900">Pronunciation</h1>
        <p className="text-sm text-slate-500">Say each word out loud — your browser checks how close you got.</p>
      </header>

      <div className="mb-4">
        <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">From</div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 focus:outline-none"
        >
          <option value="all">All words ({usable.length})</option>
          {categories.map(([cat, n]) => (
            <option key={cat} value={cat}>{titleCase(cat)} ({n})</option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Words</div>
        <div className="flex gap-2">
          {[5, 10, 20].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium ring-1 transition-colors ${count === n ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-slate-600 ring-slate-200'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={start}
        disabled={usable.length === 0}
        className="w-full rounded-xl bg-emerald-600 py-3.5 font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
      >
        Start speaking
      </button>
      <p className="mt-3 text-center text-[11px] text-slate-400">Uses your browser's built-in speech recognition (free, needs internet).</p>
    </div>
  )
}
