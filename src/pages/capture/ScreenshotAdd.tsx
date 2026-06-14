import { useRef, useState } from 'react'
import { pinyin } from 'pinyin-pro'
import { ensureDict, lookupGloss, segment } from '../../lib/dict'
import { makeDraft, type Draft } from '../../lib/capture'
import { ImageIcon } from '../../components/Icons'

interface Props {
  onAdd: (drafts: Draft[]) => void
}

const firstSense = (gloss: string) => gloss.split('; ')[0] ?? ''

export default function ScreenshotAdd({ onAdd }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [tokens, setTokens] = useState<string[]>([])
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    setError('')
    setTokens([])
    setPreview(URL.createObjectURL(file))
    setBusy(true)
    setStatus('Loading OCR…')
    setProgress(0)
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('chi_sim', 1, {
        logger: (m: { status: string; progress: number }) => {
          setStatus(m.status)
          setProgress(m.progress)
        },
      })
      const { data } = await worker.recognize(file)
      await worker.terminate()

      const dict = await ensureDict()
      // OCR sprinkles spaces between Chinese characters; strip them so multi-character
      // words (你好, 学习…) rejoin during segmentation.
      const seg = segment(data.text.replace(/\s+/g, ''), dict)
      // Keep known multi-character words and any single chars that have a gloss.
      const uniq = [...new Set(seg)].filter((w) => [...w].length > 1 || lookupGloss(w, dict))
      setTokens(uniq)
      setStatus(uniq.length ? '' : 'No Chinese words recognized — try a clearer image.')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  function addToken(w: string) {
    ensureDict().then((dict) => onAdd([makeDraft(w, firstSense(lookupGloss(w, dict)), 'screenshot')]))
  }
  function addAll() {
    ensureDict().then((dict) => onAdd(tokens.map((w) => makeDraft(w, firstSense(lookupGloss(w, dict)), 'screenshot'))))
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white py-8 text-slate-500 hover:border-brand-400 hover:text-brand-600"
      >
        <ImageIcon className="h-8 w-8" />
        <span className="text-sm font-medium">Choose a screenshot or photo</span>
        <span className="text-xs text-slate-400">reads Chinese text from the image</span>
      </button>

      {preview && (
        <img src={preview} alt="" className="mt-4 max-h-48 w-full rounded-xl object-contain ring-1 ring-slate-200" />
      )}

      {busy && (
        <div className="mt-4">
          <div className="mb-1 text-xs capitalize text-slate-500">{status || 'Working…'}</div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">First run downloads the recognition model (~15&nbsp;MB), then it's cached.</p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      {!busy && status && tokens.length === 0 && <p className="mt-4 text-sm text-slate-400">{status}</p>}

      {tokens.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-slate-500">{tokens.length} words found — tap to add</span>
            <button onClick={addAll} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              + Add all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tokens.map((w, i) => (
              <button
                key={`${w}-${i}`}
                onClick={() => addToken(w)}
                className="rounded-xl bg-white px-3 py-2 text-left ring-1 ring-slate-200 hover:ring-brand-400"
              >
                <div className="font-hanzi text-lg leading-tight text-slate-900">{w}</div>
                <div className="text-[11px] leading-tight text-sky-600">{pinyin(w, { toneType: 'symbol' })}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
