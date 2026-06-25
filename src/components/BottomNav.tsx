import type { Tab } from '../App'
import { HomeIcon, UsersIcon, GridIcon, BoltIcon, PlusIcon, MapIcon } from './icons'

const items: { id: Tab; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'dashboard', label: 'Home', Icon: HomeIcon },
  { id: 'people', label: 'People', Icon: UsersIcon },
  { id: 'snowball', label: 'Snowball', Icon: BoltIcon },
  { id: 'layout', label: 'Layout', Icon: MapIcon },
  { id: 'zones', label: 'Zones', Icon: GridIcon },
  { id: 'capture', label: 'Capture', Icon: PlusIcon },
]

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/90 backdrop-blur">
      <div className="pb-safe mx-auto flex max-w-md items-stretch justify-around px-2 pt-2">
        {items.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition ${
                active ? 'text-emerald-600' : 'text-slate-400'
              }`}
            >
              <Icon className={`h-6 w-6 ${active ? 'scale-110' : ''} transition`} />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
