import { State } from 'ts-fsrs'

/** Stable hue (0–360) derived from a category name, for per-category accent dots. */
export function categoryHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return h
}

export function titleCase(s: string): string {
  return s
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export function stateLabel(state: State): string {
  switch (state) {
    case State.New:
      return 'New'
    case State.Learning:
      return 'Learning'
    case State.Review:
      return 'Review'
    case State.Relearning:
      return 'Relearning'
    default:
      return 'Unknown'
  }
}

/** "in 3 days" / "due now" — relative due time for the Library/card detail. */
export function relativeDue(due: Date, state: State, now: number = Date.now()): string {
  if (state === State.New) return 'new'
  const ms = due.getTime() - now
  if (ms <= 0) return 'due now'
  const mins = ms / 60000
  if (mins < 60) return `in ${Math.round(mins)}m`
  const hours = mins / 60
  if (hours < 24) return `in ${Math.round(hours)}h`
  const days = hours / 24
  if (days < 30) return `in ${Math.round(days)}d`
  const months = days / 30
  if (months < 12) return `in ${Math.round(months)}mo`
  return `in ${(days / 365).toFixed(1)}y`
}
