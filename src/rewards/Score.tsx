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
const statuses = { connecting: 'Loading…', shared: 'Saved', saving: 'Saving…', offline: 'Offline · device draft', conflict: 'Another device saved changes', error: 'Save needs attention' }

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
    if (!canChange || pending.current) { setMessage('Wait for the save, then try again.'); return false }
    pending.current = true
    let changed = false
    const accepted = workspace.update(current => { const next = transform(current); changed = next !== current; return next })
    if (!accepted || !changed) { pending.current = false; setMessage('Not saved. Check the photo and name, then retry.'); return false }
    setMessage(notice); setMessageSaved(true); return true
  }
  return <ToolPage title="Points" icon="trophy">
    <div className="score-app photo-score">
      <div className="score-sync" role="status">{workspace.dirty && workspace.status==='shared' ? 'Saving points…' : statuses[workspace.status]}</div>
      {(workspace.error || workspace.conflict || workspace.storageError || workspace.status==='offline') && <section className="score-alert"><p>{workspace.error || 'Your draft is kept. Check the shared save.'}</p><button className="tool-button secondary" onClick={()=>{workspace.downloadDraft();setBackedUp(true)}}>Download device draft</button>{workspace.conflict && <button className="tool-button secondary" disabled={!backedUp} onClick={()=>{workspace.useSharedVersion();setMessage('');setMessageSaved(false)}}>Load shared version</button>}</section>}
      <section className="photo-score-hero"><div><p className="home-eyebrow">{selected?.name ?? 'YOUR SCORE'}</p><h2>{total}<span> points</span></h2><button className="tool-button" onClick={()=>onNavigate('discover')}>Add photo →</button></div><GarageIcon name="trophy"/></section>
      {players.length>0 && <label className="score-field photo-score-picker">Score for<select value={selected?.id??''} onChange={event=>setSelectedId(event.target.value)}>{players.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></label>}
      <section className="photo-score-breakdown" aria-label="Activities completed"><div><GarageIcon name="crate"/><b>{activity.stickerCount}</b><span>Stickers</span></div><div><GarageIcon name="shelf"/><b>{activity.inventoryCount}</b><span>Inventory updates</span></div><div><GarageIcon name="missions"/><b>{photos.count}</b><span>Reviewed photos</span></div><div><GarageIcon name="floor"/><b>{cleanup?.completedCount??0}</b><span>Cleanups</span></div></section>
      <details className="photo-score-review photo-score-rules"><summary>How points work</summary><p>Sticker: 25 · Inventory update: 25 · Reviewed photo: 25 · Cleanup: 100.</p><p>Each sticker counts once. An inventory update is a saved batch of new items. John reviews photos for useful new information.</p><p>Points now. Dollar values later.</p></details>
      <HelperIdentity workspace={workspace} selectedPlayerId={helperId} onSelectPlayer={id=>{setHelperId(id);setSelectedId(id)}}/>
      {players.length>0 && <details className="photo-score-review photo-score-team"><summary>The crew · {summary.points+totalPhotoPoints(data)+totalActivityPoints(data)} points</summary>{players.map(player=>{const photo=photoPointsForPlayer(data,player.id);const activity=activityPointsForPlayer(data,player.id);const clean=summary.players.find(person=>person.id===player.id);return <button key={player.id} onClick={()=>setSelectedId(player.id)} aria-pressed={selected?.id===player.id}><span>{player.name}</span><b>{photo.points+activity.points+(clean?.points??0)}</b></button>})}</details>}
      {message && <p className="score-message" role="status">{message} {messageSaved ? workspace.dirty ? 'Saving…' : workspace.status==='shared' ? 'Saved.' : 'Check the save above.' : ''}</p>}
      <details className="photo-score-review"><summary>John: review photos ({unreviewed.length})</summary><p>Award useful new information. Skip duplicates or unclear photos.</p><p className="photo-score-trust">Review is for John. Anyone with the family link can access these controls.</p>{!unreviewed.length ? <p>No photos waiting.</p> : <div className="photo-review-grid">{unreviewed.slice(0,reviewLimit).map(photo=><PhotoReview key={photo.id} photo={photo} data={data} canChange={canChange} onChange={change}/>)}</div>}{unreviewed.length>reviewLimit && <button className="tool-button secondary" onClick={()=>setReviewLimit(limit=>limit+12)}>Show more photos</button>}</details>
      {finished.length>0 && <details className="photo-score-review"><summary>Assign cleanups</summary><p>Choose who earned each 100 points.</p>{finished.map(mission=><CleanupCredit key={mission.id} mission={mission} data={data} canChange={canChange} onChange={change}/>)}</details>}
      {credits.length>0 && <details className="photo-score-review"><summary>Sticker & inventory history ({credits.length})</summary>{credits.slice().reverse().map(credit=><div className="photo-score-credit" key={credit.id}><strong>{players.find(player=>player.id===credit.helperId)?.name} · 25 points</strong><p>{credit.labelCode} · {credit.kind==='sticker' ? credit.surface==='lid' ? 'Lid sticker' : 'Front / side sticker' : `${credit.itemIds.length} new contents records`}</p><small>{new Date(credit.createdAt).toLocaleString()}</small></div>)}</details>}
      {awards.length>0 && <details className="photo-score-review"><summary>Photo history ({awards.length})</summary>{awards.slice().reverse().map(award=>{const photo=observations.find(item=>item.id===award.observationId);return <div className="photo-score-credit" key={award.observationId}><strong>{players.find(player=>player.id===award.helperId)?.name} · 25 points</strong><p>{photo?.labelCode || photo?.location || photo?.kind || 'Photo'}{photo?.photoRole ? ' · '+photo.photoRole : ''}</p><small>{new Date(award.reviewedAt).toLocaleString()}</small></div>})}</details>}
      {summary.entries.some(entry=>entry.approvedAt!==null) && <details className="photo-score-review"><summary>Earlier cash records</summary><p>Past records only. New work earns points.</p>{summary.entries.filter(entry=>entry.approvedAt!==null).map(entry=><div className="photo-score-credit" key={entry.missionId}><b>{players.find(player=>player.id===entry.playerId)?.name}: {cash(entry.allocatedCents)}</b><p>{entry.paidAt!==null?'Previously marked paid':'Previously approved, not marked paid'}</p></div>)}</details>}
      <div className="tool-row"><button className="tool-button secondary" onClick={()=>onNavigate('labels')}>Label crates</button><button className="tool-button secondary" onClick={()=>onNavigate('play')}>Start cleanup</button></div>
    </div>
  </ToolPage>
}

function PhotoReview({ photo, data, canChange, onChange }: { photo: Observation; data: Workspace; canChange: boolean; onChange: Change }) {
  const id = useId()
  const [helper, setHelper] = useState(photo.helperId??'')
  const [useful, setUseful] = useState(false)
  const players = data.rewards?.players??[]
  const name = photo.labelCode || photo.location || (photo.kind==='placement'?'Object location':photo.kind==='measurement'?'Measurement':photo.kind==='parking'?'Parking view':photo.kind==='general'?'Helpful photo':'Crate photo')
  return <article className="photo-review-card"><img src={photo.photo} alt={name} loading="lazy"/><h3>{name}{photo.photoRole?' · '+photo.photoRole:''}</h3>{photo.notes&&<p>{photo.notes}</p>}{photo.measurement&&<p><b>{photo.measurement.value} {photo.measurement.unit}</b> · {photo.measurement.label}</p>}<time dateTime={new Date(photo.createdAt).toISOString()}>{new Date(photo.createdAt).toLocaleString()}</time><label className="score-field" htmlFor={id}>Photographer<select id={id} value={players.some(player=>player.id===helper)?helper:''} disabled={!canChange} onChange={event=>setHelper(event.target.value)}><option value="">Choose name</option>{players.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></label><label className="photo-review-check"><input type="checkbox" checked={useful} disabled={!canChange} onChange={event=>setUseful(event.target.checked)}/>Useful new information</label><button className="tool-button" disabled={!canChange||!useful||!players.some(player=>player.id===helper)} onClick={()=>onChange(current=>approveUsefulPhoto(current,photo.id,helper),'25 points added.')}>Award 25 points</button></article>
}
function CleanupCredit({ mission, data, canChange, onChange }: { mission: CleanupMission; data: Workspace; canChange: boolean; onChange: Change }) {
  const entry = data.rewards?.entries.find(item=>item.missionId===mission.id)
  return <article className="photo-score-credit"><h3>{mission.area}</h3><p>{mission.summary}</p><label className="score-field">Helper<select value={entry?.playerId??''} disabled={!canChange||entry?.approvedAt!=null} onChange={event=>{if(event.target.value)onChange(current=>assignMission(current,mission.id,event.target.value),'Cleanup points assigned.')}}><option value="">Choose name</option>{data.rewards?.players.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></label><p>100 cleanup points{entry?.approvedAt!=null?' · earlier approval retained':''}</p></article>
}
