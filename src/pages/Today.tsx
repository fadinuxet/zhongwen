import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { getTodayStats } from '../lib/queue'
import { worldReadablePct } from '../lib/reading'
import { suggestNextWords } from '../lib/optimizer'
import { useSettings } from '../lib/SettingsContext'

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl bg-white p-4 text-center ring-1 ring-slate-200">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  )
}

function Ring({ pct }: { pct: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="7" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
      />
    </svg>
  )
}

export default function Today() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const stats = useLiveQuery(() => getTodayStats(), [])
  const world = useLiveQuery(async () => {
    const c = await db.cards.toArray()
    return { ...worldReadablePct(c), wild: c.reduce((s, x) => s + (x.wildSightings ?? 0), 0) }
  }, [])
  const suggestions = useLiveQuery(() => db.cards.toArray().then((c) => suggestNextWords(c, 6)), [])

  const due = stats?.due ?? 0
  const reviewed = stats?.reviewedToday ?? 0
  const goal = settings.dailyGoal
  const goalPct = Math.min(100, goal ? Math.round((reviewed / goal) * 100) : 0)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="px-5 pt-safe sm:pt-8">
      <header className="mb-6 mt-4 flex items-center justify-between sm:mt-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{greeting}</h1>
          <p className="text-sm text-slate-500">
            {stats === undefined
              ? 'Loading your deck…'
              : due > 0
                ? `${due} ${due === 1 ? 'card' : 'cards'} ready to study`
                : 'All caught up for now 🎉'}
          </p>
        </div>
        {stats && stats.streak > 0 && (
          <div className="flex flex-col items-center rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
            <span className="text-xl font-bold text-amber-600">🔥 {stats.streak}</span>
            <span className="text-[10px] uppercase tracking-wide text-amber-600/80">day streak</span>
          </div>
        )}
      </header>

      {/* Due-today hero / start review */}
      <Link
        to="/review"
        aria-disabled={due === 0}
        className={`block rounded-2xl p-6 text-center transition-transform ${
          due > 0
            ? 'bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/25 active:scale-[0.99]'
            : 'pointer-events-none bg-white ring-1 ring-slate-200'
        }`}
        onClick={(e) => {
          if (due === 0) e.preventDefault()
        }}
      >
        <div className={`text-6xl font-black ${due > 0 ? 'text-white' : 'text-slate-300'}`}>{due}</div>
        <div className={`mt-1 text-sm font-medium ${due > 0 ? 'text-white/80' : 'text-slate-400'}`}>due today</div>
        <div
          className={`mt-4 inline-block rounded-full px-6 py-2 text-sm font-semibold ${
            due > 0 ? 'bg-white text-brand-600' : 'bg-slate-100 text-slate-400'
          }`}
        >
          {due > 0 ? 'Start review →' : 'Nothing due'}
        </div>
      </Link>

      {/* Daily goal progress */}
      <div className="mt-5 rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Daily goal</span>
          <span className="text-slate-500">
            {reviewed} / {goal} reviews
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${goalPct}%` }} />
        </div>
      </div>

      {/* "Your world" — how much of the Chinese you actually encounter you can read */}
      <Link
        to="/reading"
        className="mt-5 block rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 p-5 text-white shadow-lg shadow-violet-500/20 transition-transform active:scale-[0.99]"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white/80">You can read</div>
            <div className="text-5xl font-black leading-none">{world?.pct ?? 0}%</div>
            <div className="mt-1 text-xs text-white/70">of the Chinese in your captures</div>
          </div>
          <Ring pct={world?.pct ?? 0} />
        </div>
        <div className="mt-3 flex gap-4 text-xs text-white/80">
          <span>{world ? `${world.knownWords}/${world.totalWords} words learned` : ''}</span>
          {world && world.wild > 0 && <span>🌿 {world.wild} seen in the wild</span>}
          <span className="ml-auto font-medium">Sentences you can read →</span>
        </div>
      </Link>

      {/* Smart study — highest-leverage words to learn next */}
      {suggestions && suggestions.length > 0 && (
        <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">🎯 Best words to learn next</span>
          </div>
          <p className="mb-3 text-xs text-slate-400">Ranked by sentences they unlock + how often you see them.</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <span key={s.card.id} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                <span className="font-hanzi text-lg font-semibold text-slate-900">{s.card.hanzi}</span>
                <span className="ml-1.5 text-[11px] text-slate-400">
                  {s.unlocks > 0 ? `+${s.unlocks} sent.` : `seen ${s.frequency}×`}
                </span>
              </span>
            ))}
          </div>
          <button
            onClick={() => navigate('/review', { state: { cardIds: suggestions.map((s) => s.card.id) } })}
            className="mt-3 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Learn these now
          </button>
        </div>
      )}

      {/* Quick stats */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat value={stats?.total ?? '—'} label="Total cards" />
        <Stat value={stats?.newRemaining ?? '—'} label="New left today" />
        <Link to="/stats" className="block rounded-xl bg-white p-4 text-center ring-1 ring-slate-200 hover:ring-brand-300">
          <div className="text-2xl font-bold text-slate-900">{reviewed}</div>
          <div className="mt-0.5 text-xs text-brand-600">Your memory →</div>
        </Link>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Browse all {stats?.total ?? ''} cards in the{' '}
        <Link to="/library" className="text-brand-600 underline">
          Library
        </Link>
        .
      </p>
    </div>
  )
}
