import { useEffect, useMemo, useRef, useState } from 'react'
import { pinyin } from 'pinyin-pro'
import { db } from '../../db/db'
import { ensureDict, lookupGloss, segment } from '../../lib/dict'
import { isKnown } from '../../lib/reading'
import { makeDraft, type Draft } from '../../lib/capture'
import { useSettings } from '../../lib/SettingsContext'
import { speak } from '../../lib/speech'
import { CameraIcon, SpeakerIcon } from '../../components/Icons'

interface Props {
  onAdd: (drafts: Draft[]) => void
}

type Phase = 'idle' | 'starting' | 'live' | 'reading' | 'result' | 'error'

interface Word {
  text: string
  known: boolean
  gloss: string
}

interface TWord {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

const firstSense = (g: string) => g.split('; ')[0] ?? ''

export default function CameraText({ onAdd }: Props) {
  const { settings } = useSettings()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerRef = useRef<any>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [words, setWords] = useState<Word[]>([])
  const [knownSet, setKnownSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    db.cards.toArray().then((cards) => setKnownSet(new Set(cards.filter(isKnown).map((c) => c.hanzi))))
    return () => teardown()
  }, [])

  function teardown() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    workerRef.current?.terminate?.()
    workerRef.current = null
  }

  async function start() {
    setError('')
    setWords([])
    setPhase('starting')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no camera'), { name: 'NotFoundError' })
      setStatus('Starting camera…')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      video.play().catch(() => {})
      setPhase('live')
      setStatus('')
    } catch (e) {
      setError(humanError(e))
      setPhase('error')
      teardown()
    }
  }

  async function read() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return
    setPhase('reading')
    setStatus('Loading OCR…')
    try {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      if (!workerRef.current) {
        const { createWorker } = await import('tesseract.js')
        workerRef.current = await createWorker('chi_sim', 1, {
          logger: (m: { status: string }) => setStatus(m.status),
        })
      }
      const { data } = await workerRef.current.recognize(canvas)
      const dict = await ensureDict()

      // Deck-aware word list (segment the recognized text, drop OCR spaces).
      const tokens = segment((data.text as string).replace(/\s+/g, ''), dict)
      const uniq = [...new Set(tokens)].filter((w) => [...w].length > 1 || lookupGloss(w, dict))
      setWords(
        uniq.map((w) => ({ text: w, known: knownSet.has(w), gloss: firstSense(lookupGloss(w, dict)) })),
      )

      // Overlay colored boxes on the frozen frame using Tesseract's word boxes.
      const tw: TWord[] = (data.words as TWord[]) ?? []
      ctx.lineWidth = Math.max(2, Math.round(canvas.width * 0.004))
      for (const word of tw) {
        const t = (word.text || '').replace(/[^㐀-鿿]/g, '')
        if (!t) continue
        const known = [...t].every((ch) => knownSet.has(ch)) || knownSet.has(t)
        const { x0, y0, x1, y1 } = word.bbox
        ctx.strokeStyle = known ? '#10b981' : '#f43f5e'
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
      }

      video.pause()
      setStatus(uniq.length ? '' : 'No Chinese text found — try a clearer, closer shot.')
      setPhase('result')
    } catch (e) {
      setError(String(e))
      setPhase('live')
    }
  }

  async function resume() {
    setWords([])
    setPhase('live')
    await videoRef.current?.play().catch(() => {})
  }

  const newWords = useMemo(() => words.filter((w) => !w.known), [words])

  const showStage = phase === 'starting' || phase === 'live' || phase === 'reading' || phase === 'result'

  return (
    <div>
      {phase === 'idle' && (
        <button
          onClick={start}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white py-8 text-slate-500 hover:border-brand-400 hover:text-brand-600"
        >
          <CameraIcon className="h-8 w-8" />
          <span className="text-sm font-medium">Read Chinese around you</span>
          <span className="text-xs text-slate-400">point at a sign, menu, or page</span>
        </button>
      )}

      <div className={`relative overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-200 ${showStage ? '' : 'hidden'}`}>
        <video ref={videoRef} playsInline muted className={`block w-full ${phase === 'result' ? 'hidden' : ''}`} />
        <canvas ref={canvasRef} className={`block w-full ${phase === 'result' ? '' : 'hidden'}`} />
        {(phase === 'starting' || phase === 'reading') && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 text-sm capitalize text-white">
            {status || 'Working…'}
          </div>
        )}
      </div>

      {phase === 'reading' && (
        <p className="mt-2 text-center text-[11px] text-slate-400">First run downloads the OCR model (~15&nbsp;MB), then it's cached.</p>
      )}

      {phase === 'live' && (
        <button onClick={read} className="mt-3 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700">
          Read text
        </button>
      )}

      {phase === 'result' && (
        <div className="mt-3">
          {words.length === 0 ? (
            <p className="text-center text-sm text-slate-400">{status || 'No Chinese text found.'}</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between px-1 text-xs">
                <span className="font-medium text-slate-500">
                  <span className="text-emerald-600">green = you know it</span> ·{' '}
                  <span className="text-rose-500">red = new</span>
                </span>
                {newWords.length > 0 && (
                  <button
                    onClick={() => onAdd(newWords.map((w) => makeDraft(w.text, w.gloss, 'photo')))}
                    className="font-medium text-brand-600"
                  >
                    + Add {newWords.length} new
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {words.map((w, i) => (
                  <button
                    key={`${w.text}-${i}`}
                    onClick={() =>
                      w.known
                        ? speak(w.text, { voiceURI: settings.voiceURI, rate: settings.speechRate })
                        : onAdd([makeDraft(w.text, w.gloss, 'photo')])
                    }
                    className={`rounded-xl px-3 py-2 text-left ring-1 ${
                      w.known ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-slate-200 hover:ring-brand-400'
                    }`}
                  >
                    <div className="font-hanzi text-lg leading-tight text-slate-900">{w.text}</div>
                    <div className="text-[11px] leading-tight text-sky-600">{pinyin(w.text, { toneType: 'symbol' })}</div>
                    {w.known ? (
                      <div className="flex items-center gap-1 text-[11px] text-emerald-600">
                        <SpeakerIcon className="h-3 w-3" /> known
                      </div>
                    ) : (
                      <div className="max-w-[16ch] truncate text-[11px] text-slate-500">{w.gloss || 'tap to add'}</div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          <button onClick={resume} className="mt-3 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200">
            Read another
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div className="rounded-2xl bg-rose-50 p-4 text-center ring-1 ring-rose-200">
          <p className="text-sm text-rose-700">{error}</p>
          <button onClick={start} className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

function humanError(e: unknown): string {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access and try again.'
  if (name === 'NotFoundError') return 'No camera available on this device or browser.'
  return 'Could not start the camera. ' + String((e as { message?: string })?.message ?? e)
}
