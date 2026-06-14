import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings'

interface Ctx {
  settings: Settings
  update: (patch: Partial<Settings>) => Promise<void>
  ready: boolean
}

const SettingsCtx = createContext<Ctx>({
  settings: DEFAULT_SETTINGS,
  update: async () => {},
  ready: false,
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s)
      setReady(true)
    })
  }, [])

  const update = async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch)
    setSettings(next)
  }

  return <SettingsCtx.Provider value={{ settings, update, ready }}>{children}</SettingsCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): Ctx {
  return useContext(SettingsCtx)
}
