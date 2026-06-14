import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { dedupeDeck, ensureSeeded } from '../lib/seed'
import { useSettings } from '../lib/SettingsContext'
import { chineseVoices, loadVoices, speak, speechSupported } from '../lib/speech'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <div className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-200">{children}</div>
    </section>
  )
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-slate-700">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className="w-20 rounded-lg bg-slate-50 px-2 py-1.5 text-right text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </label>
  )
}

export default function Settings() {
  const { settings, update } = useSettings()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [busy, setBusy] = useState(false)
  const [dedupeMsg, setDedupeMsg] = useState('')

  useEffect(() => {
    loadVoices().then((all) => setVoices(chineseVoices(all)))
  }, [])

  async function exportDeck() {
    const cards = await db.cards.toArray()
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zhongwen-deck-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function removeDuplicates() {
    const removed = await dedupeDeck()
    setDedupeMsg(removed > 0 ? `Removed ${removed} duplicate${removed === 1 ? '' : 's'}.` : 'No duplicates found.')
  }

  async function resetDeck() {
    if (!confirm('Reset the whole deck? This erases all review progress and re-imports the 630 starter cards.')) return
    setBusy(true)
    try {
      await db.transaction('rw', db.cards, db.reviews, db.meta, async () => {
        await db.cards.clear()
        await db.reviews.clear()
        await db.meta.delete('seeded')
        await db.meta.delete('newIntro')
      })
      await ensureSeeded()
    } finally {
      setBusy(false)
    }
  }

  const total = useLiveQuery(() => db.cards.count(), [])

  return (
    <div className="px-4 pt-safe sm:pt-8">
      <header className="mb-2 mt-4 px-1 sm:mt-0">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      </header>

      <Section title="Review">
        <label className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-slate-700">
            Show hanzi first
            <span className="block text-xs text-slate-400">Off = English prompt → recall the hanzi</span>
          </span>
          <Toggle on={settings.frontIsHanzi} onClick={() => update({ frontIsHanzi: !settings.frontIsHanzi })} />
        </label>
        <NumberField label="New cards / day" value={settings.newPerDay} min={0} max={200} onChange={(n) => update({ newPerDay: n })} />
        <NumberField label="Max reviews / day" value={settings.maxReviews} min={10} max={1000} onChange={(n) => update({ maxReviews: n })} />
        <NumberField label="Daily goal (reviews)" value={settings.dailyGoal} min={1} max={500} onChange={(n) => update({ dailyGoal: n })} />
      </Section>

      <Section title="Audio">
        {!speechSupported() ? (
          <p className="px-4 py-3 text-sm text-slate-400">Speech synthesis isn't available in this browser.</p>
        ) : (
          <>
            <label className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="text-slate-700">Voice</span>
              <select
                value={settings.voiceURI}
                onChange={(e) => update({ voiceURI: e.target.value })}
                className="max-w-[55%] truncate rounded-lg bg-slate-50 px-2 py-1.5 text-slate-900 ring-1 ring-slate-200 focus:outline-none"
              >
                <option value="">Default (auto)</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="text-slate-700">Speed {settings.speechRate.toFixed(1)}×</span>
              <input
                type="range"
                min={0.5}
                max={1.2}
                step={0.1}
                value={settings.speechRate}
                onChange={(e) => update({ speechRate: Number(e.target.value) })}
                className="w-40 accent-brand-500"
              />
            </label>
            <button
              onClick={() => speak('你好，世界', { voiceURI: settings.voiceURI, rate: settings.speechRate })}
              className="w-full px-4 py-3 text-left text-sm text-brand-600 hover:bg-slate-50"
            >
              ▶ Test voice — 你好，世界
            </button>
          </>
        )}
      </Section>

      <Section title="Data">
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-slate-700">Cards in deck</span>
          <span className="text-slate-500">{total ?? '—'}</span>
        </div>
        <button onClick={exportDeck} className="w-full px-4 py-3 text-left text-sm text-brand-600 hover:bg-slate-50">
          Export deck (JSON)
        </button>
        <button onClick={removeDuplicates} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-brand-600 hover:bg-slate-50">
          <span>Remove duplicate cards</span>
          {dedupeMsg && <span className="text-xs text-slate-400">{dedupeMsg}</span>}
        </button>
        <button onClick={resetDeck} disabled={busy} className="w-full px-4 py-3 text-left text-sm text-rose-600 hover:bg-slate-50 disabled:opacity-50">
          {busy ? 'Resetting…' : 'Reset deck & progress'}
        </button>
      </Section>

      <p className="mt-6 px-1 text-center text-xs text-slate-400">学中文 · your data stays on this device</p>
      <p className="mt-1 px-1 text-center text-[11px] text-slate-300">
        Illustrations by{' '}
        <a href="https://openmoji.org" target="_blank" rel="noreferrer" className="underline">
          OpenMoji
        </a>{' '}
        · CC BY-SA 4.0
      </p>
    </div>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-brand-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}
