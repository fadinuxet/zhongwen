import { useState, type ReactNode } from 'react'
import { saveDrafts, type Draft } from '../lib/capture'
import { CameraIcon, ImageIcon, TypeIcon } from '../components/Icons'
import DraftTray from '../components/DraftTray'
import TypeAdd from './capture/TypeAdd'
import ScreenshotAdd from './capture/ScreenshotAdd'
import CameraAdd from './capture/CameraAdd'
import CameraText from './capture/CameraText'

type Tab = 'type' | 'screenshot' | 'camera'
type CamMode = 'text' | 'objects'

const TABS: { id: Tab; label: string; Icon: (p: { className?: string }) => ReactNode }[] = [
  { id: 'type', label: 'Type', Icon: TypeIcon },
  { id: 'screenshot', label: 'Screenshot', Icon: ImageIcon },
  { id: 'camera', label: 'Camera', Icon: CameraIcon },
]

export default function Capture() {
  const [tab, setTab] = useState<Tab>('type')
  const [camMode, setCamMode] = useState<CamMode>('text')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  function addDrafts(incoming: Draft[]) {
    setToast('')
    setDrafts((prev) => {
      const have = new Set(prev.map((d) => d.hanzi))
      const fresh = incoming.filter((d) => d.hanzi && !have.has(d.hanzi))
      return [...prev, ...fresh]
    })
  }

  const updateDraft = (i: number, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  const removeDraft = (i: number) => setDrafts((prev) => prev.filter((_, idx) => idx !== i))

  async function save() {
    setSaving(true)
    try {
      const { saved, wildReviews, wildNoted } = await saveDrafts(drafts)
      setDrafts([])
      const parts: string[] = []
      if (saved) parts.push(`Saved ${saved} new ${saved === 1 ? 'card' : 'cards'}`)
      if (wildReviews) parts.push(`🌿 ${wildReviews} seen-in-the-wild review${wildReviews === 1 ? '' : 's'}`)
      if (wildNoted) parts.push(`${wildNoted} already known`)
      setToast(parts.join(' · ') || 'Nothing to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 pt-safe sm:pt-8">
      <header className="mb-4 mt-4 px-1 sm:mt-0">
        <h1 className="text-2xl font-bold text-slate-900">Add words</h1>
        <p className="text-sm text-slate-500">Type, scan a screenshot, or point your camera.</p>
      </header>

      {/* Method tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {toast && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
          {toast}
        </div>
      )}

      {tab === 'type' && <TypeAdd onAdd={addDrafts} />}
      {tab === 'screenshot' && <ScreenshotAdd onAdd={addDrafts} />}
      {tab === 'camera' && (
        <div>
          <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
            <button
              onClick={() => setCamMode('text')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${camMode === 'text' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}
            >
              Read text
            </button>
            <button
              onClick={() => setCamMode('objects')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${camMode === 'objects' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}
            >
              Objects
            </button>
          </div>
          {camMode === 'text' ? <CameraText onAdd={addDrafts} /> : <CameraAdd onAdd={addDrafts} />}
        </div>
      )}

      <DraftTray
        drafts={drafts}
        onChange={updateDraft}
        onRemove={removeDraft}
        onClear={() => setDrafts([])}
        onSave={save}
        saving={saving}
      />
    </div>
  )
}
