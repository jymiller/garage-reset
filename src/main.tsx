import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { StoreProvider } from './store'
import { sound } from './sound'

// Prime audio on the first interaction so iOS unlocks Web Audio (and ignores the silent switch).
window.addEventListener('pointerdown', () => sound.prime(), { once: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
