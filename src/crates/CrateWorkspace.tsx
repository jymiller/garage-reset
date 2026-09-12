import { useState } from 'react'
import { createPortal } from 'react-dom'
import { GarageIcon } from '../components/GarageIcons'
import { ContainerLabel } from './ContainerLabel'
import { findCrateByCode } from './labelLinks'
import './labelActions.css'
import type { Tab } from '../App'
import { volumeStats } from './model'
import type { Crate, ContentItem, Workspace } from './model'
import { HelperIdentity, readHelperPlayerId } from '../rewards/HelperIdentity'
import { inventoryCredit } from '../rewards/activityPoints'
import { uploadCratePhoto, useWorkspace } from './useWorkspace'
import './crates.css'
import './crate-start.css'

const decisions: ContentItem['decision'][] = ['undecided', 'keep', 'donate', 'sell', 'recycle', 'trash']
const liters = (n: number) => `${Math.round(n * 10) / 10} L`
const uid = () => crypto.randomUUID()

export function CrateWorkspace({ onNavigate, initialCrateId, initialStep, onPlayCrate, labelCode, onCapture, onLabelQuest }: { onNavigate: (tab: Tab) => void; onLabelQuest: (code?: string) => void; onCapture: (kind: 'crate'|'parking'|'measurement'|'placement', crateId?:string|null) => void; initialCrateId?: string|null; initialStep?: 'locate'|'sort'|'repack'; labelCode?: string|null; onPlayCrate?: (id:string)=>void }) {
  const workspace = useWorkspace()
  const { data, update } = workspace
  const [helperId, setHelperId] = useState(readHelperPlayerId)
  const helper = data.rewards?.players.find(player => player.id === helperId)
  const [selected, setSelected] = useState<string | null>(initialCrateId || null)
  const [step, setStep] = useState<'locate' | 'sort' | 'repack'>(initialCrateId ? initialStep ?? 'repack' : 'locate')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const [scannedOpened, setScannedOpened] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [draftDownloaded, setDraftDownloaded] = useState(false)
  const scanned = !scannedOpened && labelCode ? findCrateByCode(data.crates, labelCode) : null
  const registrationReady = !labelCode || scannedOpened || !!scanned || workspace.status === 'shared'
  const crate = scanned ?? data.crates.find(c => c.id === selected)
  const stats = volumeStats(data)
  const pendingMeasurements = data.crates.filter(c => c.status === 'sorting').length
  const filtered = data.crates.filter(c => `${c.code} ${c.name} ${c.location} ${c.owner}`.toLowerCase().includes(query.toLowerCase()))
  const photographedLabels = [...new Set((data.observations??[]).flatMap(photo=>photo.labelCode?[photo.labelCode]:[]))].sort()
  const items = data.items.filter(i => i.crateId === crate?.id)
  const statusLabels = { connecting: 'Connecting…', shared: 'Saved', saving: 'Saving…', offline: 'Offline · draft on this device', conflict: 'Changes need review', error: 'Save needs attention' }

  function patchCrate(id: string, patch: Partial<Crate>) {
    return update(d => ({ ...d, crates: d.crates.map(c => c.id === id ? { ...c, ...patch } : c) }))
  }
  function patchItem(id: string, patch: Partial<ContentItem>) {
    return update(d => ({ ...d, items: d.items.map(i => i.id === id ? { ...i, ...patch } : i) }))
  }
  function moveItem(item: ContentItem, destinationId: string) {
    if (destinationId === item.crateId) return
    update(d => ({ ...d, items: d.items.map(i => i.id === item.id ? { ...i, crateId: destinationId, destination: d.crates.find(c => c.id === destinationId)?.code || '' } : i), crates: d.crates.map(c => c.id === item.crateId || c.id === destinationId ? { ...c, status: 'sorting' } : c) }))
    setNotice('Moved. Recheck the fill of both containers.')
  }
  function openCrate(id: string) { setScannedOpened(true); setSelected(id); setStep('locate'); setNotice('') }
  async function addPhoto(file: File | undefined) {
    if (!file || !crate) return
    const id = crate.id
    setPhotoBusy(true); setNotice('')
    try { const photo = await uploadCratePhoto(file); if (patchCrate(id, { photo })) setNotice('Photo added.') }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Photo upload failed. Please retry.') }
    finally { setPhotoBusy(false) }
  }

  const rosterContent = <>
          <div className="crate-roster-heading"><h2>Inventory</h2><button disabled={!registrationReady} onClick={() => setAdding(true)}>+ Add crate</button></div>
          <input aria-label="Find a crate" placeholder="Find a crate…" value={query} onChange={e=>setQuery(e.target.value)} />
          {!data.crates.length && <div className="roster-empty"><GarageIcon name="crate" className="crate-empty-icon"/><p>No inventory yet.</p></div>}
          {filtered.map(c => <button key={c.id} className={`crate-roster-item ${selected===c.id?'selected':''}`} onClick={()=>openCrate(c.id)}><span className="crate-code">{c.code}</span><strong>{c.name}</strong><small>{c.location || 'Location not recorded'}</small><span className={`crate-state ${c.status}`}>{c.status}</span><span className="roster-volume">{liters(c.capacityLiters*(c.status==='repacked'?c.currentFill:c.baselineFill)/100)}</span></button>)}
          {data.crates.length>0 && !filtered.length && <p className="roster-empty">No matching containers.</p>}
  </>

  return <div className="crate-app">
    <header className="crate-topbar">
      <button className="crate-brand" onClick={() => onNavigate('home')} aria-label="Garage Reset home"><span>G↗</span> GARAGE RESET</button>
      <nav aria-label="Garage workspace"><button onClick={()=>onNavigate('play')}>Play</button><button onClick={() => onNavigate('pickup')}>Pickup</button><button className="active">Crates</button><button onClick={() => onNavigate('layout')}>Garage</button></nav>
      <span className={`crate-sync ${workspace.status}`} role="status">● {workspace.storageError ? 'Device backup unavailable · export now' : workspace.dirty && workspace.status === 'shared' ? 'Saving changes…' : statusLabels[workspace.status]}</span>
    </header>
    <main className="crate-main">

      {labelCode && !scannedOpened && !scanned && <section className="crate-scan-result" role="status"><span>CRATE</span><h2>{labelCode}</h2>{workspace.status === 'connecting' ? <p>Looking up this label…</p> : workspace.status !== 'shared' ? <p>Connect to check this ID. Your draft is kept.</p> : <><p>Add outside and contents photos.</p>{/^C-(?!000)\d{3}$/.test(labelCode.toUpperCase()) && <button className="crate-primary" onClick={() => onLabelQuest(labelCode)}>Label crates →</button>}<details><summary>Add to inventory</summary><button className="crate-secondary" onClick={() => setAdding(true)}>Register {labelCode} →</button></details></>}</section>}

      {workspace.status === 'offline' && <div className="crate-alert">Offline: this draft stays on your device. Connect to sync or upload photos.</div>}
      {workspace.conflict && <div className="crate-alert conflict" role="alert"><strong>Another device saved changes.</strong><p>Download your draft before loading the shared version.</p><button onClick={() => { workspace.downloadDraft(); setDraftDownloaded(true) }}>Download my draft</button><button disabled={!draftDownloaded} onClick={() => { workspace.useSharedVersion(); setDraftDownloaded(false); setNotice('') }}>Use shared version</button></div>}
      {workspace.error && !workspace.conflict && <p className="crate-alert" role="alert">{workspace.error}</p>}
      {!crate && (!labelCode || scannedOpened) && <section className="crate-quick-start"><GarageIcon name="crate"/><div><h1>Crates</h1><div className="crate-quick-actions"><button className="crate-primary" onClick={()=>onCapture('crate')}>Add photo</button><button className="crate-secondary" onClick={()=>onLabelQuest()}>Label crates</button></div></div></section>}
      {!crate && photographedLabels.length>0 && <section className="crate-photo-catalog"><h2>Crate photos</h2><div>{photographedLabels.map(code=>{const photos=(data.observations??[]).filter(photo=>photo.labelCode===code);const latest=photos.slice().sort((a,b)=>b.createdAt-a.createdAt)[0];return <button key={code} onClick={()=>onLabelQuest(code)}><img src={latest.photo} alt={`${code} latest view`}/><span><b>{code}</b><strong>{findCrateByCode(data.crates,code)?.name || latest.location || 'View photos'}</strong><small>{photos.length} photos · {photos.some(photo=>photo.photoRole==='contents')?'Contents ✓':'Needs contents photo'}</small></span></button>})}</div></section>}
      <div className={`crate-workbench ${crate ? 'has-selection' : ''}`}>
        <aside className="crate-roster">
          {crate ? rosterContent : <details className="crate-roster-optional"><summary>Inventory ({data.crates.length})</summary>{rosterContent}</details>}
        </aside>
        <section className="crate-detail">
          {!crate ? <details className="crate-register-later"><summary>Add a crate to inventory</summary><p>Record its contents and fill when you’re ready.</p><button className="crate-primary" disabled={!registrationReady} onClick={()=>setAdding(true)}>Add crate →</button></details> : <>
            <button className="crate-back" onClick={()=>{setScannedOpened(true);setSelected(null)}}>← All crates</button>
            <div className="crate-detail-title"><div><span className="crate-eyebrow">{crate.code} · {crate.owner || 'Owner unknown'}</span><h2>{crate.name}</h2><p>{crate.location || 'Location unknown'}</p></div><div className="crate-title-actions">{/^C-(?!000)\d{3}$/.test(crate.code.toUpperCase()) && <button className="crate-primary" onClick={()=>onLabelQuest(crate.code)}>Labels & photos</button>}<button className="crate-label-button" onClick={()=>onCapture('crate',crate.id)}>Add photo</button>{onPlayCrate&&<button className="crate-label-button" onClick={()=>onPlayCrate(crate.id)}>Cleanup</button>}<button className="crate-label-button" onClick={()=>setShowLabel(true)}>Print QR</button></div></div>
            <div className="crate-step-tabs" role="group" aria-label="Crate session step">{(['locate','sort','repack'] as const).map((s,i)=><button key={s} aria-pressed={step===s} onClick={()=>setStep(s)}><span>0{i+1}</span>{s==='locate'?'Details':s==='sort'?'Contents':'Repack'}</button>)}</div>
            {step==='locate' && <div className="crate-locate" key={crate.id}>
              <div className="crate-photo" aria-busy={photoBusy}>
                {crate.photo ? <img src={crate.photo} alt={`${crate.code}: ${crate.name}`} /> : <div><GarageIcon name="missions" className="crate-camera-icon"/><p>Show the crate and label.</p></div>}
                <label className={`crate-photo-button ${photoBusy?'busy':''}`}>{photoBusy?'Uploading…':crate.photo?'Retake photo':'Take photo'}<input aria-label="Crate photo camera" type="file" accept="image/*" capture="environment" disabled={photoBusy} onChange={e=>{void addPhoto(e.target.files?.[0]);e.target.value=''}} /></label>
                <label className={`crate-photo-button crate-photo-library ${photoBusy?'busy':''}`}>Choose from photos<input aria-label="Crate photo library" type="file" accept="image/*" disabled={photoBusy} onChange={e=>{void addPhoto(e.target.files?.[0]);e.target.value=''}} /></label>
              </div>
              <div className="crate-fields"><label>Name<input key={`${crate.id}-name-${crate.name}`} defaultValue={crate.name} maxLength={160} onBlur={e=>{if(e.target.value.trim())patchCrate(crate.id,{name:e.target.value.trim()})}} /></label><label>Location<input key={`${crate.id}-location-${crate.location}`} defaultValue={crate.location} placeholder="Right rack · middle shelf · left" maxLength={160} onBlur={e=>patchCrate(crate.id,{location:e.target.value.trim()})} /></label><details className="crate-extra-fields"><summary>Owner, volume & notes</summary><label>Owner<input key={`${crate.id}-owner-${crate.owner}`} defaultValue={crate.owner} placeholder="John / Griffin / LJ / shared / ask" maxLength={80} onBlur={e=>patchCrate(crate.id,{owner:e.target.value.trim()})} /></label><div className="crate-field-pair"><label>Capacity (L)<input type="number" min="1" max="2000" step="1" key={`${crate.id}-capacity-${crate.capacityLiters}`} defaultValue={crate.capacityLiters} disabled={data.baselineLocked} onBlur={e=>{const n=Number(e.target.value);if(n>0&&n<=2000)patchCrate(crate.id,{capacityLiters:n})}} /></label><label>Starting fill (%)<input type="number" min="0" max="100" step="5" key={`${crate.id}-baseline-${crate.baselineFill}`} defaultValue={crate.baselineFill} disabled={data.baselineLocked} onBlur={e=>{const n=Number(e.target.value);if(e.target.value!==''&&n>=0&&n<=100&&n!==crate.baselineFill)patchCrate(crate.id,{baselineFill:n,...(crate.status==='repacked'?{}:{currentFill:n})})}} /></label></div><p className="crate-fine">Use the printed capacity or your estimate. Reopen the baseline to change locked values.</p><label>Notes<textarea key={`${crate.id}-notes-${crate.notes}`} defaultValue={crate.notes} rows={3} maxLength={4000} placeholder="Anything to remember?" onBlur={e=>patchCrate(crate.id,{notes:e.target.value.trim()})} /></label></details></div>
              <button className="crate-primary" onClick={()=>{if(crate.status==='unopened')patchCrate(crate.id,{status:'sorting'});setStep('sort')}}>Add contents →</button>
            </div>}
            {step==='sort' && <div className="crate-sort"><details className="crate-inventory-helper"><summary>{helper ? `${helper.name} · change player` : 'Choose player for points'}</summary><HelperIdentity workspace={workspace} selectedPlayerId={helperId} onSelectPlayer={setHelperId}/></details><p className="crate-fine">New items: +25 points per saved batch.</p><ContentCapture key={crate.id} crate={crate} onAdd={entries=>{let credited=false;const accepted=update(d=>{const next:Workspace={...d,items:[...d.items,...entries],crates:d.crates.map(c=>c.id===crate.id?{...c,status:'sorting'}:c)};const result=helper?inventoryCredit(next,crate,entries.map(item=>item.id),helper.id):next;credited=result!==next;return result});if(accepted)setNotice(credited?`${helper!.name} earned 25 inventory points.`:'Contents saved. Choose a player to earn points next time.');return accepted}} /><div className="contents-heading"><h3>What’s inside <span>{items.length} records</span></h3><p>Mark “left” only after items leave the garage.</p></div>{!items.length && <p className="contents-empty">No contents yet.</p>}{items.map(item=><div className={`content-item decision-${item.decision}`} key={item.id}><div className="content-item-heading"><label>Item<input aria-label={`Contents label for ${item.name}`} key={`${item.id}-name-${item.name}`} defaultValue={item.name} maxLength={160} onBlur={e=>{const name=e.target.value.trim();if(name)patchItem(item.id,{name});else e.target.value=item.name}} /></label><label className="content-quantity">Quantity<input aria-label={`Quantity of ${item.name}`} key={`${item.id}-quantity-${item.quantity}`} type="number" min="1" max="100000" step="1" defaultValue={item.quantity} onBlur={e=>{const quantity=Number(e.target.value);if(Number.isSafeInteger(quantity)&&quantity>0&&quantity<=100000&&quantity!==item.quantity)update(d=>({...d,items:d.items.map(i=>i.id===item.id?{...i,quantity}:i),crates:d.crates.map(c=>c.id===item.crateId?{...c,status:'sorting'}:c)}));else e.target.value=String(item.quantity)}} /></label></div><div className="content-controls"><label>Decision<select aria-label={`Decision for ${item.name}`} value={item.decision} onChange={e=>patchItem(item.id,{decision:e.target.value as ContentItem['decision'],departed:false})}>{decisions.map(d=><option key={d} value={d}>{d==='undecided'?'Ask / undecided':d}</option>)}</select></label><label>Destination<input aria-label={`Destination for ${item.name}`} key={`${item.id}-${item.destination}`} defaultValue={item.destination} placeholder="C-002, shelf, donation pickup…" maxLength={240} onBlur={e=>patchItem(item.id,{destination:e.target.value.trim()})} /></label></div><div className="content-footer">{!['keep','undecided'].includes(item.decision) ? <label><input type="checkbox" checked={item.departed} onChange={e=>patchItem(item.id,{departed:e.target.checked})} />Actually left the garage</label> : <span>{item.decision==='keep'?'Choose a home for this item.':'Ask the owner.'}</span>}<label className="move-item">Move record to<select aria-label={`Move ${item.name} to another crate`} value={item.crateId} onChange={e=>moveItem(item,e.target.value)}>{data.crates.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select></label></div></div>)}<button className="crate-primary" onClick={()=>setStep('repack')}>Repack →</button></div>}
            {step==='repack' && <Repack key={`${crate.id}:${crate.currentFill}:${crate.status}:${crate.baselineFill}:${crate.capacityLiters}:${JSON.stringify(items)}`} crate={crate} items={items} onSave={fill=>{if(patchCrate(crate.id,{currentFill:fill,status:'repacked'}))setNotice(`${crate.code} repack saved.`)}} onReopen={()=>{patchCrate(crate.id,{status:'sorting'});setStep('sort')}} />}
            {notice && <p className="crate-notice" role="status">{notice} {workspace.dirty ? 'Saving…' : workspace.status==='shared' ? 'Saved.' : 'Check save status.'}</p>}

          </>}
        </section>
      </div>
      <details className="crate-optional-tools"><summary>Storage progress</summary>
      <section className="crate-hero">
        <div><h2>Free half the storage.</h2><p>Keep both car spaces clear.</p></div>
        <div className="volume-score"><div><span>{data.baselineLocked ? 'REGISTERED BASELINE' : 'BASELINE IN PROGRESS'}</span><b>50<span>%</span><small>less occupied volume</small></b></div><div className="volume-numbers"><span>Before <strong>{liters(stats.baselineLiters)}</strong></span><span>Now <strong>{pendingMeasurements ? 'Recheck fill' : liters(stats.currentLiters)}</strong></span><span>Target <strong>{liters(stats.targetLiters)}</strong></span></div><div className="volume-track" role="progressbar" aria-label="Occupied volume reduction toward 50 percent" aria-valuenow={pendingMeasurements ? 0 : Math.min(50, Math.round(stats.freedPercent))} aria-valuemin={0} aria-valuemax={50}><i style={{width:`${pendingMeasurements ? 0 : Math.min(100,stats.freedPercent*2)}%`}} /></div><p>{pendingMeasurements ? `${pendingMeasurements} container${pendingMeasurements===1?'':'s'} awaiting a fill check · progress pending` : stats.baselineLiters ? `${Math.round(stats.freedPercent)}% freed · ${liters(stats.remainingToTarget)} to the target` : 'Add your first crate to start the estimate.'}</p><small>Estimated contents volume. Combine partly empty crates to free shelf space. {data.baselineLocked ? 'Based on recorded containers.' : 'Record the full baseline before judging the whole garage.'}</small></div>
      </section>
      <div className="crate-workspace-tools"><div><span>{data.crates.length} containers</span><span>{stats.unopenedCount} unopened</span><span>{stats.pendingDepartureCount} batches awaiting departure</span></div><div><button onClick={() => workspace.downloadDraft()}>Export backup ↓</button><button disabled={!data.crates.length || data.crates.some(c => c.baselineFill === 0) && !data.baselineLocked} onClick={() => update(d => ({...d,baselineLocked:!d.baselineLocked}))}>{data.baselineLocked ? 'Reopen baseline' : 'Lock baseline'}</button></div></div>
      {!data.baselineLocked && <p className="baseline-note">Record the containers and bulky items you want to halve. Estimate starting fill, then lock the baseline.</p>}
      </details>
      <details className="crate-optional-tools"><summary>Print labels</summary>
      <section className="crate-label-kit"><a href="/print/garage-labels-avery-5163-crates-1-5.pdf" target="_blank" rel="noreferrer">Avery 5163/8163 · Crates 1–5 ↓</a><a href="/print/garage-labels-avery-5163-crates-6-32.pdf" target="_blank" rel="noreferrer">Avery 5163/8163 · Crates 6–32 ↓</a><a href="/print/garage-container-labels.pdf" target="_blank" rel="noreferrer">Plain paper · All 32 crates ↓</a><small>Letter · Actual size / 100%. Match existing crate IDs.</small></section>
      </details>
      <footer className="crate-footer"><span>Keep parking clear. Open one crate at a time.</span><button onClick={()=>onNavigate('capture')}>Item list →</button></footer>
    </main>
    {showLabel && crate && createPortal(<div className="crate-label-overlay"><section className="crate-label-dialog" role="dialog" aria-modal="true" aria-labelledby="label-dialog-title"><div className="crate-label-controls"><h2 id="label-dialog-title">Label for {crate.code}</h2><p>QR opens this crate. Family access stays private.</p><p>Plain Letter paper · Actual size / 100%.</p><div><button onClick={() => window.print()}>Print label</button><button onClick={() => setShowLabel(false)}>Close label</button></div></div><ContainerLabel code={crate.code} name={crate.name} location={crate.location} owner={crate.owner}/></section></div>, document.body)}
    {adding && <NewCrate blocked={!registrationReady} initialCode={!scannedOpened && !scanned ? labelCode : null} locked={data.baselineLocked} reservedCodes={(data.observations??[]).flatMap(o=>o.labelCode?[o.labelCode]:[])} existingCodes={data.crates.map(c=>c.code)} onClose={()=>setAdding(false)} onCreate={c=>{if(!registrationReady)return false;const saved=update(d=>({...d,crates:[...d.crates,c]}));if(saved){openCrate(c.id);setAdding(false)}return saved}} />}
  </div>
}

function NewCrate({locked,existingCodes,reservedCodes,onClose,onCreate,initialCode,blocked}:{reservedCodes:string[];blocked:boolean;initialCode?:string|null;locked:boolean;existingCodes:string[];onClose:()=>void;onCreate:(crate:Crate)=>boolean}) {
  let serial=1; while([...existingCodes,...reservedCodes].some(c=>c.toLowerCase()===`c-${String(serial).padStart(3,'0')}`))serial++
  const [code,setCode]=useState(initialCode || `C-${String(serial).padStart(3,'0')}`)
  const [name,setName]=useState('')
  const [location,setLocation]=useState('')
  const [capacity,setCapacity]=useState('60')
  const [fill,setFill]=useState(locked?'0':'100')
  const valid=name.trim()&&code.trim()&&!existingCodes.some(c=>c.toLowerCase()===code.trim().toLowerCase())&&Number(capacity)>0&&Number(capacity)<=2000&&Number(fill)>=0&&Number(fill)<=100
  return <div className="crate-modal-backdrop"><section className="crate-modal" role="dialog" aria-modal="true" aria-labelledby="new-crate-heading"><button className="crate-modal-close" onClick={onClose} aria-label="Close new container">×</button><h2 id="new-crate-heading">Add a crate</h2><p>Match the ID on the crate.</p><form onSubmit={e=>{e.preventDefault();if(valid&&!blocked)onCreate({id:uid(),code:code.trim(),name:name.trim(),location:location.trim(),owner:'',capacityLiters:Number(capacity),baselineFill:Number(fill),currentFill:Number(fill),status:'unopened',photo:null,notes:'',createdAt:Date.now()})}}><label>Label ID<input autoFocus value={code} maxLength={32} onChange={e=>setCode(e.target.value)} /></label><label>Name<input value={name} maxLength={160} placeholder="Camping gear / unknown blue tote…" onChange={e=>setName(e.target.value)} /></label><label>Location<input value={location} maxLength={160} placeholder="Right rack · middle shelf" onChange={e=>setLocation(e.target.value)} /></label><div className="crate-field-pair"><label>Capacity (L)<input type="number" min="1" max="2000" value={capacity} onChange={e=>setCapacity(e.target.value)} /></label><label>Starting fill (%)<input type="number" min="0" max="100" value={fill} disabled={locked} onChange={e=>setFill(e.target.value)} /></label></div><p className="crate-fine">{locked?'Baseline locked: new crates start empty. Reopen it to add existing filled crates.':'Replace the suggested 60 L with the crate’s capacity. Estimate its fill.'}</p>{blocked&&<p role="status">Checking this ID…</p>}<button className="crate-primary" disabled={!valid||blocked} type="submit">Create {code || 'container'} →</button></form></section></div>
}

function ContentCapture({crate,onAdd}:{crate:Crate;onAdd:(entries:ContentItem[])=>boolean}) {
  const [text,setText]=useState('')
  const [added,setAdded]=useState('')
  return <form className="content-capture" onSubmit={e=>{e.preventDefault();const lines=text.split('\n').map(s=>s.trim()).filter(Boolean);if(lines.length>100){setAdded('Maximum 100 lines. Your text is kept.');return}const entries=lines.map(line=>{const match=line.match(/^(\d+)\s*[x×]\s+(.+)$/i);return{id:uid(),crateId:crate.id,name:(match?match[2]:line).trim(),quantity:match?Number(match[1]):1,decision:'undecided' as const,destination:'',departed:false,notes:''}});if(entries.some(i=>i.name.length>160||!Number.isSafeInteger(i.quantity)||i.quantity<1||i.quantity>100000)){setAdded('Use names under 160 characters and quantities of 1–100,000. Your text is kept.');return}if(entries.length&&onAdd(entries)){setText('');setAdded(`${entries.length} items added.`)}}}><label>What’s inside?<textarea aria-label="Describe crate contents" value={text} maxLength={12000} rows={4} onChange={e=>setText(e.target.value)} placeholder={'3x camping mugs\nTent repair kit\nBag of loose cables'} /></label><div><p>One item or group per line. Dictation works too.</p><button className="crate-primary" disabled={!text.trim()}>Add contents +</button></div>{added&&<p role="status">{added}</p>}</form>
}

function Repack({crate,items,onSave,onReopen}:{crate:Crate;items:ContentItem[];onSave:(fill:number)=>void;onReopen:()=>void}) {
  const [fill,setFill]=useState(crate.currentFill)
  const [checked,setChecked]=useState(false)
  const pending=items.filter(i=>i.decision==='undecided').length
  const outgoing=items.filter(i=>!['keep','undecided'].includes(i.decision)&&!i.departed).length
  return <div className="repack-panel"><h3>Repack the crate</h3><p>Group what you’re keeping. Set undecided items aside. Recheck fill in every crate you used.</p><div className="repack-counts"><span>{pending} undecided</span><span>{outgoing} outgoing, still here</span></div>{outgoing>0&&<p className="crate-alert">Items still here count toward fill. If you move them to another crate, move their records and update that crate’s fill.</p>}<label className="repack-fill">How full is the container now? <strong>{fill}% · {liters(crate.capacityLiters*fill/100)}</strong><input aria-label="Remaining crate fill percentage" type="range" min="0" max="100" step="5" value={fill} onChange={e=>{setFill(Number(e.target.value));setChecked(false)}} /></label><div className="repack-comparison"><span>Starting estimate<strong>{liters(crate.capacityLiters*crate.baselineFill/100)}</strong></span><span>After repacking<strong>{liters(crate.capacityLiters*fill/100)}</strong></span></div><label className="repack-confirm"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} />Fill checked, moved items accounted for, parking boundary clear.</label><button className="crate-primary" disabled={!checked} onClick={()=>{onSave(fill);setChecked(false)}}>Confirm repacking</button>{crate.status==='repacked'&&<button className="crate-secondary" onClick={onReopen}>Reopen this crate</button>}<p className="crate-fine">Volume is your estimate. A photo does not measure fill or confirm removal.</p></div>
}
