import { useEffect, useMemo, useState } from 'react'
import { db, type Card } from '../db/db'
import { deckHealth, fadingCards, quizMisses, reviewHeatmap, toneConfusions, type DayCount, type ToneConfusion } from '../lib/memory'
import { TONES, toneContour, type Tone } from '../lib/tones'

const toneLabel = (n: string) => TONES.find((t) => String(t.n) === n)?.label ?? n

function ToneMark({ n }: { n: string }) {
  return (
    <svg viewBox="0 0 24 24" className="inline-block h-4 w-6 align-middle" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d={toneContour(Number(n) as Tone)} />
    </svg>
  )
}

export default function Stats() {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [heat, setHeat] = useState<DayCount[]>([])
  const [tones, setTones] = useState<ToneConfusion[]>([])
  const [misses, setMisses] = useState<{ card?: Card; count: number }[]>([])

  useEffect(() => {
    db.cards.toArray().then(async (cs) => {
      setCards(cs)
      setHeat(await reviewHeatmap())
      setTones(await toneConfusions())
      const qm = await quizMisses()
      const byId = new Map(cs.map((c) => [c.id!, c]))
      setMisses(qm.map((m) => ({ card: byId.get(m.cardId), count: m.count })))
    })
  }, [])

  const health = useMemo(() => (cards ? deckHealth(cards) : null), [cards])
  const fading = useMemo(() => (cards ? fadingCards(cards) : []), [cards])

  if (!cards || !health) return <div className="px-4 pt-10 text-center text-slate-400">Loading…</div>

  const total = Math.max(1, health.studied)
  const seg = (n: number) => `${(n / total) * 100}%`
  const weeks: DayCount[][] = []
  for (let i = 0; i < heat.length; i += 7) weeks.push(heat.slice(i, i + 7))
  const heatColor = (c: number) =>
    c === 0 ? '#e2e8f0' : c < 3 ? '#a7f3d0' : c < 6 ? '#34d399' : c < 10 ? '#10b981' : '#047857'

  return (
    <div className="px-4 pt-safe sm:pt-8">
      <header className="mb-4 mt-4 px-1 sm:mt-0">
        <h1 className="text-2xl font-bold text-slate-900">Your memory</h1>
        <p className="text-sm text-slate-500">How well your deck is holding — and what you keep mixing up.</p>
      </header>

      {/* Deck health */}
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-slate-700">Deck health</span>
          <span className="text-2xl font-bold text-emerald-600">{Math.round(health.avg * 100)}%</span>
        </div>
        <div className="mb-2 flex h-3 overflow-hidden rounded-full bg-slate-100">
          <div style={{ width: seg(health.strong) }} className="bg-emerald-500" />
          <div style={{ width: seg(health.ok) }} className="bg-lime-400" />
          <div style={{ width: seg(health.fading) }} className="bg-amber-400" />
          <div style={{ width: seg(health.weak) }} className="bg-rose-400" />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span><b className="text-emerald-600">{health.strong}</b> strong</span>
          <span><b className="text-lime-600">{health.ok}</b> solid</span>
          <span><b className="text-amber-600">{health.fading}</b> fading</span>
          <span><b className="text-rose-600">{health.weak}</b> weak</span>
        </div>
      </section>

      {/* Review heatmap */}
      <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <div className="mb-2 text-sm font-semibold text-slate-700">Reviews · last 17 weeks</div>
        <div className="flex gap-1 overflow-x-auto">
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-1">
              {w.map((d) => (
                <div key={d.date} title={`${d.date}: ${d.count}`} className="h-3 w-3 rounded-sm" style={{ backgroundColor: heatColor(d.count) }} />
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Fading — about to be forgotten */}
      {fading.length > 0 && (
        <section className="mt-4">
          <div className="mb-2 px-1 text-sm font-semibold text-slate-700">Fading — review soon</div>
          <ul className="space-y-1.5">
            {fading.map(({ card, r }) => (
              <li key={card.id} className="flex items-center gap-3 rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
                <span className="font-hanzi text-lg font-semibold text-slate-900">{card.hanzi}</span>
                <span className="flex-1 truncate text-sm text-slate-500">{card.english}</span>
                <span className="text-xs font-medium text-amber-600">{Math.round(r * 100)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Confusion radar */}
      <section className="mt-6">
        <h2 className="mb-2 px-1 text-sm font-semibold text-slate-700">Confusion radar</h2>
        {tones.length === 0 && misses.length === 0 ? (
          <div className="rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
            Do some quizzes and tone drills — the words and tones you mix up will show up here.
          </div>
        ) : (
          <div className="space-y-4">
            {tones.length > 0 && (
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tones you confuse</div>
                <ul className="space-y-1.5 text-sm">
                  {tones.slice(0, 5).map((t, i) => (
                    <li key={i} className="flex items-center gap-2 text-slate-600">
                      <span className="text-emerald-600"><ToneMark n={t.target} /> {toneLabel(t.target)}</span>
                      <span className="text-slate-400">heard as</span>
                      <span className="text-rose-600"><ToneMark n={t.chosen} /> {toneLabel(t.chosen)}</span>
                      <span className="ml-auto text-xs text-slate-400">{t.count}×</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {misses.filter((m) => m.card).length > 0 && (
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Words you miss most</div>
                <div className="flex flex-wrap gap-2">
                  {misses.filter((m) => m.card).map((m) => (
                    <span key={m.card!.id} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-sm ring-1 ring-rose-100">
                      <span className="font-hanzi font-semibold text-slate-900">{m.card!.hanzi}</span>
                      <span className="ml-1 text-xs text-rose-500">{m.count}×</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
