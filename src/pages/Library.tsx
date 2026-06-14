import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { State } from 'ts-fsrs'
import { db, type Card } from '../db/db'
import { relativeDue, stateLabel, titleCase } from '../lib/format'
import { EyeIcon, EyeOffIcon, GridIcon, ListIcon, SearchIcon, ShuffleIcon } from '../components/Icons'
import AudioButton from '../components/AudioButton'
import CardSheet from '../components/CardSheet'
import FlipCard from '../components/FlipCard'

type SortKey = 'frequency' | 'hanzi' | 'due'
type View = 'cards' | 'list'

// Deterministic pseudo-random in [0,1) — used to shuffle while staying stable per seed.
function seededRank(id: number, seed: number): number {
  const x = Math.sin(id * 12.9898 + seed * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export default function Library() {
  const cards = useLiveQuery(() => db.cards.toArray(), [])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('frequency')
  const [view, setView] = useState<View>('cards')
  const [selected, setSelected] = useState<Card | null>(null)

  // Cards-mode interaction state.
  const [flipped, setFlipped] = useState<Set<number>>(new Set())
  const [revealed, setRevealed] = useState(false)
  const [shuffleSeed, setShuffleSeed] = useState<number | null>(null)

  const categories = useMemo(() => {
    if (!cards) return []
    const counts = new Map<string, number>()
    for (const c of cards) counts.set(c.category, (counts.get(c.category) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [cards])

  const filtered = useMemo(() => {
    if (!cards) return []
    const q = query.trim().toLowerCase()
    const out = cards.filter((c) => {
      if (category !== 'all' && c.category !== category) return false
      if (!q) return true
      return c.hanzi.includes(query.trim()) || c.pinyin.toLowerCase().includes(q) || c.english.toLowerCase().includes(q)
    })
    out.sort((a, b) => {
      if (shuffleSeed !== null) return seededRank(a.id!, shuffleSeed) - seededRank(b.id!, shuffleSeed)
      if (sort === 'frequency') return b.frequency - a.frequency || a.hanzi.localeCompare(b.hanzi)
      if (sort === 'hanzi') return a.hanzi.localeCompare(b.hanzi)
      return a.due.getTime() - b.due.getTime()
    })
    return out
  }, [cards, query, category, sort, shuffleSeed])

  function toggleFlip(id: number) {
    setFlipped((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleRevealAll() {
    if (revealed) {
      setFlipped(new Set())
      setRevealed(false)
    } else {
      setFlipped(new Set(filtered.map((c) => c.id!)))
      setRevealed(true)
    }
  }

  function shuffle() {
    setSort('frequency')
    setShuffleSeed((s) => (s ?? 0) + 1 + Math.floor(performance.now() % 997))
  }

  return (
    <div className="px-4 pt-safe sm:pt-8">
      <header className="mb-4 mt-4 flex items-baseline justify-between px-1 sm:mt-0">
        <h1 className="text-2xl font-bold text-slate-900">Library</h1>
        <span className="text-sm text-slate-400">{cards ? `${filtered.length} / ${cards.length}` : ''}</span>
      </header>

      {/* Search */}
      <div className="relative mb-3">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search hanzi, pinyin, or English…"
          className="w-full rounded-xl bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Controls: sort (left) + view toggle (right) */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Sort</label>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey)
              setShuffleSeed(null)
            }}
            className="rounded-lg bg-white px-2 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200 focus:outline-none"
          >
            <option value="frequency">Most seen</option>
            <option value="hanzi">A–Z (hanzi)</option>
            <option value="due">Due soonest</option>
          </select>
        </div>

        <div className="flex rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200">
          <SegBtn active={view === 'cards'} onClick={() => setView('cards')} label="Cards">
            <GridIcon className="h-4 w-4" />
          </SegBtn>
          <SegBtn active={view === 'list'} onClick={() => setView('list')} label="List">
            <ListIcon className="h-4 w-4" />
          </SegBtn>
        </div>
      </div>

      {/* Category rail */}
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={category === 'all'} onClick={() => setCategory('all')} label="All" count={cards?.length} />
        {categories.map(([cat, count]) => (
          <Chip key={cat} active={category === cat} onClick={() => setCategory(cat)} label={titleCase(cat)} count={count} />
        ))}
      </div>

      {/* Cards-mode action bar */}
      {view === 'cards' && (
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={toggleRevealAll}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {revealed ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            {revealed ? 'Hide answers' : 'Reveal all'}
          </button>
          <button
            onClick={shuffle}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <ShuffleIcon className="h-4 w-4" />
            Shuffle
          </button>
          <span className="ml-auto text-[11px] text-slate-400">tap a card to flip</span>
        </div>
      )}

      {/* Content */}
      {!cards ? (
        <div className="py-16 text-center text-slate-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400">No cards match.</div>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((c) => (
            <FlipCard key={c.id} card={c} flipped={flipped.has(c.id!)} onFlip={toggleFlip} onDetails={setSelected} />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelected(c)}
                className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
              >
                <div className="font-hanzi text-2xl font-semibold text-slate-900">{c.hanzi}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-sky-700">{c.pinyin}</div>
                  <div className="truncate text-sm text-slate-600">{c.english}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                    {c.suspended ? 'suspended' : stateLabel(c.state).toLowerCase()}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {c.state === State.New ? `seen ${c.frequency}×` : relativeDue(c.due, c.state)}
                  </span>
                </div>
                <AudioButton text={c.hanzi} size="sm" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && <CardSheet card={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function SegBtn({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  )
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-800'
      }`}
    >
      {label}
      {count !== undefined && <span className={active ? 'ml-1.5 text-white/70' : 'ml-1.5 text-slate-300'}>{count}</span>}
    </button>
  )
}
