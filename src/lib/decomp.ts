/** Character decomposition (makemeahanzi): char → components, radical, gloss. */
export interface DecompEntry {
  c: string[]
  r: string
  g: string
}
export type DecompMap = Record<string, DecompEntry>

let cache: DecompMap | null = null
let loading: Promise<DecompMap> | null = null

export function ensureDecomp(): Promise<DecompMap> {
  if (cache) return Promise.resolve(cache)
  if (!loading) {
    loading = fetch(import.meta.env.BASE_URL + 'decomp.json')
      .then((r) => r.json())
      .then((d: DecompMap) => (cache = d))
  }
  return loading
}

export function glossOf(char: string, map: DecompMap): string {
  return map[char]?.g ?? ''
}

/** Components of a character that are themselves meaningful (have a gloss or sub-parts). */
export function meaningfulComponents(char: string, map: DecompMap): { ch: string; gloss: string }[] {
  const e = map[char]
  if (!e) return []
  return e.c.map((ch) => ({ ch, gloss: map[ch]?.g ?? '' }))
}

/** A one-line mnemonic built from a character's components, e.g. 好 = 女 (woman) + 子 (child). */
export function mnemonic(char: string, map: DecompMap): string | null {
  const comps = meaningfulComponents(char, map)
  const withGloss = comps.filter((c) => c.gloss)
  if (withGloss.length < 2) return null
  return withGloss.map((c) => `${c.ch} (${c.gloss})`).join(' + ')
}
