import { ShareFamilyLink } from '../access/ShareFamilyLink'
import type { Tab } from '../App'
import { HelperIdentity, readHelperPlayerId } from '../rewards/HelperIdentity'
import { useState } from 'react'
import { useWorkspace } from '../crates/useWorkspace'
import { rewardSummary } from '../rewards/model'
import { photoPointsForPlayer } from '../rewards/photoPoints'
import { activityPointsForPlayer } from '../rewards/activityPoints'
import { volumeStats } from '../crates/model'
import type { Observation } from '../crates/model'
import { GarageIcon } from '../components/GarageIcons'
import { openMissionsForPlayer } from '../play/playerMissions'
import './start.css'

const statusLabels = { connecting: 'Opening…', shared: 'Saved', saving: 'Saving…', offline: 'Offline · draft on this device', conflict: 'Review your draft', error: 'Save needs attention' }
type PhotoKind = Observation['kind']

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
    <header className="start-heading"><h1>Garage Reset</h1><button className="start-score-link" onClick={()=>onNavigate('score')}><GarageIcon name="trophy"/>{player ? `${player.name} · ${points} points` : 'Your points'}<span aria-hidden="true">→</span></button></header>
    <div className={`home-sync ${workspace.status}`} role="status"><i/>{workspace.storageError ? 'Device backup unavailable · review draft' : statusLabels[workspace.status]}</div>
    {attention && <div className="home-save-alert"><p>{workspace.error || 'Your draft needs attention.'}</p><button onClick={() => onNavigate('discover')}>Review draft →</button></div>}

    <section className="start-actions" aria-label="Choose an action">
      <button className="start-photo" onClick={() => onCapture('general')}><GarageIcon name="missions"/><span><h2>Add photo</h2><p>Take or choose any garage photo.</p></span><span aria-hidden="true">→</span></button>
      <div className="start-side-actions">
        <button className="start-small-action" onClick={() => onNavigate('labels')}><GarageIcon name="crate"/><strong>Label crates</strong></button>
        <button className="start-small-action" onClick={() => onCapture('parking')}><GarageIcon name="garage"/><strong>Fit both cars</strong></button>
        <button className="start-small-action" onClick={() => onCapture('placement')}><GarageIcon name="placement"/><strong>Something moved</strong></button>
        <button className="start-small-action" onClick={() => onCapture('measurement')}><GarageIcon name="measure"/><strong>Measure a space</strong></button>
      </div>
    </section>

    <HelperIdentity workspace={workspace} selectedPlayerId={devicePlayer} onSelectPlayer={setDevicePlayer}/>
    <button className="start-collection" onClick={() => onNavigate('observations')}><GarageIcon name="missions"/><span>View photos</span><b>{observations.length}</b><span aria-hidden="true">→</span></button>
    <details className="start-next start-history"><summary>Photo details</summary><section className="start-findings"><div className="start-counts"><span><b>{measurements.length}</b>measurements</span><span><b>{parking.length}</b>parking photos</span></div></section>
      {latest && <section className="start-latest"><img src={latest.photo} alt={latest.location || latest.notes || 'Latest garage photo'} loading="lazy"/><div><span className="home-eyebrow">LATEST PHOTO</span><h2>{latest.location || (latest.kind==='placement'?'Object location':latest.kind==='parking'?'Parking space':latest.kind==='measurement'?'Measurement':latest.kind==='general'?'Garage photo':'Crate photo')}</h2>{(latest.measurement || latest.notes) && <p>{latest.measurement ? `${latest.measurement.label}: ${latest.measurement.value} ${latest.measurement.unit}` : latest.notes}</p>}</div></section>}
    </details>
    <details className="start-next start-invite"><summary>Invite someone</summary><ShareFamilyLink/></details>

    {open && <section className="start-resume"><div><h2>Continue cleanup</h2><p>{open.area}{player ? ` · ${player.name}` : ''}</p></div><button onClick={() => onNavigate('play')}>Resume →</button></section>}
    <details className="start-next"><summary>Plan & sort</summary><div className="start-next-grid"><button onClick={() => onNavigate('play')}><GarageIcon name="floor"/><span><b>Clean up</b><small>100 points per mission</small></span></button><button onClick={() => onNavigate('layout')}><GarageIcon name="garage"/><span><b>Garage plan</b><small>Explore in 3D</small></span></button><button onClick={() => nextCrate ? onOpenCrate(nextCrate.id, nextCrate.status==='sorting'?'repack':'locate') : onNavigate('crates')}><GarageIcon name="crate"/><span><b>Crate inventory</b></span></button><button onClick={() => onNavigate('score')}><GarageIcon name="trophy"/><span><b>Score</b></span></button></div><p className="start-volume">Goal: free half the storage volume. {pendingFill ? 'Recheck open crates to update progress.' : volume.baselineLiters > 0 ? `${Math.round(volume.freedPercent)}% of recorded starting contents freed${data.baselineLocked ? '.' : ' · baseline in progress.'}` : 'Record crate fill to track progress.'}</p></details>
    <footer className="home-footer"><button onClick={() => onNavigate('more')}>More tools & help →</button></footer>
  </main>
}
