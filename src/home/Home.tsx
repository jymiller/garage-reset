import type { Tab } from '../App'
import { useWorkspace } from '../crates/useWorkspace'
import { volumeStats } from '../crates/model'
import { missionProgress } from '../play/mission'
import { BoltIcon, GridIcon, MapIcon } from '../components/icons'

const statusLabels = { connecting: 'Connecting · showing saved progress…', shared: 'Synced across your devices', saving: 'Saving your progress…', offline: 'Offline · showing this device’s draft', conflict: 'Your draft needs review', error: 'Save needs attention' }
const liters = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)

export function Home({ onNavigate, onOpenCrate }: { onNavigate: (tab: Tab) => void; onOpenCrate: (id: string, step: 'locate' | 'sort' | 'repack') => void }) {
  const workspace = useWorkspace()
  const { data } = workspace
  const missions = data.missions ?? []
  const score = missionProgress(missions)
  const volume = volumeStats(data)
  const pendingFill = data.crates.some(crate => crate.status === 'sorting')
  const open = missions.find(mission => mission.phase !== 'complete')
  const recordedCrates = new Set(data.items.map(item => item.crateId))
  const nextCrate = data.crates.find(crate => crate.status === 'sorting') ?? data.crates.find(crate => crate.status === 'unopened') ?? data.crates.find(crate => crate.currentFill > 0 && !recordedCrates.has(crate.id))
  const nextCrateStep = nextCrate?.status === 'sorting' ? 'repack' : nextCrate?.status === 'repacked' ? 'sort' : 'locate'
  const latestWin = missions.filter(m => m.phase === 'complete').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0]
  const goalReady = volume.baselineLiters > 0 && !pendingFill
  const goalProgress = goalReady ? Math.min(100, volume.freedPercent * 2) : 0
  const resumeLabel = !open ? 'Start a photo mission' : open.phase === 'before' ? open.beforePhoto ? 'Start your saved round' : 'Take your before photo' : open.phase === 'active' ? 'Continue your mission' : 'Finish your mission'
  const attention = workspace.status === 'conflict' || workspace.status === 'error' || workspace.storageError

  return <main className="reset-home">
    <header className="home-heading"><div><p className="home-eyebrow">GARAGE RESET</p><h1>Let’s make<br className="home-mobile-break"/> some room.</h1><p>Choose one small area. Sort it. See your progress.</p></div><div className="home-level" aria-label={`Photo mission level ${score.level}`}><span>LEVEL</span><strong>{score.level}</strong><span>{score.points} XP</span></div></header>
    <div className={`home-sync ${workspace.status}`} role="status"><i/>{workspace.storageError ? 'Device backup unavailable · open Crates for help' : statusLabels[workspace.status]}</div>
    {attention && <div className="home-save-alert"><p>{workspace.error || 'Open Crates to review your draft and backup options.'}</p><button onClick={() => onNavigate('crates')}>Review saved progress →</button></div>}

    <div className="home-grid">
      <section className="home-mission" aria-labelledby="home-mission-title">
        <div className="home-mission-photo"><img src={open?.beforePhoto ?? '/evidence/2026-09-09/IMG_1930.jpg'} alt={open?.beforePhoto ? `Before your mission: ${open.area}` : 'The garage storage shelves in the September 9 reference photo'} fetchPriority="high"/><div className="home-photo-shade"/><span className="home-photo-caption">{open?.beforePhoto ? 'YOUR MISSION / BEFORE' : 'YOUR GARAGE / SEPT 9 REFERENCE'}</span><span className="home-xp-stamp"><BoltIcon className="home-small-icon"/>100 XP<span>per finished round</span></span></div>
        <div className="home-mission-copy"><div className="home-mission-meta"><span>{open ? 'YOUR MISSION IS WAITING' : 'NEXT UP / ONE SMALL WIN'}</span><span>{open ? `${open.plannedMinutes} min round` : '5–15 minutes'}</span></div><h2 id="home-mission-title">{open ? open.title : 'Clear one small area.'}</h2><p>{open ? `${open.area}. Your saved photos and counts are waiting. Pick up right where you left off.` : 'Choose one shelf, one crate, or part of the floor. Take a before photo, sort it, then take an after photo.'}</p><button className="home-primary" onClick={() => onNavigate('play')}><span>{resumeLabel}</span><span aria-hidden="true">↗</span></button><p className="home-mission-foot">Both cars keep their space. One open batch at a time.</p></div>
      </section>

      <div className="home-side">
        <section className="home-campaign" aria-labelledby="home-goal"><div className="home-card-heading"><span className="home-eyebrow">THE BIG MISSION</span><span className="home-target">50%</span></div><h2 id="home-goal">Free half the<br/> storage space.</h2><p>{pendingFill ? 'Finish the open repacks to update your space estimate.' : volume.baselineLiters === 0 ? 'Register your crates and their starting fill. That gives your progress a real starting point.' : `${liters(volume.freedLiters)} L freed from ${liters(volume.baselineLiters)} L of recorded starting contents.`}</p><div className="home-goal-track" role="progressbar" aria-label="Progress toward freeing half of recorded storage volume" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalProgress)} aria-valuetext={pendingFill ? 'Fill checks pending' : volume.baselineLiters === 0 ? 'Starting volume not recorded' : `${Math.round(goalProgress)} percent of the half-volume goal${data.baselineLocked ? '' : ', provisional baseline'}`}><span style={{width: `${goalProgress}%`}}/></div><div className="home-goal-caption"><span>{pendingFill ? 'Fill checks pending' : volume.baselineLiters === 0 ? 'Add your starting amounts' : `${Math.round(volume.freedPercent)}% of recorded volume freed`}</span><span>{goalReady && !data.baselineLocked ? 'Baseline in progress' : 'Goal: 50% less'}</span></div><button className="home-text-link" onClick={() => onNavigate('crates')}>{volume.baselineLiters === 0 ? 'Set up your first crate' : 'Open volume tracker'} <span aria-hidden="true">→</span></button></section>
        <section className="home-level-progress" aria-label="Photo mission progress"><div><span className="home-round-icon" aria-hidden="true">✦</span><p><strong>{score.completedCount} {score.completedCount === 1 ? 'mission' : 'missions'} complete</strong><span>{score.roundsToNextLevel} more to level {score.level + 1}</span></p><b>{score.points}<small>XP</small></b></div><div className="home-level-pips" aria-hidden="true">{[0, 1, 2].map(n => <i className={n < score.completedCount % 3 ? 'filled' : ''} key={n}/>)}</div><p>Finish a before-and-after round to earn 100 XP.</p></section>
      </div>

      <section className="home-tools" aria-label="Choose your next action"><button className="home-tool" onClick={() => nextCrate ? onOpenCrate(nextCrate.id, nextCrateStep) : onNavigate('crates')}><span className="home-tool-icon"><GridIcon/></span><span><strong>{nextCrate ? `${nextCrateStep === 'repack' ? 'Check' : nextCrateStep === 'sort' ? 'Log' : 'Open'} ${nextCrate.code}` : 'Open a crate'}</strong><small>{nextCrate ? nextCrateStep === 'repack' ? 'Finish its repack & fill check.' : nextCrateStep === 'sort' ? 'Record what’s inside.' : nextCrate.name : 'Photo, contents, keep or go.'}</small></span><span aria-hidden="true">↗</span></button><button className="home-tool" onClick={() => onNavigate('layout')}><span className="home-tool-icon map"><MapIcon/></span><span><strong>Explore your garage</strong><small>Photos, objects & the 3D plan.</small></span><span aria-hidden="true">↗</span></button></section>

      <section className="home-how" aria-labelledby="home-how-title"><div className="home-section-heading"><div><p className="home-eyebrow">HOW TO PLAY</p><h2 id="home-how-title">Your next 10 minutes.</h2></div><span>One round is enough.</span></div><ol><li><span>01</span><div><h3>Take a before photo</h3><p>Choose a small area. Use <b>Take a photo</b> for a before shot.</p></div></li><li><span>02</span><div><h3>Sort each item</h3><p>Put it away, bag it, donate it, or ask the owner. Count as you go.</p></div></li><li><span>03</span><div><h3>Take an after photo</h3><p>Take the after shot, check both car paths, and finish for <b>100 XP</b>.</p></div></li></ol></section>

      {latestWin && <section className="home-recent"><img src={latestWin.afterPhoto!} alt={`After: ${latestWin.area}`} loading="lazy"/><div><p className="home-eyebrow">YOUR LATEST WIN</p><h2>{latestWin.title}</h2><p>{latestWin.summary}</p><button className="home-text-link" onClick={() => onNavigate('play')}>Open Missions →</button></div></section>}
      <footer className="home-footer"><span>Use your phone to sort. Plan on your laptop.</span><button onClick={() => onNavigate('more')}>Help & more tools <span aria-hidden="true">↗</span></button></footer>
    </div>
  </main>
}
