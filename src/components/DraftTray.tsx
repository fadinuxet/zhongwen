import type { Draft } from '../lib/capture'
import { speak, speechSupported } from '../lib/speech'
import { useSettings } from '../lib/SettingsContext'
import { SpeakerIcon, XIcon } from './Icons'

interface Props {
  drafts: Draft[]
  onChange: (index: number, patch: Partial<Draft>) => void
  onRemove: (index: number) => void
  onClear: () => void
  onSave: () => void
  saving: boolean
}

/** Review-before-save list shared by all capture methods. */
export default function DraftTray({ drafts, onChange, onRemove, onClear, onSave, saving }: Props) {
  const { settings } = useSettings()
  if (drafts.length === 0) return null

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-700">
          Review {drafts.length} {drafts.length === 1 ? 'card' : 'cards'}
        </h2>
        <button onClick={onClear} className="text-xs text-slate-400 hover:text-slate-600">
          Clear all
        </button>
      </div>

      <ul className="space-y-2">
        {drafts.map((d, i) => (
          <li key={`${d.hanzi}-${i}`} className="flex items-center gap-2 rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
            <div className="w-20 shrink-0">
              <div className="font-hanzi text-xl font-semibold leading-tight text-slate-900">{d.hanzi}</div>
              <div className="truncate text-xs text-sky-600">{d.pinyin}</div>
            </div>
            <input
              value={d.english}
              onChange={(e) => onChange(i, { english: e.target.value })}
              placeholder="meaning"
              className="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-1.5 text-sm text-slate-800 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {speechSupported() && (
              <button
                onClick={() => speak(d.hanzi, { voiceURI: settings.voiceURI, rate: settings.speechRate })}
                aria-label="Play"
                className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <SpeakerIcon className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onRemove(i)}
              aria-label="Remove"
              className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={onSave}
        disabled={saving}
        className="mt-3 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white shadow-sm shadow-brand-500/20 hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : `Save ${drafts.length} to deck`}
      </button>
    </div>
  )
}
