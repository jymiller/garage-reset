import { ShareFamilyLink } from '../access/ShareFamilyLink'
import type { Tab } from '../App'
import { HelperIdentity, readHelperPlayerId } from '../rewards/HelperIdentity'
import { useState } from 'react'
import { useWorkspace } from '../crates/useWorkspace'
import { rewardSummary } from '../rewards/model'
import { photoPointsForPlayer } from '../rewards/photoPoints'
import { activityPointsForPlayer } from '../rewards/activityPoints'
import { volumeStats } from '../crates/model'
import { GarageIcon } from '../components/GarageIcons'
import { openMissionsForPlayer } from '../play/playerMissions'
import './start.css'

const statusLabels = { connecting: 'Opening your saved progress…', shared: 'Saved with the family', saving: 'Saving…', offline: 'Offline · showing this device’s draft', conflict: 'Your draft needs review', error: 'Save needs attention' }
type PhotoKind = 'crate' | 'parking' | 'measurement' | 'placement'

export function Home({ onNavigate, onCapture, onOpenCrate }: { onNavigate: (tab: Tab) => void; onCapture: (kind: PhotoKind) => void; onOpenCrate: (id: string, step: 'locate' | 'sort' | 'repack') => void }) {
  const workspace = useWorkspace()
  const { data } = workspace
  const [devicePlayer, setDevicePlayer] = useState(readHelperPlayerId)
  const player = data.rewards?.players.find(person => person.id === devicePlayer)
  const points = (rewardSummary(data).players.find(person=>person.id===player?.id)?.points??0)+photoPointsForPlayer(data,player?.id).points+activityPointsForPlayer(data,player?.id).points
  const open = openMissionsForPlayer(data, player?.id ?? null)[0]
  const observations = data.observations ?? []
  const measurements = observations.filter(item => item.measurement !== null)
  const parking = observations.filter(item => item.kind === 'parking')
  const latest = observations.slice().sort((a,b) => b.createdAt-a.createdAt)[0]
  const volume = volumeStats(data)
  const pendingFill = data.crates.some(crate => crate.status === 'sorting')
  const nextCrate = data.crates.find(crate => crate.status === 'sorting') ?? data.crates[0]
  const attention = workspace.status === 'conflict' || workspace.status === 'error' || workspace.storageError

  return <main className="reset-home start-home">
    <header className="start-heading"><p className="home-eyebrow">GARAGE RESET</p><h1>One photo helps.</h1><p>Let’s learn what’s here, then make room.</p><button className="start-score-link" onClick={()=>onNavigate('score')}><GarageIcon name="trophy"/>{player ? `${player.name} · ${points} points` : 'Your points'}<span aria-hidden="true">→</span></button></header>
    <div className={`home-sync ${workspace.status}`} role="status"><i/>{workspace.storageError ? 'Device backup unavailable · review your draft' : statusLabels[workspace.status]}</div>
    {attention && <div className="home-save-alert"><p>{workspace.error || 'Open Missions to review your draft and backup options.'}</p><button onClick={() => onNavigate('discover')}>Review saved progress →</button></div>}

    <section className="start-actions" aria-label="Choose one small action">
      <button className="start-photo" onClick={() => onCapture('crate')}><GarageIcon name="missions"/><span className="start-duration">ABOUT 1 MINUTE</span><h2>Take a crate photo</h2><p>Show a box where it lives. Open the lid only if it’s easy.</p><span className="start-action-label">Take a photo <span aria-hidden="true">→</span></span><small>No label, inventory or timer needed.</small></button>
      <div className="start-side-actions">
        <button className="start-small-action" onClick={() => onNavigate('labels')}><GarageIcon name="crate"/><span><strong>Label & photograph crates</strong><small>Use your printed labels. Two photos per box.</small></span><span aria-hidden="true">→</span></button>
        <button className="start-small-action" onClick={() => onCapture('parking')}><GarageIcon name="garage"/><span><strong>Make room for both cars</strong><small>Show the parking spaces and the tight spots.</small></span><span aria-hidden="true">→</span></button>
        <button className="start-small-action" onClick={() => onCapture('placement')}><GarageIcon name="placement"/><span><strong>Show where something moved</strong><small>A bin, a box, or an object in a new spot.</small></span><span aria-hidden="true">→</span></button>
        <button className="start-small-action" onClick={() => onCapture('measurement')}><GarageIcon name="measure"/><span><strong>Measure one space</strong><small>A shelf depth, a gap, or the white parking line.</small></span><span aria-hidden="true">→</span></button>
        <p className="start-reassurance">Take a photo, add a note if you want, and save. Each one gives us more to plan with.</p>
      </div>
    </section>

    <ShareFamilyLink/>
    <HelperIdentity workspace={workspace} selectedPlayerId={devicePlayer} onSelectPlayer={setDevicePlayer}/>
    <section className="start-findings" aria-labelledby="start-findings-title"><div><h2 id="start-findings-title">Your garage is coming into focus.</h2><p>{observations.length ? `${observations.length} helpful ${observations.length===1?'photo':'photos'} collected` : 'Your first photo is enough to get started.'}</p></div><div className="start-counts"><span><b>{measurements.length}</b>tape measurements</span><span><b>{parking.length}</b>parking photos</span></div><button onClick={() => onNavigate('observations')}>See photos & measurements →</button></section>
    {latest && <section className="start-latest"><img src={latest.photo} alt={latest.location || latest.notes || 'Your latest helpful garage photo'} loading="lazy"/><div><span className="home-eyebrow">LATEST HELPFUL PHOTO</span><h2>{latest.location || (latest.kind==='placement'?'An object’s location':latest.kind==='parking'?'Parking space':latest.kind==='measurement'?'A space to measure':'A crate to explore')}</h2><p>{latest.measurement ? `${latest.measurement.label}: ${latest.measurement.value} ${latest.measurement.unit}` : latest.notes || 'Saved for your next planning session.'}</p><button onClick={() => onNavigate('observations')}>Open your photo collection →</button></div></section>}

    {open && <section className="start-resume"><div><h2>Your cleanup mission is waiting.</h2><p>{open.area}{player ? ` · ${player.name}` : ''}</p></div><button onClick={() => onNavigate('play')}>Continue cleanup →</button></section>}
    <details className="start-next"><summary>Ready to sort or plan?</summary><div className="start-next-grid"><button onClick={() => onNavigate('play')}><GarageIcon name="floor"/><span><b>Do a cleanup mission</b><small>Before photo, sort, after photo. Earn 100 points.</small></span></button><button onClick={() => onNavigate('layout')}><GarageIcon name="garage"/><span><b>Open the garage plan</b><small>Compare your photos with the 3D model.</small></span></button><button onClick={() => nextCrate ? onOpenCrate(nextCrate.id, nextCrate.status==='sorting'?'repack':'locate') : onNavigate('crates')}><GarageIcon name="crate"/><span><b>Work on a container</b><small>Record contents when you’re ready.</small></span></button><button onClick={() => onNavigate('score')}><GarageIcon name="trophy"/><span><b>Points & progress</b><small>Stickers, photos, inventory and cleanups.</small></span></button></div><p className="start-volume">Storage goal: free half the occupied volume. {pendingFill ? 'Finish the open repacks to update the estimate.' : volume.baselineLiters > 0 ? `${Math.round(volume.freedPercent)}% of recorded starting contents freed${data.baselineLocked ? '.' : ' · baseline in progress.'}` : 'Photos help us start; record container fill later to track this goal.'}</p></details>
    <footer className="home-footer"><span>Gather on your phone. Plan on your laptop.</span><button onClick={() => onNavigate('more')}>Help & optional tools →</button></footer>
  </main>
}
