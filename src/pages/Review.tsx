import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { type Grade } from 'ts-fsrs'
import { db, type Card } from '../db/db'
import { buildQueue, recordReview } from '../lib/queue'
import { previewIntervals, RATINGS } from '../lib/fsrs'
import { useSettings } from '../lib/SettingsContext'
import { speak } from '../lib/speech'
import AudioButton from '../components/AudioButton'
import WordArt from '../components/WordArt'
import { BackIcon } from '../components/Icons'

export default function Review() {
  const navigate = useNavigate()
  const location = useLocation()
  const focusIds = (location.state as { cardIds?: number[] } | null)?.cardIds
  const { settings, ready } = useSettings()
  const [queue, setQueue] = useState<Card[] | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)
  const shownAt = useRef<number>(Date.now())

  // Build the session queue once settings are loaded. A passed-in list of card
  // ids (from the "best words to learn next" optimizer) takes precedence.
  useEffect(() => {
    if (!ready) return
    if (focusIds && focusIds.length) {
      db.cards.bulkGet(focusIds).then((cs) => setQueue(cs.filter((c): c is Card => !!c)))
    } else {
      buildQueue(settings).then(setQueue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, settings])

  const current = queue?.[index]
  const finished = queue !== null && index >= queue.length

  const intervals = useMemo(
    () => (current && flipped ? previewIntervals(current) : null),
    [current, flipped],
  )

  // Auto-pronounce the hanzi whenever its face becomes visible.
  const hanziVisible = current ? (settings.frontIsHanzi ? !flipped : flipped) : false
  useEffect(() => {
    if (current && hanziVisible) {
      speak(current.hanzi, { voiceURI: settings.voiceURI, rate: settings.speechRate })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, hanziVisible])

  const grade = useCallback(
    async (rating: Grade) => {
      if (!current || !flipped) return
      await recordReview(current, rating, Date.now() - shownAt.current)
      setDone((d) => d + 1)
      setFlipped(false)
      setIndex((i) => i + 1)
      shownAt.current = Date.now()
    },
    [current, flipped],
  )

  // Keyboard: space/enter to flip, 1–4 to grade.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        grade(RATINGS[Number(e.key) - 1].rating as Grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, grade])

  if (queue === null) {
    return <div className="flex h-screen items-center justify-center text-slate-400">Loading…</div>
  }

  if (finished) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="text-6xl">🎉</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Session complete</h2>
          <p className="mt-1 text-slate-500">
            You reviewed {done} {done === 1 ? 'card' : 'cards'}.
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="rounded-full bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Back to Today
        </button>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="text-5xl">✅</div>
        <p className="text-slate-600">Nothing due right now. Come back later!</p>
        <button onClick={() => navigate('/')} className="rounded-full bg-slate-100 px-6 py-2.5 text-slate-700 ring-1 ring-slate-200">
          Back to Today
        </button>
      </div>
    )
  }

  const total = queue.length
  const progressPct = Math.round((index / total) * 100)

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Top bar */}
      <div className="pt-safe flex items-center gap-3 px-4 pt-3">
        <button
          onClick={() => navigate('/')}
          aria-label="Exit review"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200"
        >
          <BackIcon className="h-5 w-5" />
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="w-14 text-right text-xs tabular-nums text-slate-400">
          {index + 1}/{total}
        </span>
      </div>

      {/* Card */}
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center"
      >
        {current && (
          <>
            {settings.frontIsHanzi ? (
              <>
                <div className="font-hanzi text-7xl font-bold leading-tight text-slate-900 sm:text-8xl">
                  {current.hanzi}
                </div>
                {flipped && (
                  <div className="mt-6 flex flex-col items-center space-y-2">
                    <WordArt card={current} className="mb-1 h-24 w-24" />
                    <div className="text-2xl text-sky-600">{current.pinyin}</div>
                    <div className="text-xl text-slate-700">{current.english}</div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* English prompt → the picture is a safe recall aid, shown up front. */}
                <WordArt card={current} className="mb-4 h-24 w-24" />
                <div className="text-3xl font-semibold text-slate-900 sm:text-4xl">{current.english}</div>
                {flipped && (
                  <div className="mt-6 space-y-2">
                    <div className="font-hanzi text-6xl font-bold text-slate-900 sm:text-7xl">{current.hanzi}</div>
                    <div className="text-2xl text-sky-600">{current.pinyin}</div>
                  </div>
                )}
              </>
            )}

            <div className="mt-8 flex items-center gap-3">
              <AudioButton text={current.hanzi} size="lg" />
            </div>

            {!flipped && <div className="mt-6 text-xs text-slate-400">tap or press space to flip</div>}
          </>
        )}
      </button>

      {/* Grade buttons */}
      <div className="pb-safe px-4 pb-4">
        {flipped ? (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map(({ rating, label, color }) => (
              <button
                key={rating}
                onClick={() => grade(rating as Grade)}
                className={`flex flex-col items-center rounded-xl py-3 font-semibold text-white shadow-sm transition-transform active:scale-95 ${color}`}
              >
                <span>{label}</span>
                {intervals && <span className="mt-0.5 text-[11px] font-normal text-white/80">{intervals[rating]}</span>}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white shadow-sm shadow-brand-500/20 active:scale-[0.99]"
          >
            Show answer
          </button>
        )}
      </div>
    </div>
  )
}
