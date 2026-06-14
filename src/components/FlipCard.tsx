import { useMemo } from 'react'
import { State } from 'ts-fsrs'
import type { Card } from '../db/db'
import { categoryHue, titleCase } from '../lib/format'
import { exampleSentence } from '../lib/enrich'
import WordArt from './WordArt'
import { useSettings } from '../lib/SettingsContext'
import { speak, speechSupported } from '../lib/speech'
import { InfoIcon, SpeakerIcon } from './Icons'

interface Props {
  card: Card
  flipped: boolean
  onFlip: (id: number) => void
  onDetails: (card: Card) => void
}

/** Size the hanzi down as the phrase gets longer so it fits alongside the emoji + pinyin. */
function hanziSize(hanzi: string): string {
  const n = [...hanzi].length
  if (n <= 1) return 'text-4xl'
  if (n === 2) return 'text-3xl'
  if (n <= 4) return 'text-2xl'
  if (n <= 6) return 'text-xl'
  return 'text-lg'
}

export default function FlipCard({ card, flipped, onFlip, onDetails }: Props) {
  const { settings } = useSettings()
  const hue = categoryHue(card.category)
  const dot = `hsl(${hue} 60% 50%)`
  const example = useMemo(() => exampleSentence(card), [card.id])

  const playWord = (e: React.MouseEvent) => {
    e.stopPropagation()
    speak(card.hanzi, { voiceURI: settings.voiceURI, rate: settings.speechRate })
  }
  const playExample = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (example) speak(example.hanzi, { voiceURI: settings.voiceURI, rate: settings.speechRate })
  }

  return (
    <div className="flip aspect-[3/4]">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onFlip(card.id!)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onFlip(card.id!)
          }
        }}
        className={`flip-inner cursor-pointer ${flipped ? 'is-flipped' : ''}`}
      >
        {/* FRONT — picture · hanzi · pinyin */}
        <div className="flip-face overflow-hidden rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 truncate text-[10px] font-medium text-slate-400">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
              <span className="truncate">{titleCase(card.category)}</span>
            </span>
            {card.suspended ? <span className="text-[9px] uppercase tracking-wide text-slate-300">off</span> : null}
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-1">
            <WordArt card={card} className="h-14 w-14" />
            <span className={`font-hanzi break-all text-center font-bold leading-tight text-slate-900 ${hanziSize(card.hanzi)}`}>
              {card.hanzi}
            </span>
            <span className="text-center text-sm font-medium leading-tight text-sky-600">{card.pinyin}</span>
          </div>

          <div className="flex items-center justify-between">
            <FreqDots n={card.frequency} hue={hue} />
            {speechSupported() && (
              <button onClick={playWord} aria-label="Play" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <SpeakerIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* BACK — meaning + example sentence */}
        <div className="flip-face flip-face-back overflow-hidden rounded-2xl bg-brand-50 p-3 shadow-sm ring-1 ring-brand-100">
          <div className="flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDetails(card)
              }}
              aria-label="Details"
              className="rounded-full p-1 text-brand-400 hover:bg-white/60 hover:text-brand-600"
            >
              <InfoIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center px-1 text-center">
            <div className="text-base font-semibold leading-snug text-slate-800">{card.english}</div>
            {card.state !== State.New && <div className="mt-1 text-[10px] text-brand-400">in your deck</div>}
          </div>

          {example ? (
            <button
              onClick={playExample}
              className="mt-1 w-full rounded-lg bg-white/70 p-1.5 text-left ring-1 ring-brand-100 active:scale-[0.99]"
            >
              <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-brand-400">
                <SpeakerIcon className="h-3 w-3" /> Example
              </div>
              <div className="font-hanzi text-sm leading-snug text-slate-800">{example.hanzi}</div>
              <div className="text-[10px] leading-tight text-sky-700">{example.pinyin}</div>
            </button>
          ) : (
            speechSupported() && (
              <div className="flex justify-end">
                <button onClick={playWord} aria-label="Play" className="rounded-full p-1.5 text-brand-400 hover:bg-white/60 hover:text-brand-600">
                  <SpeakerIcon className="h-4 w-4" />
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function FreqDots({ n, hue }: { n: number; hue: number }) {
  const dots = Math.max(1, Math.min(5, n))
  return (
    <span className="flex items-center gap-0.5" title={`seen ${n}×`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: i < dots ? `hsl(${hue} 55% 55%)` : '#e2e8f0' }} />
      ))}
    </span>
  )
}
