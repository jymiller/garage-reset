import { ShareFamilyLink } from '../access/ShareFamilyLink'
import type { Tab } from '../App'
import { GarageIcon } from '../components/GarageIcons'
import { InstallGuide } from './InstallGuide'
import type { GarageIconName } from '../components/GarageIcons'
import './start.css'

const tools: {tab: Tab; icon: GarageIconName; title: string}[] = [
  {tab: 'labels', icon: 'crate', title: 'Label crates'},
  {tab: 'observations', icon: 'missions', title: 'Your photos'},
  {tab: 'play', icon: 'floor', title: 'Cleanup missions'},
  {tab: 'score', icon: 'trophy', title: 'Points'},
  {tab: 'pickup', icon: 'pickup', title: 'Yellow Sack pickup'},
  {tab: 'people', icon: 'crew', title: 'The crew'},
]
const extraTools: typeof tools = [
  {tab: 'zones', icon: 'board', title: 'Task board'},
  {tab: 'capture', icon: 'crate', title: 'Item list (this device)'},
  {tab: 'dashboard', icon: 'trophy', title: 'Task progress'},
  {tab: 'results', icon: 'trophy', title: 'Team standings'},
  {tab: 'sound', icon: 'sound', title: 'Sounds'},
]

export function More({onNavigate}: {onNavigate: (tab: Tab) => void}) {
  const toolButton = (tool: typeof tools[number]) => <button key={tool.tab} onClick={() => onNavigate(tool.tab)}><span className="home-tool-icon"><GarageIcon name={tool.icon}/></span><strong>{tool.title}</strong><span aria-hidden="true">→</span></button>
  return <main className="reset-home home-more">
    <header className="home-heading"><div><h1>More</h1></div></header>
    <section className="home-more-tools" aria-label="Garage tools">{tools.map(toolButton)}</section>
    <details className="more-install"><summary>Invite someone</summary><ShareFamilyLink/></details>
    <details className="more-install"><summary>Add to iPhone Home Screen</summary><InstallGuide /></details>
    <details className="more-install"><summary>Other tools</summary><section className="home-more-tools" aria-label="Other garage tools">{extraTools.map(toolButton)}</section></details>
    <section className="home-guide" aria-labelledby="phone-guide">
      <h2 id="phone-guide">Help</h2>
      <details><summary>Add a photo</summary><p>Tap <b>Add photo</b>. Take or choose any garage photo, then save. Notes are optional.</p><button onClick={() => onNavigate('discover')}>Add photo →</button></details>
      <details><summary>Label a crate</summary><p>Stick on its label. Choose the ID or scan its QR code. Photograph the outside, then the contents.</p><button onClick={() => onNavigate('labels')}>Label crates →</button></details>
      <details><summary>Clear some space</summary><p>Choose one small area. Take a before photo, sort, then take an after photo. Keep both car spaces clear.</p><button onClick={() => onNavigate('play')}>Start cleanup →</button></details>
      <details><summary>Plan on your laptop</summary><p>Open <b>Garage</b> for the 3D view. Photos and crate inventory sync across devices. Pickup settings and layout edits stay on the device you use.</p><button onClick={() => onNavigate('layout')}>Garage plan →</button></details>
      <details><summary>Earn points</summary><p>Stickers and new inventory batches: <b>25 points</b>. Useful photos: <b>25</b> after John’s review. Finished cleanups: <b>100</b>. Dollar values come later.</p><button onClick={() => onNavigate('score')}>View points →</button></details>
      <details><summary>Save across devices</summary><p>Use the family link on each device. Wait for <b>Saved</b> before switching. If a draft needs review, export it before loading shared changes. Keep your original photos.</p></details>
    </section>
    <details className="more-print"><summary>Print labels</summary><p>Letter paper · Actual size / 100%.</p><a href="/print/garage-labels-avery-5163-crates-1-5.pdf" target="_blank" rel="noreferrer">Avery 5163/8163 · Crates 1–5 ↓</a><a href="/print/garage-labels-avery-5163-crates-6-32.pdf" target="_blank" rel="noreferrer">Avery 5163/8163 · Crates 6–32 ↓</a><a href="/print/garage-container-labels.pdf" target="_blank" rel="noreferrer">Plain paper · All 32 crates ↓</a></details>
  </main>
}
