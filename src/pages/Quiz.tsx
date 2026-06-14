import { useEffect, useMemo, useRef, useState } from 'react'
import { db, logConfusion, type Card } from '../db/db'
import {
  buildQuiz,
  checkTyped,
  quizCategories,
  type Question,
  type QuizDirection,
  type QuizMode,
} from '../lib/quiz'
import { titleCase } from '../lib/format'
import { useSettings } from '../lib/SettingsContext'
import { speak, speechSupported } from '../lib/speech'
import { SpeakerIcon } from '../components/Icons'
import WordArt from '../components/WordArt'

type Phase = 'setup' | 'playing' | 'done'

const MODES: { id: QuizMode; label: string; desc: string }[] = [
  { id: 'mc', label: 'Multiple choice', desc: 'Pick the right answer' },
  { id: 'type', label: 'Typing', desc: 'Type the answer' },
  { id: 'listen', label: 'Listening', desc: 'Hear it, then choose' },
]

export default function Quiz() {
  const [allCards, setAllCards] = useState<Card[] | null>(null)
  const [phase, setPhase] = useState<Phase>('setup')

  const [mode, setMode] = useState<QuizMode>('mc')
  const [direction, setDirection] = useState<QuizDirection>('cn-en')
  const [category, setCategory] = useState('all')
  const [count, setCount] = useState(10)

  const [questions, setQuestions] = useState<Question[]>([])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [missed, setMissed] = useState<Card[]>([])

  useEffect(() => {
    db.cards.toArray().then(setAllCards)
  }, [])

  const categories = useMemo(() => (allCards ? quizCategories(allCards) : []), [allCards])
  const totalUsable = useMemo(
    () => (allCards ? allCards.filter((c) => c.suspended === 0 && c.english).length : 0),
    [allCards],
  )

  function start() {
    if (!allCards) return
    const qs = buildQuiz(allCards, { mode, direction, category, count })
    if (qs.length === 0) return
    setQuestions(qs)
    setIdx(0)
    setScore(0)
    setMissed([])
    setPhase('playing')
  }

  function onAnswered(correct: boolean, card: Card) {
    if (correct) setScore((s) => s + 1)
    else setMissed((m) => [...m, card])
  }

  function next() {
    if (idx + 1 >= questions.length) setPhase('done')
    else setIdx((i) => i + 1)
  }

  if (!allCards) {
    return <div className="px-4 pt-10 text-center text-slate-400">Loading…</div>
  }

  if (phase === 'playing') {
    return (
      <QuizSession
        key={idx}
        question={questions[idx]}
        index={idx}
        total={questions.length}
        score={score}
        onAnswered={onAnswered}
        onNext={next}
      />
    )
  }

  if (phase === 'done') {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div className="px-5 pt-safe sm:pt-10">
        <div className="mx-auto max-w-md text-center">
          <div className="text-6xl">{pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '📚'}</div>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            {score} / {questions.length}
          </h1>
          <p className="text-slate-500">{pct}% correct</p>

          {missed.length > 0 && (
            <div className="mt-6 rounded-xl bg-white p-4 text-left ring-1 ring-slate-200">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Review these</div>
              <ul className="space-y-1.5">
                {missed.map((c) => (
                  <li key={c.id} className="flex items-baseline gap-2 text-sm">
                    <span className="font-hanzi text-base text-slate-900">{c.hanzi}</span>
                    <span className="text-sky-600">{c.pinyin}</span>
                    <span className="truncate text-slate-500">{c.english}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button onClick={start} className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700">
              Play again
            </button>
            <button onClick={() => setPhase('setup')} className="flex-1 rounded-xl bg-slate-100 py-3 font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200">
              Change options
            </button>
          </div>
        </div>
      </div>
    )
  }

  // setup
  const enoughForCategory =
    category === 'all' ? totalUsable >= 4 : (categories.find((c) => c.cat === category)?.count ?? 0) >= 4

  return (
    <div className="px-4 pt-safe sm:pt-8">
      <header className="mb-4 mt-4 px-1 sm:mt-0">
        <h1 className="text-2xl font-bold text-slate-900">Quiz</h1>
        <p className="text-sm text-slate-500">Test yourself across your deck.</p>
      </header>

      <Field label="Mode">
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-xl px-2 py-3 text-center ring-1 transition-colors ${
                mode === m.id ? 'bg-brand-50 text-brand-700 ring-brand-300' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'
              }`}
            >
              <div className="text-sm font-semibold">{m.label}</div>
              <div className="mt-0.5 text-[10px] leading-tight text-slate-400">{m.desc}</div>
            </button>
          ))}
        </div>
      </Field>

      {mode !== 'listen' && (
        <Field label="Direction">
          <div className="flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
            <Seg active={direction === 'cn-en'} onClick={() => setDirection('cn-en')}>
              汉字 → English
            </Seg>
            <Seg active={direction === 'en-cn'} onClick={() => setDirection('en-cn')}>
              English → {mode === 'type' ? 'pinyin' : '汉字'}
            </Seg>
          </div>
        </Field>
      )}

      <Field label="From">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 focus:outline-none"
        >
          <option value="all">All cards ({totalUsable})</option>
          {categories.map(({ cat, count: n }) => (
            <option key={cat} value={cat}>
              {titleCase(cat)} ({n})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Questions">
        <div className="flex gap-2">
          {[10, 20, 30].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium ring-1 transition-colors ${
                count === n ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>

      <button
        onClick={start}
        disabled={!enoughForCategory}
        className="mt-6 w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white shadow-sm shadow-brand-500/20 hover:bg-brand-700 disabled:opacity-50"
      >
        {enoughForCategory ? 'Start quiz' : 'Need at least 4 cards'}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </div>
  )
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
        active ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'
      }`}
    >
      {children}
    </button>
  )
}

// --- one question ---

function QuizSession({
  question,
  index,
  total,
  score,
  onAnswered,
  onNext,
}: {
  question: Question
  index: number
  total: number
  score: number
  onAnswered: (correct: boolean, card: Card) => void
  onNext: () => void
}) {
  const { settings } = useSettings()
  const [selected, setSelected] = useState<number | null>(null)
  const [typed, setTyped] = useState('')
  const [answered, setAnswered] = useState(false)
  const [correct, setCorrect] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const play = () => speak(question.audioText ?? question.card.hanzi, { voiceURI: settings.voiceURI, rate: settings.speechRate })

  // Auto-play for listening questions; focus the input for typing.
  useEffect(() => {
    if (question.kind === 'listen') play()
    if (question.kind === 'type') inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function logMiss() {
    if (question.card.id != null) {
      logConfusion({ type: 'quiz', cardId: question.card.id, target: question.card.hanzi, chosen: '', at: Date.now() })
    }
  }

  function answerChoice(i: number) {
    if (answered) return
    const ok = i === question.answerIndex
    setSelected(i)
    setCorrect(ok)
    setAnswered(true)
    if (!ok) logMiss()
    onAnswered(ok, question.card)
  }

  function submitTyped() {
    if (answered || !typed.trim()) return
    const ok = checkTyped(question, typed)
    setCorrect(ok)
    setAnswered(true)
    if (!ok) logMiss()
    onAnswered(ok, question.card)
  }

  const progressPct = Math.round((index / total) * 100)
  // Show the drawing when it can't give away the answer: the English is already the
  // prompt (English→汉字), or the question has been answered.
  const showArt = answered || (question.kind !== 'listen' && !isHanzi(question.promptMain))

  return (
    <div className="px-4 pt-safe sm:pt-8">
      {/* header */}
      <div className="flex items-center gap-3 pt-3 sm:pt-0">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-xs tabular-nums text-slate-400">
          {index + 1}/{total}
        </span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">{score}</span>
      </div>

      {/* prompt */}
      <div className="flex flex-col items-center justify-center py-8 text-center">
        {showArt && <WordArt card={question.card} className="mb-3 h-20 w-20" />}
        {question.kind === 'listen' ? (
          <button onClick={play} className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-200 active:scale-95">
            <SpeakerIcon className="h-10 w-10" />
          </button>
        ) : (
          <>
            <div className={`font-bold text-slate-900 ${isHanzi(question.promptMain) ? 'font-hanzi text-6xl' : 'text-3xl'}`}>
              {question.promptMain}
            </div>
            {question.promptSub && <div className="mt-2 text-xl text-sky-600">{question.promptSub}</div>}
            {question.audioText && speechSupported() && (
              <button onClick={play} className="mt-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                <SpeakerIcon className="h-5 w-5" />
              </button>
            )}
          </>
        )}
        {question.kind === 'listen' && <div className="mt-3 text-sm text-slate-400">{question.promptSub}</div>}
      </div>

      {/* answers */}
      <div>
        {question.kind === 'type' ? (
          <div>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitTyped()}
              disabled={answered}
              placeholder={question.inputHint}
              className="w-full rounded-xl bg-white px-4 py-3 text-center text-lg text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50"
            />
            {answered && (
              <div className={`mt-3 rounded-xl p-3 text-center text-sm ${correct ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {correct ? 'Correct!' : 'Answer: '}
                {!correct && <span className="font-hanzi font-semibold">{question.correctText}</span>}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {question.options!.map((opt, i) => {
              const isAnswer = i === question.answerIndex
              const cls = !answered
                ? 'bg-white ring-slate-200 hover:ring-brand-400'
                : isAnswer
                  ? 'bg-emerald-50 ring-emerald-400'
                  : i === selected
                    ? 'bg-rose-50 ring-rose-400'
                    : 'bg-white ring-slate-200 opacity-60'
              return (
                <button
                  key={i}
                  onClick={() => answerChoice(i)}
                  disabled={answered}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left ring-1 transition-colors ${cls}`}
                >
                  <span className={isHanzi(opt.text) ? 'font-hanzi text-xl text-slate-900' : 'text-base text-slate-800'}>{opt.text}</span>
                  {opt.sub && answered && <span className="text-sm text-sky-600">{opt.sub}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* action */}
      <div className="mt-5">
        {question.kind === 'type' && !answered ? (
          <button onClick={submitTyped} disabled={!typed.trim()} className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            Check
          </button>
        ) : answered ? (
          <button onClick={onNext} className="w-full rounded-xl bg-slate-900 py-3.5 font-semibold text-white hover:bg-slate-800">
            {index + 1 >= total ? 'See results' : 'Next'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

const isHanzi = (s: string) => /[㐀-鿿]/.test(s)
