import { useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { Dashboard } from './screens/Dashboard'
import { People } from './screens/People'
import { Zones } from './screens/Zones'
import { Snowball } from './screens/Snowball'
import { Capture } from './screens/Capture'
import { Garage } from './screens/Garage'

export type Tab = 'dashboard' | 'people' | 'zones' | 'snowball' | 'capture' | 'layout'

export function App() {
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-50 text-slate-900">
      <main className="flex-1 px-4 pb-28 pt-6">
        {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
        {tab === 'people' && <People />}
        {tab === 'zones' && <Zones />}
        {tab === 'snowball' && <Snowball />}
        {tab === 'layout' && <Garage />}
        {tab === 'capture' && <Capture />}
      </main>
      <BottomNav tab={tab} onChange={setTab} />
    </div>
  )
}
