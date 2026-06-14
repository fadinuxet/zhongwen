/** Thin wrapper over the Web Speech API for zh-CN pronunciation. */

let cachedVoices: SpeechSynthesisVoice[] | null = null

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Voices load asynchronously in most browsers; resolve once they're available. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return Promise.resolve([])
  const existing = window.speechSynthesis.getVoices()
  if (existing.length) {
    cachedVoices = existing
    return Promise.resolve(existing)
  }
  return new Promise((resolve) => {
    const done = () => {
      cachedVoices = window.speechSynthesis.getVoices()
      resolve(cachedVoices)
    }
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    // Safety net in case the event never fires.
    setTimeout(done, 1000)
  })
}

export function chineseVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.filter((v) => /^zh(-|_)?(CN|Hans|TW|HK)?/i.test(v.lang) || /chinese|中文|普通话/i.test(v.name))
}

function pickVoice(voiceURI: string): SpeechSynthesisVoice | undefined {
  const voices = cachedVoices ?? window.speechSynthesis.getVoices()
  if (voiceURI) {
    const exact = voices.find((v) => v.voiceURI === voiceURI)
    if (exact) return exact
  }
  return chineseVoices(voices)[0]
}

export interface SpeakOptions {
  voiceURI?: string
  rate?: number
}

function utter(text: string, opts: SpeakOptions): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  const voice = pickVoice(opts.voiceURI ?? '')
  if (voice) u.voice = voice
  u.lang = voice?.lang ?? 'zh-CN'
  u.rate = opts.rate ?? 0.9
  return u
}

/** Speak Chinese text. Robust against the common Chrome/Safari "silent" quirks. */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!speechSupported() || !text) return
  const synth = window.speechSynthesis
  try {
    // Chrome sometimes leaves synthesis paused — resume defensively.
    if (synth.paused) synth.resume()

    const wasBusy = synth.speaking || synth.pending
    synth.cancel()

    const go = () => {
      // Voices may not be ready on the very first call; load then speak.
      if (!cachedVoices && synth.getVoices().length === 0) {
        loadVoices().then(() => synth.speak(utter(text, opts)))
      } else {
        synth.speak(utter(text, opts))
      }
    }
    // Speaking immediately after cancel() can be dropped in Chrome; if something
    // was playing, wait a tick before queuing the new utterance.
    if (wasBusy) setTimeout(go, 60)
    else go()
  } catch {
    /* ignore — speech is best-effort */
  }
}

/** Warm up the voice list early so the first tap speaks without a hiccup. */
export function primeSpeech(): void {
  if (speechSupported()) loadVoices()
}
