import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Today from './pages/Today'
import Library from './pages/Library'
import Capture from './pages/Capture'
import Practice from './pages/Practice'
import Quiz from './pages/Quiz'
import Pronounce from './pages/practice/Pronounce'
import Tones from './pages/practice/Tones'
import Reading from './pages/practice/Reading'
import Shadow from './pages/practice/Shadow'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import Review from './pages/Review'
import { dedupeDeck, ensureSeeded } from './lib/seed'
import { SettingsProvider } from './lib/SettingsContext'

export default function App() {
  const [booted, setBooted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensureSeeded()
      .then(() => dedupeDeck()) // self-heal any decks duplicated by an earlier seed race
      .then(() => setBooted(true))
      .catch((e) => setError(String(e)))
  }, [])

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-brand-600">Couldn't load your deck.</p>
        <p className="text-xs text-slate-500">{error}</p>
      </div>
    )
  }

  if (!booted) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2">
        <div className="font-hanzi text-7xl font-bold text-slate-900">中文</div>
        <div className="text-lg text-slate-400">by</div>
        <div className="font-hanzi text-4xl font-semibold text-slate-700">法迪</div>
        <div className="mt-8 h-1 w-24 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-500" />
        </div>
      </div>
    )
  }

  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Today />} />
            <Route path="/library" element={<Library />} />
            <Route path="/capture" element={<Capture />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/pronounce" element={<Pronounce />} />
            <Route path="/tones" element={<Tones />} />
            <Route path="/reading" element={<Reading />} />
            <Route path="/shadow" element={<Shadow />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="/review" element={<Review />} />
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  )
}
