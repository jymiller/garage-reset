import { useState, useEffect } from 'react'
import { BottomNav } from './components/BottomNav'
import { Home } from './home/Home'
import { Score } from './rewards/Score'
import { More } from './home/More'
import { Dashboard } from './screens/Dashboard'
import { People } from './screens/People'
import { Zones } from './screens/Zones'
import { PhotoPlay } from './play/PhotoPlay'
import { LabelQuest } from './discover/LabelQuest'
import { QuickCapture } from './discover/QuickCapture'
import { Capture } from './screens/Capture'
import { Garage } from './screens/Garage'
import { SoundTest } from './screens/SoundTest'
import { FinalStandings } from './screens/FinalStandings'
import { PickupPlanner } from './pickup/PickupPlanner'
import { CrateWorkspace } from './crates/CrateWorkspace'
import './home/home.css'
import { parseCrateLabelHash } from './crates/labelLinks'
import type { Observation } from './crates/model'

export type Tab = 'home' | 'more' | 'score' | 'dashboard' | 'people' | 'zones' | 'snowball' | 'capture' | 'layout' | 'sound' | 'results' | 'pickup' | 'crates' | 'play' | 'discover' | 'observations' | 'labels'
const tabs: Tab[] = ['home', 'more', 'labels', 'discover', 'observations', 'score', 'pickup', 'crates', 'play', 'dashboard', 'people', 'zones', 'snowball', 'capture', 'layout', 'sound', 'results']
const readTab = (): Tab => {
  const hash = window.location.hash.slice(1).split('?')[0] as Tab
  return tabs.includes(hash) ? hash : 'home'
}

export function App() {
  const [tab, setTab] = useState<Tab>(readTab)
  const [captureKind, setCaptureKind] = useState<Observation['kind']>('general')
  const [captureCrateId, setCaptureCrateId] = useState<string|null>(null)
  const [questCode, setQuestCode] = useState<string|null>(()=>parseCrateLabelHash(window.location.hash.replace(/^#labels\?/, '#crates?')))
  const [captureLabelCode, setCaptureLabelCode] = useState<string|null>(null)
  const [capturePhotoRole, setCapturePhotoRole] = useState<'outside'|'contents'|null>(null)
  const [captureVisit, setCaptureVisit] = useState(0)
  const [generalPhotoRequest, setGeneralPhotoRequest] = useState(0)
  const [playCrateId, setPlayCrateId] = useState<string|null>(null)
  const [crateInitialStep, setCrateInitialStep] = useState<'locate' | 'sort' | 'repack'>('locate')
  const [crateFocus, setCrateFocus] = useState<string|null>(null)
  const [labelCode, setLabelCode] = useState<string|null>(() => parseCrateLabelHash(window.location.hash))

  useEffect(() => {
    const followHistory = () => { setQuestCode(parseCrateLabelHash(window.location.hash.replace(/^#labels\?/, '#crates?'))); setCrateFocus(null); setPlayCrateId(null); setLabelCode(parseCrateLabelHash(window.location.hash)); setTab(readTab()) }
    window.addEventListener('hashchange', followHistory)
    window.addEventListener('popstate', followHistory)
    document.body.classList.add('garage-modern')
    if (!tabs.includes(window.location.hash.slice(1).split('?')[0] as Tab)) history.replaceState(null, '', '#home')
    return () => {
      window.removeEventListener('hashchange', followHistory)
      window.removeEventListener('popstate', followHistory)
      document.body.classList.remove('garage-modern')
    }
  }, [])

  useEffect(() => { window.scrollTo(0, 0) }, [tab])

  function navigate(next: Tab) {
    if (window.location.hash !== `#${next}`) history.pushState(null, '', `#${next}`)
    setTab(next)
  }
  function goTo(next: Tab) { if(next===tab && !labelCode){if(next==='discover')setGeneralPhotoRequest(n=>n+1);return;} if(next==='discover'){setCaptureLabelCode(null);setCapturePhotoRole(null);setCaptureKind('general');setCaptureCrateId(null);setCaptureVisit(n=>n+1)} setLabelCode(null); setCrateFocus(null); setPlayCrateId(null); navigate(next) }
  function openCrate(id: string, step: 'locate' | 'sort' | 'repack' = 'locate') {
    setLabelCode(null); setCrateFocus(id); setCrateInitialStep(step); setPlayCrateId(null); navigate('crates')
  }

  function capture(kind: Observation['kind'], crateId: string|null = null) {
    setCaptureLabelCode(null);setCapturePhotoRole(null);setCaptureKind(kind);setCaptureCrateId(crateId);setCaptureVisit(n=>n+1);setLabelCode(null);setCrateFocus(null);setPlayCrateId(null);navigate('discover')
  }

  function openLabelQuest(code?: string) { setQuestCode(code ?? null);setLabelCode(null);setCrateFocus(null);navigate('labels');if(code)history.replaceState(null,'',`#labels?code=${encodeURIComponent(code)}`) }
  function captureLabel(code: string, role: 'outside'|'contents') { setCaptureLabelCode(code);setCapturePhotoRole(role);setCaptureKind('general');setCaptureCrateId(null);setCaptureVisit(n=>n+1);navigate('discover') }

  let screen
  if (tab === 'home') screen = <Home onNavigate={goTo} onCapture={capture} onOpenCrate={(id, step) => openCrate(id, step)} />
  else if (tab === 'labels') screen = <LabelQuest key={questCode ?? 'labels'} initialCode={questCode} onCaptureLabel={captureLabel} onNavigate={goTo} onOpenCrate={id=>openCrate(id,'sort')} />
  else if (tab === 'discover' || tab === 'observations') screen = <QuickCapture key={`${tab}-${captureVisit}`} generalPhotoRequest={generalPhotoRequest} initialView={tab==='observations'?'collection':'capture'} initialKind={tab==='observations'?'general':captureKind} initialCrateId={tab==='observations'?null:captureCrateId} initialLabelCode={tab==='observations'?null:captureLabelCode} initialPhotoRole={tab==='observations'?null:capturePhotoRole} onLabelQuest={openLabelQuest} onNavigate={goTo} onOpenCrate={id=>openCrate(id)} />
  else if (tab === 'more') screen = <More onNavigate={goTo} />
  else if (tab === 'score') screen = <Score onNavigate={goTo} />
  else if (tab === 'layout') screen = <Garage onNavigate={goTo} onOpenCrate={id => openCrate(id)} />
  else if (tab === 'pickup') screen = <PickupPlanner onNavigate={goTo} />
  else if (tab === 'crates') screen = <CrateWorkspace key={labelCode ?? "workspace"} labelCode={labelCode} onNavigate={goTo} onCapture={capture} onLabelQuest={openLabelQuest} initialCrateId={crateFocus} initialStep={crateInitialStep} onPlayCrate={id => { setPlayCrateId(id); setCrateFocus(null); navigate('play') }} />
  else if (tab === 'play' || tab === 'snowball') screen = <PhotoPlay onNavigate={goTo} initialCrateId={playCrateId} onOpenCrate={id => openCrate(id, 'repack')} />
  else screen = <div className="tools-screen">
    <div className="tools-screen-bar">
    <button className="tools-back" onClick={() => goTo('more')}>← More tools</button></div>
    {tab === 'dashboard' && <Dashboard onNavigate={goTo} />}
    {tab === 'people' && <People />}
    {tab === 'zones' && <Zones />}
    {tab === 'capture' && <Capture />}
    {tab === 'sound' && <SoundTest onNavigate={goTo} />}
    {tab === 'results' && <FinalStandings onNavigate={goTo} />}
  </div>

  return <div className="garage-shell">
    <a className="garage-skip" href="#app-screen" onClick={event => { event.preventDefault(); document.getElementById('app-screen')?.focus() }}>Skip to content</a>
    <BottomNav tab={tab} onChange={goTo} />
    <div id="app-screen" tabIndex={-1}>{screen}</div>
  </div>
}
