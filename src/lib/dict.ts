/**
 * Offline CN↔EN dictionary backed by a compacted CC-CEDICT (public/cedict.json):
 * a map of simplified-hanzi → "gloss; gloss". Lazy-loaded on first use and then
 * cached (and Service-Worker cached) so the app stays light on startup.
 */

export type Dict = Record<string, string>

let cache: Dict | null = null
let loading: Promise<Dict> | null = null

const MAX_WORD = 6

export function dictReady(): boolean {
  return cache !== null
}

export function ensureDict(): Promise<Dict> {
  if (cache) return Promise.resolve(cache)
  if (!loading) {
    loading = fetch(import.meta.env.BASE_URL + 'cedict.json')
      .then((r) => {
        if (!r.ok) throw new Error(`dictionary ${r.status}`)
        return r.json()
      })
      .then((d: Dict) => {
        cache = d
        return d
      })
  }
  return loading
}

const isCJK = (ch: string) => /[㐀-鿿]/.test(ch)

/** Greedy longest-match segmentation; unknown characters become single tokens. */
export function segment(text: string, dict: Dict): string[] {
  const chars = [...text]
  const out: string[] = []
  let i = 0
  while (i < chars.length) {
    if (!isCJK(chars[i])) {
      i++
      continue
    }
    let matched = ''
    for (let len = Math.min(MAX_WORD, chars.length - i); len >= 1; len--) {
      const cand = chars.slice(i, i + len).join('')
      if (dict[cand]) {
        matched = cand
        break
      }
    }
    if (matched) {
      out.push(matched)
      i += [...matched].length
    } else {
      out.push(chars[i])
      i += 1
    }
  }
  return out
}

export function lookupGloss(word: string, dict: Dict): string {
  return dict[word] ?? ''
}

export interface EnHit {
  hanzi: string
  gloss: string
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Reverse lookup: English term → candidate Chinese words, best matches first. */
export function searchEnglish(term: string, dict: Dict, limit = 40): EnHit[] {
  const t = term.trim().toLowerCase()
  if (t.length < 1) return []
  const boundary = new RegExp(`(^|[^a-z])${escapeRe(t)}([^a-z]|$)`)
  const hits: { hanzi: string; gloss: string; rank: number }[] = []
  for (const hanzi in dict) {
    const gloss = dict[hanzi]
    const lower = gloss.toLowerCase()
    if (!lower.includes(t)) continue // fast reject before the per-sense work
    let rank = 9
    for (const s of lower.split('; ')) {
      if (s === t || s === 'to ' + t) {
        rank = 0
        break
      }
      if (s.startsWith(t + ' ') || s.startsWith('to ' + t + ' ')) rank = Math.min(rank, 1)
      else if (boundary.test(s)) rank = Math.min(rank, 2)
    }
    if (rank < 9) hits.push({ hanzi, gloss, rank })
  }
  hits.sort(
    (a, b) => a.rank - b.rank || [...a.hanzi].length - [...b.hanzi].length || a.hanzi.localeCompare(b.hanzi),
  )
  return hits.slice(0, limit).map(({ hanzi, gloss }) => ({ hanzi, gloss }))
}
