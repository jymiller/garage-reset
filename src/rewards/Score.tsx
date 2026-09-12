import { useEffect, useId, useRef, useState } from 'react'
import type { Tab } from '../App'
import type { CleanupMission, Observation, Workspace } from '../crates/model'
import { useWorkspace } from '../crates/useWorkspace'
import { GarageIcon } from '../components/GarageIcons'
import { ToolPage } from '../components/ToolPage'
import { assignMission, rewardSummary } from './model'
import { HelperIdentity, readHelperPlayerId } from './HelperIdentity'
import { approveUsefulPhoto, photoPointsForPlayer, totalPhotoPoints } from './photoPoints'
import { activityPointsForPlayer, totalActivityPoints } from './activityPoints'
import './score.css'
import './photo-score.css'

type Change = (transform: (data: Workspace) => Workspace, message: string) => boolean
const cash = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const statuses = { connecting: 'Opening your shared score…', shared: 'Score shared with the family', saving: 'Saving points…', offline: 'Offline · showing this device’s draft', conflict: 'Another device saved changes', error: 'This save needs attention' }

export function Score({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const workspace = useWorkspace()
  const [helperId, setHelperId] = useState(readHelperPlayerId)
  const [selectedId, setSelectedId] = useState(readHelperPlayerId)
  const [message, setMessage] = useState('')
  const [messageSaved, setMessageSaved] = useState(false)
  const [reviewLimit, setReviewLimit] = useState(12)
  const [backedUp, setBackedUp] = useState(false)
  const pending = useRef(false)
  const data = workspace.data
  const summary = rewardSummary(data)
  const players = data.rewards?.players ?? []
  const selected = players.find(player => player.id === selectedId) ?? players[0]
  const cleanup = summary.players.find(player => player.id === selected?.id)
  const photos = photoPointsForPlayer(data, selected?.id)
  const activity = activityPointsForPlayer(data, selected?.id)
  const total = (cleanup?.points ?? 0) + photos.points + activity.points
  const credits = data.activityCredits ?? []
  const awards = data.photoAwards ?? []
  const observations = data.observations ?? []
  const unreviewed = observations.filter(photo => !awards.some(award => award.observationId === photo.id)).slice().sort((a,b) => b.createdAt-a.createdAt)
  const finished = (data.missions ?? []).filter(mission => mission.phase === 'complete').slice().sort((a,b) => (b.completedAt??0)-(a.completedAt??0))
  const canChange = workspace.status === 'shared' && !workspace.dirty && !workspace.conflict && !workspace.storageError
  useEffect(() => { if (!workspace.dirty) pending.current = false }, [workspace.dirty])
  useEffect(() => { setBackedUp(false) }, [workspace.conflict])
  const change: Change = (transform, notice) => {
    setMessageSaved(false)
    if (!canChange || pending.current) { setMessage('Wait for the shared save before making another change.'); return false }
    pending.current = true
    let changed = false
    const accepted = workspace.update(current => { const next = transform(current); changed = next !== current; return next })
    if (!accepted || !changed) { pending.current = false; setMessage('That change was not accepted. Check the photo and player, then try again.'); return false }
    setMessage(notice); setMessageSaved(true); return true
  }
  return <ToolPage title="Your points." description="Label crates. Show what’s inside. Collect points. Dollar values come later." icon="trophy">
    <div className="score-app photo-score">
      <div className="score-sync" role="status">{workspace.dirty && workspace.status==='shared' ? 'Points recorded on this device · waiting to share' : statuses[workspace.status]}</div>
      {(workspace.error || workspace.conflict || workspace.storageError || workspace.status==='offline') && <section className="score-alert"><p>{workspace.error || 'Your device draft is kept. Review the shared save before leaving.'}</p><button className="tool-button secondary" onClick={()=>{workspace.downloadDraft();setBackedUp(true)}}>Download device draft</button>{workspace.conflict && <button className="tool-button secondary" disabled={!backedUp} onClick={()=>{workspace.useSharedVersion();setMessage('');setMessageSaved(false)}}>Load shared version</button>}</section>}
      <section className="photo-score-hero"><div><p className="home-eyebrow">{selected?.name ?? 'YOUR NEXT SMALL WIN'}</p><h2>{total}<span> points</span></h2><p>Every useful detail brings the garage into focus.</p><button className="tool-button" onClick={()=>onNavigate('discover')}>Take a helpful photo →</button></div><GarageIcon name="trophy"/></section>
      {players.length>0 && <label className="score-field photo-score-picker">View score for<select value={selected?.id??''} onChange={event=>setSelectedId(event.target.value)}>{players.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></label>}
      <section className="photo-score-breakdown" aria-label="Points breakdown"><div><span>Stickers placed</span><b>{activity.stickerPoints} points</b><p>{activity.stickerCount} stickers × 25</p></div><div><span>Inventory updates</span><b>{activity.inventoryPoints} points</b><p>{activity.inventoryCount} saved batches × 25</p></div><div><span>Helpful photos</span><b>{photos.points} points</b><p>{photos.count} reviewed photos × 25</p></div><div><span>Finished cleanups</span><b>{cleanup?.points??0} points</b><p>{cleanup?.completedCount??0} missions × 100</p></div></section>
      <p className="photo-score-explainer">Each lid or front / side sticker earns 25 points once. Adding a batch of new contents earns 25. A new view of contents, an object’s location, parking space or a measurement can also earn 25 points. John reviews whether it adds useful information. Dollar values and payments will be decided later.</p>
      <HelperIdentity workspace={workspace} selectedPlayerId={helperId} onSelectPlayer={id=>{setHelperId(id);setSelectedId(id)}}/>
      {players.length>0 && <section className="photo-score-team"><h2>The crew</h2><p>{summary.points+totalPhotoPoints(data)+totalActivityPoints(data)} points collected together</p>{players.map(player=>{const photo=photoPointsForPlayer(data,player.id);const activity=activityPointsForPlayer(data,player.id);const clean=summary.players.find(person=>person.id===player.id);return <button key={player.id} onClick={()=>setSelectedId(player.id)} aria-pressed={selected?.id===player.id}><span>{player.name}<small>{activity.stickerCount} stickers · {photo.count} photos · {activity.inventoryCount} inventory updates · {clean?.completedCount??0} cleanups</small></span><b>{photo.points+activity.points+(clean?.points??0)}</b></button>})}</section>}
      {message && <p className="score-message" role="status">{message} {messageSaved ? workspace.dirty ? 'Waiting for the shared save.' : workspace.status==='shared' ? 'Shared score updated.' : 'Check the save status above.' : ''}</p>}
      <details className="photo-score-review"><summary>For John · review useful photos ({unreviewed.length})</summary><p>Credit a photo when it adds inventory detail, shows an object’s placement or a real change, or gives a useful measurement. Skip repeats and unclear shots. One award per photo.</p><p className="photo-score-trust">Everyone with the family link can use these review controls. Leave point approval to John.</p>{!unreviewed.length ? <p>All collected photos have been reviewed for points.</p> : <div className="photo-review-grid">{unreviewed.slice(0,reviewLimit).map(photo=><PhotoReview key={photo.id} photo={photo} data={data} canChange={canChange} onChange={change}/>)}</div>}{unreviewed.length>reviewLimit && <button className="tool-button secondary" onClick={()=>setReviewLimit(limit=>limit+12)}>Show more photos</button>}</details>
      {finished.length>0 && <details className="photo-score-review"><summary>Who finished each cleanup?</summary><p>Completed cleanup missions earn 100 points. Assign unclaimed work to the right person.</p>{finished.map(mission=><CleanupCredit key={mission.id} mission={mission} data={data} canChange={canChange} onChange={change}/>)}</details>}
      {credits.length>0 && <details className="photo-score-review"><summary>Sticker & inventory points ({credits.length})</summary>{credits.slice().reverse().map(credit=><div className="photo-score-credit" key={credit.id}><strong>{players.find(player=>player.id===credit.helperId)?.name} · 25 points</strong><p>{credit.labelCode} · {credit.kind==='sticker' ? credit.surface==='lid' ? 'Lid sticker' : 'Front / side sticker' : `${credit.itemIds.length} new contents records`}</p><small>{new Date(credit.createdAt).toLocaleString()}</small></div>)}</details>}
      {awards.length>0 && <details className="photo-score-review"><summary>Reviewed photo points ({awards.length})</summary>{awards.slice().reverse().map(award=>{const photo=observations.find(item=>item.id===award.observationId);return <div className="photo-score-credit" key={award.observationId}><strong>{players.find(player=>player.id===award.helperId)?.name} · 25 points</strong><p>{photo?.labelCode || photo?.location || photo?.kind || 'Photo'}{photo?.photoRole ? ' · '+photo.photoRole : ''}</p><small>{new Date(award.reviewedAt).toLocaleString()}</small></div>})}</details>}
      {summary.entries.some(entry=>entry.approvedAt!==null) && <details className="photo-score-review"><summary>Earlier cash records</summary><p>These earlier records are preserved. New work collects points; no dollar value is being assigned here.</p>{summary.entries.filter(entry=>entry.approvedAt!==null).map(entry=><div className="photo-score-credit" key={entry.missionId}><b>{players.find(player=>player.id===entry.playerId)?.name}: {cash(entry.allocatedCents)}</b><p>{entry.paidAt!==null?'Previously marked paid':'Previously approved, not marked paid'}</p></div>)}</details>}
      <div className="tool-row"><button className="tool-button secondary" onClick={()=>onNavigate('labels')}>Label & photograph crates</button><button className="tool-button secondary" onClick={()=>onNavigate('play')}>Start a cleanup mission</button></div>
    </div>
  </ToolPage>
}

function PhotoReview({ photo, data, canChange, onChange }: { photo: Observation; data: Workspace; canChange: boolean; onChange: Change }) {
  const id = useId()
  const [helper, setHelper] = useState(photo.helperId??'')
  const [useful, setUseful] = useState(false)
  const players = data.rewards?.players??[]
  const name = photo.labelCode || photo.location || (photo.kind==='placement'?'Object location':photo.kind==='measurement'?'Measurement':photo.kind==='parking'?'Parking view':'Crate photo')
  return <article className="photo-review-card"><img src={photo.photo} alt={name} loading="lazy"/><h3>{name}{photo.photoRole?' · '+photo.photoRole:''}</h3><p>{photo.notes||'No description added.'}</p>{photo.measurement&&<p><b>{photo.measurement.value} {photo.measurement.unit}</b> · {photo.measurement.label}</p>}<time dateTime={new Date(photo.createdAt).toISOString()}>{new Date(photo.createdAt).toLocaleString()}</time><label className="score-field" htmlFor={id}>Who took this photo?<select id={id} value={players.some(player=>player.id===helper)?helper:''} disabled={!canChange} onChange={event=>setHelper(event.target.value)}><option value="">Choose the helper</option>{players.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></label><label className="photo-review-check"><input type="checkbox" checked={useful} disabled={!canChange} onChange={event=>setUseful(event.target.checked)}/>This adds useful information, not a repeat.</label><button className="tool-button" disabled={!canChange||!useful||!players.some(player=>player.id===helper)} onClick={()=>onChange(current=>approveUsefulPhoto(current,photo.id,helper),'25 useful-photo points recorded.')}>Award 25 points</button></article>
}
function CleanupCredit({ mission, data, canChange, onChange }: { mission: CleanupMission; data: Workspace; canChange: boolean; onChange: Change }) {
  const entry = data.rewards?.entries.find(item=>item.missionId===mission.id)
  return <article className="photo-score-credit"><h3>{mission.area}</h3><p>{mission.summary}</p><label className="score-field">Who did this cleanup?<select value={entry?.playerId??''} disabled={!canChange||entry?.approvedAt!=null} onChange={event=>{if(event.target.value)onChange(current=>assignMission(current,mission.id,event.target.value),'Cleanup points assigned.')}}><option value="">Choose the helper</option>{data.rewards?.players.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></label><p>100 cleanup points{entry?.approvedAt!=null?' · earlier approval retained':''}</p></article>
}
