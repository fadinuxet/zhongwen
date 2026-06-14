/** Score how closely a spoken sentence matched the target, by character overlap in order. */
const cjk = (s: string) => s.replace(/[^㐀-鿿]/g, '')

function lcsLen(a: string[], b: string[]): number {
  const m = a.length
  const n = b.length
  const dp = new Array(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    let prev = 0
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

export interface ShadowScore {
  pct: number
  matched: boolean
  heard: string
}

export function shadowScore(target: string, transcripts: string[]): ShadowScore {
  const t = [...cjk(target)]
  if (t.length === 0) return { pct: 0, matched: false, heard: transcripts[0] ?? '' }
  let best = 0
  let bestHeard = transcripts[0] ?? ''
  for (const tr of transcripts) {
    const r = cjk(tr)
    const score = lcsLen([...r], t) / t.length
    if (score > best) {
      best = score
      bestHeard = r
    }
  }
  const pct = Math.round(best * 100)
  return { pct, matched: pct >= 70, heard: bestHeard }
}
