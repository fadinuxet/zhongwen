import type { Card } from '../db/db'
import { cardArabic } from '../lib/arabic'
import { useSettings } from '../lib/SettingsContext'

interface Props {
  card: Pick<Card, 'hanzi' | 'arabic'>
  className?: string
}

/**
 * The Arabic translation of a card, rendered right-to-left. Renders nothing when
 * the user has Arabic turned off or no gloss is known for the word.
 */
export default function ArabicGloss({ card, className = '' }: Props) {
  const { settings } = useSettings()
  if (!settings.showArabic) return null
  const ar = cardArabic(card)
  if (!ar) return null
  return (
    <div dir="rtl" lang="ar" className={`font-arabic ${className}`}>
      {ar}
    </div>
  )
}
