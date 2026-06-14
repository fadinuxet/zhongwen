import { useMemo, useState } from 'react'
import type { Card } from '../db/db'
import { wordArtSrc } from '../lib/wordArt'

/** A colorful OpenMoji illustration of the card's meaning. */
export default function WordArt({ card, className = '' }: { card: Card; className?: string }) {
  const src = useMemo(() => wordArtSrc(card), [card.id])
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
    />
  )
}
