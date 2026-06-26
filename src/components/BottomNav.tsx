import type { Tab } from '../App'
import { HomeIcon, UsersIcon, GridIcon, BoltIcon, PlusIcon, MapIcon } from './icons'
import { sound } from '../sound'

const items: { id: Tab; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'dashboard', label: 'HUD', Icon: HomeIcon },
  { id: 'people', label: 'PLAYERS', Icon: UsersIcon },
  { id: 'snowball', label: 'PLAY', Icon: BoltIcon },
  { id: 'layout', label: 'MAP', Icon: MapIcon },
  { id: 'zones', label: 'ZONES', Icon: GridIcon },
  { id: 'capture', label: 'LOOT', Icon: PlusIcon },
]

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#2bd14a] bg-[#07070e]">
      <div className="pb-safe mx-auto flex max-w-md items-stretch justify-around px-1 pt-2">
        {items.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => {
                sound.tap()
                onChange(id)
              }}
              className={`flex flex-1 flex-col items-center gap-1 py-1 transition ${
                active ? 'text-[#2bd14a]' : 'text-[#4f4f66]'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'scale-110' : ''} transition`} />
              <span className="font-pixel text-[7px] tracking-tight">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
