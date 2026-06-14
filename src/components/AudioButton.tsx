import { useSettings } from '../lib/SettingsContext'
import { speak, speechSupported } from '../lib/speech'
import { SpeakerIcon } from './Icons'

interface Props {
  text: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
}

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
}

/** Tap to hear the hanzi pronounced with the user's chosen voice/rate. */
export default function AudioButton({ text, className = '', size = 'md' }: Props) {
  const { settings } = useSettings()
  if (!speechSupported()) return null

  return (
    <button
      type="button"
      aria-label="Play pronunciation"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        speak(text, { voiceURI: settings.voiceURI, rate: settings.speechRate })
      }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-200 hover:text-slate-800 active:scale-95 ${sizes[size]} ${className}`}
    >
      <SpeakerIcon className={iconSizes[size]} />
    </button>
  )
}
