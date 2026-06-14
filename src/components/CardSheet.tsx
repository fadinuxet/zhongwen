import { useEffect, useState, type ReactNode } from 'react'
import { db, type Card } from '../db/db'
import { freshScheduling } from '../lib/fsrs'
import { exampleSentence } from '../lib/enrich'
import { ensureDecomp, meaningfulComponents, mnemonic, type DecompMap } from '../lib/decomp'
import WordArt from './WordArt'
import { relativeDue, stateLabel, titleCase } from '../lib/format'
import { useSettings } from '../lib/SettingsContext'
import { speak, speechSupported } from '../lib/speech'
import { SpeakerIcon } from './Icons'
import AudioButton from './AudioButton'

interface Props {
  card: Card
  onClose: () => void
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-700">{value}</span>
    </div>
  )
}

export default function CardSheet({ card, onClose }: Props) {
  const { settings } = useSettings()
  const sources = card.sourceFiles ? card.sourceFiles.split(';').filter(Boolean) : []
  const example = exampleSentence(card)
  const [decomp, setDecomp] = useState<DecompMap | null>(null)
  useEffect(() => {
    ensureDecomp().then(setDecomp).catch(() => setDecomp(null))
  }, [])

  const chars = decomp
    ? [...new Set([...card.hanzi])]
        .map((ch) => ({ ch, comps: meaningfulComponents(ch, decomp), mn: mnemonic(ch, decomp) }))
        .filter((x) => x.comps.length >= 2)
    : []

  async function toggleSuspend() {
    await db.cards.update(card.id!, { suspended: card.suspended ? 0 : 1, updatedAt: Date.now() })
    onClose()
  }

  async function resetProgress() {
    await db.cards.update(card.id!, { ...freshScheduling(new Date()), updatedAt: Date.now() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="pb-safe relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <WordArt card={card} className="h-14 w-14 shrink-0" />
            <div>
              <div className="font-hanzi text-5xl font-bold text-slate-900">{card.hanzi}</div>
              <div className="mt-2 text-xl text-sky-600">{card.pinyin}</div>
              <div className="text-lg text-slate-700">{card.english}</div>
            </div>
          </div>
          <AudioButton text={card.hanzi} size="lg" />
        </div>

        {example && (
          <button
            onClick={() => speechSupported() && speak(example.hanzi, { voiceURI: settings.voiceURI, rate: settings.speechRate })}
            className="mt-4 flex w-full items-center gap-3 rounded-xl bg-brand-50 p-3 text-left ring-1 ring-brand-100 hover:bg-brand-100/60"
          >
            <SpeakerIcon className="h-5 w-5 shrink-0 text-brand-400" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-400">Example sentence</div>
              <div className="font-hanzi text-lg leading-snug text-slate-900">{example.hanzi}</div>
              <div className="text-sm text-sky-700">{example.pinyin}</div>
              <div className="text-xs text-slate-500">{example.english}</div>
            </div>
          </button>
        )}

        {/* Built from — character components */}
        {chars.length > 0 && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Built from</div>
            <div className="space-y-2">
              {chars.map(({ ch, comps }) => (
                <div key={ch} className="flex items-center gap-2 text-sm">
                  <span className="font-hanzi text-2xl font-semibold text-slate-900">{ch}</span>
                  <span className="text-slate-400">=</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {comps.map((c, i) => (
                      <span key={i} className="text-slate-600">
                        <span className="font-hanzi text-lg text-slate-900">{c.ch}</span>
                        {c.gloss && <span className="ml-0.5 text-xs text-slate-400">({c.gloss})</span>}
                        {i < comps.length - 1 && <span className="ml-1.5 text-slate-300">+</span>}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
            {chars.length === 1 && chars[0].mn && (
              <div className="mt-2 text-xs italic text-slate-500">💡 {chars[0].mn} → {card.english.split(/[/;,]/)[0]}</div>
            )}
          </div>
        )}

        <div className="mt-5">
          <Row label="Category" value={titleCase(card.category)} />
          <Row label="Frequency" value={`seen ${card.frequency}×`} />
          <Row label="Status" value={card.suspended ? 'Suspended' : stateLabel(card.state)} />
          <Row label="Next due" value={card.suspended ? '—' : relativeDue(card.due, card.state)} />
          <Row label="Reviews" value={`${card.reps} (${card.lapses} lapses)`} />
          {sources.length > 0 && <Row label="Source" value={`${sources.length} screenshot${sources.length > 1 ? 's' : ''}`} />}
        </div>

        {sources.length > 0 && (
          <details className="mt-3 text-xs text-slate-400">
            <summary className="cursor-pointer select-none">Source screenshots</summary>
            <ul className="mt-2 space-y-1 break-all">
              {sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={toggleSuspend} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
            {card.suspended ? 'Unsuspend' : 'Suspend'}
          </button>
          <button onClick={resetProgress} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
            Reset progress
          </button>
          <button onClick={onClose} className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
