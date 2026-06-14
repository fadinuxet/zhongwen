import { useEffect, useRef, useState } from 'react'
import { pinyin } from 'pinyin-pro'
import { OBJECT_ZH } from '../../lib/objects'
import { makeDraft, type Draft } from '../../lib/capture'
import { CameraIcon } from '../../components/Icons'

interface Props {
  onAdd: (drafts: Draft[]) => void
}

interface Detected {
  label: string
  zh: string
  score: number
  bbox: [number, number, number, number]
}

type Phase = 'idle' | 'starting' | 'live' | 'frozen' | 'error'

interface CocoModel {
  detect: (
    el: HTMLVideoElement,
    maxNumBoxes?: number,
    minScore?: number,
  ) => Promise<Array<{ bbox: [number, number, number, number]; class: string; score: number }>>
}

// Higher recall than the defaults: detect more boxes at a lower confidence.
const MAX_BOXES = 20
const LIVE_MIN = 0.4 // live preview overlay
const CAPTURE_MIN = 0.28 // the deliberate "Detect" shot — cast a wider net

export default function CameraAdd({ onAdd }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const modelRef = useRef<CocoModel | null>(null)
  const rafRef = useRef<number>(0)
  const liveRef = useRef<Detected[]>([])
  const lastDetectRef = useRef<number>(0)

  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [frozen, setFrozen] = useState<Detected[]>([])

  useEffect(() => () => teardown(), [])

  function teardown() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function start() {
    setError('')
    setFrozen([])
    setPhase('starting')
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('no camera api'), { name: 'NotFoundError' })
      }
      setStatus('Starting camera…')
      // Request a high-resolution rear camera — bigger frames detect far better.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      // Don't await: play()'s promise can hang on some devices. The detection loop
      // waits for the video to become ready, so we proceed to load the model meanwhile.
      video.play().catch(() => {})

      if (!modelRef.current) {
        setStatus('Loading detection model…')
        const tf = await import('@tensorflow/tfjs')
        const cocoSsd = await import('@tensorflow-models/coco-ssd')
        await tf.ready()
        // Full mobilenet_v2 base is markedly more accurate than the lite model.
        modelRef.current = (await cocoSsd.load({ base: 'mobilenet_v2' })) as unknown as CocoModel
      }
      setPhase('live')
      setStatus('')
      rafRef.current = requestAnimationFrame(loop)
    } catch (e) {
      setError(humanError(e))
      setPhase('error')
      teardown()
    }
  }

  async function loop() {
    const video = videoRef.current
    const canvas = canvasRef.current
    const model = modelRef.current
    if (!video || !canvas || !model || video.readyState < 2 || !video.videoWidth) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
    // Throttle the heavy model to ~3 fps so the device stays cool; the preview
    // video itself stays smooth since it's a separate element.
    const now = performance.now()
    if (now - lastDetectRef.current >= 300) {
      lastDetectRef.current = now
      const raw = await model.detect(video, MAX_BOXES, LIVE_MIN)
      const dets = mapDetections(raw)
      liveRef.current = dets
      drawBoxes(canvas, dets)
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  function mapDetections(raw: Array<{ bbox: [number, number, number, number]; class: string; score: number }>): Detected[] {
    return raw
      .filter((d) => OBJECT_ZH[d.class])
      .map((d) => ({ label: d.class, zh: OBJECT_ZH[d.class], score: d.score, bbox: d.bbox }))
  }

  function drawBoxes(canvas: HTMLCanvasElement, dets: Detected[]) {
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const fs = Math.max(18, Math.round(canvas.width * 0.04))
    ctx.font = `600 ${fs}px 'PingFang SC','Hiragino Sans GB',sans-serif`
    ctx.textBaseline = 'top'
    ctx.lineWidth = Math.max(3, Math.round(canvas.width * 0.006))
    for (const d of dets) {
      const [x, y, w, h] = d.bbox
      ctx.strokeStyle = '#e11d48'
      ctx.strokeRect(x, y, w, h)
      const tw = ctx.measureText(d.zh).width
      const ly = y > fs + 10 ? y - fs - 10 : y
      ctx.fillStyle = '#e11d48'
      ctx.fillRect(x, ly, tw + 14, fs + 10)
      ctx.fillStyle = '#fff'
      ctx.fillText(d.zh, x + 7, ly + 5)
    }
  }

  async function capture() {
    cancelAnimationFrame(rafRef.current)
    const video = videoRef.current
    const canvas = canvasRef.current
    const model = modelRef.current

    // Run one more, wider-net detection on the current high-res frame, then freeze.
    let dets = liveRef.current
    if (video && model && video.videoWidth) {
      try {
        dets = mapDetections(await model.detect(video, MAX_BOXES, CAPTURE_MIN))
        if (canvas) drawBoxes(canvas, dets)
      } catch {
        /* fall back to the last live detections */
      }
    }
    video?.pause()

    // Keep the best-scoring box per object type.
    const byLabel = new Map<string, Detected>()
    for (const d of dets) {
      const prev = byLabel.get(d.label)
      if (!prev || d.score > prev.score) byLabel.set(d.label, d)
    }
    setFrozen([...byLabel.values()].sort((a, b) => b.score - a.score))
    setPhase('frozen')
  }

  async function resume() {
    setFrozen([])
    setPhase('live')
    await videoRef.current?.play().catch(() => {})
    rafRef.current = requestAnimationFrame(loop)
  }

  const showStage = phase === 'starting' || phase === 'live' || phase === 'frozen'

  return (
    <div>
      {phase === 'idle' && (
        <button
          onClick={start}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white py-8 text-slate-500 hover:border-brand-400 hover:text-brand-600"
        >
          <CameraIcon className="h-8 w-8" />
          <span className="text-sm font-medium">Start camera</span>
          <span className="text-xs text-slate-400">recognizes ~80 everyday objects (cup, chair, laptop…)</span>
        </button>
      )}

      {/* The video stays mounted/visible while active so iOS keeps decoding frames. */}
      <div className={`relative overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-200 ${showStage ? '' : 'hidden'}`}>
        <video ref={videoRef} playsInline muted className="block w-full" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        {phase === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 text-sm text-white">{status}</div>
        )}
      </div>

      {phase === 'starting' && (
        <p className="mt-2 text-center text-[11px] text-slate-400">First run downloads the detection model (~12&nbsp;MB), then it's cached.</p>
      )}

      {phase === 'live' && (
        <>
          <button onClick={capture} className="mt-3 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700">
            Detect objects
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Fill the frame with one object and hold steady for the best result.
          </p>
        </>
      )}

      {phase === 'frozen' && (
        <div className="mt-3">
          {frozen.length === 0 ? (
            <p className="text-center text-sm text-slate-400">No objects detected — try again with the object centered and well-lit.</p>
          ) : (
            <>
              <div className="mb-2 px-1 text-xs font-medium text-slate-500">Tap an object to add</div>
              <div className="flex flex-wrap gap-2">
                {frozen.map((d) => (
                  <button
                    key={d.label}
                    onClick={() => onAdd([makeDraft(d.zh, d.label, 'photo', 'objects')])}
                    className="rounded-xl bg-white px-3 py-2 text-left ring-1 ring-slate-200 hover:ring-brand-400"
                  >
                    <div className="font-hanzi text-lg leading-tight text-slate-900">{d.zh}</div>
                    <div className="text-[11px] leading-tight text-sky-600">{pinyin(d.zh, { toneType: 'symbol' })}</div>
                    <div className="text-[11px] text-slate-500">
                      {d.label} · {Math.round(d.score * 100)}%
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          <button onClick={resume} className="mt-3 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200">
            Resume camera
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
  if (name === 'NotReadableError') return 'The camera is in use by another app.'
  return 'Could not start the camera. ' + String((e as { message?: string })?.message ?? e)
}
