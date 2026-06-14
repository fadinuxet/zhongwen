import { useEffect, useState } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Wraps the PWA install flow. On Chromium desktop/Android the browser fires
 * `beforeinstallprompt`; we stash it and expose a one-tap install button.
 */
export function useInstall() {
  const [evt, setEvt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvt(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    if (window.matchMedia?.('(display-mode: standalone)').matches) setInstalled(true)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!evt) return
    evt.prompt()
    await evt.userChoice
    setEvt(null)
  }

  return { canInstall: !!evt && !installed, installed, install }
}
