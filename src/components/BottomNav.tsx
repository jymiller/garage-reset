import type { Tab } from '../App'
import { GarageIcon } from './GarageIcons'

const items = [
  { id: 'home' as Tab, label: 'Home', icon: 'home' as const },
  { id: 'discover' as Tab, label: 'Add photo', icon: 'missions' as const },
  { id: 'crates' as Tab, label: 'Crates', icon: 'crate' as const },
  { id: 'layout' as Tab, label: 'Garage', icon: 'garage' as const },
  { id: 'more' as Tab, label: 'More', icon: 'more' as const },
]

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const activeTab = tab === 'labels' ? 'crates' : tab === 'snowball' || tab === 'play' || tab === 'observations' ? 'discover' : items.some(item => item.id === tab) ? tab : 'more'
  return <nav className="garage-nav" aria-label="Main navigation">
    <button className="garage-nav-brand" onClick={() => onChange('home')} aria-label="Garage Reset home"><span>G↗</span>Garage Reset</button>
    <div className="garage-nav-items">{items.map(({ id, label, icon }) => <button key={id} className={`${activeTab === id ? 'is-active' : ''}${id === 'discover' ? ' garage-nav-photo' : ''}`} aria-label={label} title={label} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onChange(id)}><GarageIcon name={icon} className="garage-nav-icon"/><span className="garage-nav-label">{label}</span></button>)}</div>
    <span className="garage-nav-note">A little less stuff. A little more room.</span>
  </nav>
}
