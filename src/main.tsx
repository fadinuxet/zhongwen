import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { primeSpeech } from './lib/speech'
import './index.css'

// Keep the installed PWA up to date automatically.
registerSW({ immediate: true })

// Warm up speech voices so the first audio tap plays without delay.
primeSpeech()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
