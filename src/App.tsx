import { useState, useEffect } from 'react'
import { BottomNav } from './components/BottomNav'
import { Dashboard } from './screens/Dashboard'
import { People } from './screens/People'
import { Zones } from './screens/Zones'
import { PhotoPlay } from './play/PhotoPlay'
import { Capture } from './screens/Capture'
import { Garage } from './screens/Garage'
import { SoundTest } from './screens/SoundTest'
import { TitleScreen } from './screens/TitleScreen'
import { FinalStandings } from './screens/FinalStandings'
import { useStore } from './store'
import { allCleared } from './game'
import { sound } from './sound'
import { PickupPlanner } from './pickup/PickupPlanner'
import { CrateWorkspace } from './crates/CrateWorkspace'

export type Tab = 'dashboard' | 'people' | 'zones' | 'snowball' | 'capture' | 'layout' | 'sound' | 'results' | 'pickup' | 'crates' | 'play'

export function App() {
  const { tasks } = useStore()
  const [tab, setTab] = useState<Tab>(() => {
    const hash = window.location.hash.slice(1)
    return (['pickup', 'crates', 'play', 'dashboard', 'people', 'zones', 'snowball', 'capture', 'layout', 'sound', 'results'] as Tab[]).includes(hash as Tab) ? hash as Tab : 'pickup'
  })
  useEffect(() => {
    const followHash = () => {
      const hash = window.location.hash.slice(1)
      if (['pickup', 'crates', 'play', 'dashboard', 'people', 'zones', 'snowball', 'capture', 'layout', 'sound', 'results'].includes(hash)) setTab(hash as Tab)
    }
    window.addEventListener('hashchange', followHash)
    return () => window.removeEventListener('hashchange', followHash)
  }, [])
  const [playCrateId, setPlayCrateId] = useState<string|null>(null)
  const [crateInitialStep, setCrateInitialStep] = useState<'locate' | 'repack'>('repack')
  const [crateFocus, setCrateFocus] = useState<string|null>(null)
  const [started, setStarted] = useState(true)
  const [shownResults, setShownResults] = useState(false)
  const done = allCleared(tasks)

  useEffect(() => {
    document.body.classList.toggle('pickup-active', tab === 'pickup' || tab === 'crates' || tab === 'play' || tab === 'snowball' || tab === 'layout')
    history.replaceState(null, '', `#${tab}`)
    window.scrollTo(0, 0)
    return () => document.body.classList.remove('pickup-active')
  }, [tab])

  useEffect(() => {
    if (started && done && !shownResults && tab !== 'pickup' && tab !== 'crates' && tab !== 'play' && tab !== 'snowball' && tab !== 'layout') {
      setTab('results')
      setShownResults(true)
    } else if (!done && shownResults) {
      setShownResults(false)
    }
  }, [started, done, shownResults, tab])

  if (!started) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <TitleScreen
          onStart={() => {
            sound.prime()
            sound.start()
            setStarted(true)
          }}
        />
      </div>
    )
  }

  if (tab === 'layout') return <Garage onNavigate={setTab} onOpenCrate={id => { setCrateFocus(id); setCrateInitialStep('locate'); setTab('crates') }} />
  if (tab === 'pickup') return <PickupPlanner onNavigate={setTab} />
  if (tab === 'crates') return <CrateWorkspace onNavigate={t=>{setCrateFocus(null);setTab(t)}} initialCrateId={crateFocus} initialStep={crateInitialStep} onPlayCrate={id=>{setPlayCrateId(id);setCrateFocus(null);setTab('play')}} />
  if (tab === 'play' || tab === 'snowball') return <PhotoPlay onNavigate={t=>{setPlayCrateId(null);setTab(t)}} initialCrateId={playCrateId} onOpenCrate={id=>{setCrateFocus(id);setCrateInitialStep('repack');setPlayCrateId(null);setTab('crates')}} />

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-28 pt-6">
        <button className="arc-vt mb-5 text-sm text-[#e8cc75]" onClick={() => setTab('pickup')}>← PICKUP PLANNER</button>
        {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
        {tab === 'people' && <People />}
        {tab === 'zones' && <Zones />}
        {tab === 'capture' && <Capture />}
        {tab === 'sound' && <SoundTest onNavigate={setTab} />}
        {tab === 'results' && <FinalStandings onNavigate={setTab} />}
      </main>
      <BottomNav tab={tab} onChange={setTab} />
    </div>
  )
}
