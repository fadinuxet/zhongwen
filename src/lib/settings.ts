import { getMeta, setMeta } from '../db/db'

export interface Settings {
  newPerDay: number
  maxReviews: number
  dailyGoal: number
  /** Review front shows hanzi (recall English) when true; otherwise shows English. */
  frontIsHanzi: boolean
  /** Show the Arabic gloss alongside the English meaning. */
  showArabic: boolean
  /** Preferred speech-synthesis voice URI, or '' for the browser default. */
  voiceURI: string
  speechRate: number
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 20,
  maxReviews: 200,
  dailyGoal: 30,
  frontIsHanzi: true,
  showArabic: true,
  voiceURI: '',
  speechRate: 0.9,
}

const KEY = 'settings'

export async function loadSettings(): Promise<Settings> {
  const saved = await getMeta<Partial<Settings>>(KEY, {})
  return { ...DEFAULT_SETTINGS, ...saved }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch }
  await setMeta(KEY, next)
  return next
}
