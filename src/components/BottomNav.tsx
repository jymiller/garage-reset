import type { Tab } from '../App'
import { HomeIcon, GridIcon, BoltIcon, MapIcon } from './icons'

function MoreIcon({className}: {className?: string}) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
}
const items = [
  { id: 'home' as Tab, label: 'Home', Icon: HomeIcon },
  { id: 'play' as Tab, label: 'Missions', Icon: BoltIcon },
  { id: 'crates' as Tab, label: 'Crates', Icon: GridIcon },
  { id: 'layout' as Tab, label: 'Garage', Icon: MapIcon },
  { id: 'more' as Tab, label: 'More', Icon: MoreIcon },
]

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const activeTab = tab === 'snowball' ? 'play' : items.some(item => item.id === tab) ? tab : 'more'
  return <nav className="garage-nav" aria-label="Main navigation">
    <button className="garage-nav-brand" onClick={() => onChange('home')} aria-label="Garage Reset home"><span>G↗</span>Garage Reset</button>
    <div className="garage-nav-items">{items.map(({ id, label, Icon }) => <button key={id} className={activeTab === id ? 'is-active' : ''} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onChange(id)}><Icon className="garage-nav-icon"/><span>{label}</span></button>)}</div>
    <span className="garage-nav-note">A little less stuff. A little more room.</span>
  </nav>
}
