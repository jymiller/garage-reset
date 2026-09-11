import { useState } from 'react'
import type { Tab } from '../App'
import { volumeStats } from './model'
import type { Crate, ContentItem } from './model'
import { uploadCratePhoto, useWorkspace } from './useWorkspace'
import './crates.css'

const decisions: ContentItem['decision'][] = ['undecided', 'keep', 'donate', 'sell', 'recycle', 'trash']
const liters = (n: number) => `${Math.round(n * 10) / 10} L`
const uid = () => crypto.randomUUID()

export function CrateWorkspace({ onNavigate, initialCrateId, initialStep, onPlayCrate }: { onNavigate: (tab: Tab) => void; initialCrateId?: string|null; initialStep?: 'locate'|'repack'; onPlayCrate?: (id:string)=>void }) {
  const workspace = useWorkspace()
  const { data, update } = workspace
  const [selected, setSelected] = useState<string | null>(initialCrateId || null)
  const [step, setStep] = useState<'locate' | 'sort' | 'repack'>(initialCrateId ? initialStep ?? 'repack' : 'locate')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [draftDownloaded, setDraftDownloaded] = useState(false)
  const crate = data.crates.find(c => c.id === selected)
  const stats = volumeStats(data)
  const pendingMeasurements = data.crates.filter(c => c.status === 'sorting').length
  const filtered = data.crates.filter(c => `${c.code} ${c.name} ${c.location} ${c.owner}`.toLowerCase().includes(query.toLowerCase()))
  const items = data.items.filter(i => i.crateId === selected)
  const statusLabels = { connecting: 'Connecting to shared workspace', shared: 'Live · shared workspace', saving: 'Saving changes…', offline: 'Offline · saved on this device', conflict: 'Changes need review', error: 'Save needs attention' }

  function patchCrate(id: string, patch: Partial<Crate>) {
    return update(d => ({ ...d, crates: d.crates.map(c => c.id === id ? { ...c, ...patch } : c) }))
  }
  function patchItem(id: string, patch: Partial<ContentItem>) {
    return update(d => ({ ...d, items: d.items.map(i => i.id === id ? { ...i, ...patch } : i) }))
  }
  function moveItem(item: ContentItem, destinationId: string) {
    if (destinationId === item.crateId) return
    update(d => ({ ...d, items: d.items.map(i => i.id === item.id ? { ...i, crateId: destinationId, destination: d.crates.find(c => c.id === destinationId)?.code || '' } : i), crates: d.crates.map(c => c.id === item.crateId || c.id === destinationId ? { ...c, status: 'sorting' } : c) }))
    setNotice('Record moved. Recheck the occupied fill of both containers after the physical transfer.')
  }
  function openCrate(id: string) { setSelected(id); setStep('locate'); setNotice('') }
  async function addPhoto(file: File | undefined) {
    if (!file || !crate) return
    const id = crate.id
    setPhotoBusy(true); setNotice('')
    try { const photo = await uploadCratePhoto(file); if (patchCrate(id, { photo })) setNotice('Photo attached to this crate.') }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Photo upload failed. Please retry.') }
    finally { setPhotoBusy(false) }
  }

  return <div className="crate-app">
    <header className="crate-topbar">
      <button className="crate-brand" onClick={() => onNavigate('pickup')}><span>G↗</span> GARAGE RESET</button>
      <nav aria-label="Garage workspace"><button onClick={()=>onNavigate('play')}>Play</button><button onClick={() => onNavigate('pickup')}>Pickup</button><button className="active">Crate lab</button><button onClick={() => onNavigate('layout')}>Garage map</button></nav>
      <span className={`crate-sync ${workspace.status}`} role="status">● {workspace.storageError ? 'Device backup unavailable · export now' : statusLabels[workspace.status]}</span>
    </header>
    <main className="crate-main">
      <section className="crate-hero">
        <div><span className="crate-eyebrow">THE HALF-AS-MUCH PROJECT</span><h1>Know what’s inside.<br /><em>Make room for less.</em></h1><p>Plan on your laptop. Open one crate on your phone.<br />Keep both car spaces clear, every session.</p></div>
        <div className="volume-score"><div><span>{data.baselineLocked ? 'REGISTERED BASELINE' : 'BASELINE IN PROGRESS'}</span><b>50<span>%</span><small>less occupied volume</small></b></div><div className="volume-numbers"><span>Before <strong>{liters(stats.baselineLiters)}</strong></span><span>Now <strong>{pendingMeasurements ? 'Recheck fill' : liters(stats.currentLiters)}</strong></span><span>Target <strong>{liters(stats.targetLiters)}</strong></span></div><div className="volume-track" role="progressbar" aria-label="Occupied volume reduction toward 50 percent" aria-valuenow={pendingMeasurements ? 0 : Math.min(50, Math.round(stats.freedPercent))} aria-valuemin={0} aria-valuemax={50}><i style={{width:`${pendingMeasurements ? 0 : Math.min(100,stats.freedPercent*2)}%`}} /></div><p>{pendingMeasurements ? `${pendingMeasurements} container${pendingMeasurements===1?'':'s'} awaiting a fill check · progress pending` : stats.baselineLiters ? `${Math.round(stats.freedPercent)}% freed · ${liters(stats.remainingToTarget)} to the target` : 'Add your first crate to start the estimate.'}</p><small>Capacity × fill estimates contents volume. Partly empty crates still take shelf space: consolidate into fewer containers. {data.baselineLocked ? 'Compared with the containers you registered.' : 'This is not a whole-garage result until the baseline is complete.'}</small></div>
      </section>
      <div className="crate-workspace-tools"><div><span>{data.crates.length} containers</span><span>{stats.unopenedCount} unopened</span><span>{stats.pendingDepartureCount} batches awaiting departure</span></div><div><button onClick={() => workspace.downloadDraft()}>Export backup ↓</button><button disabled={!data.crates.length || data.crates.some(c => c.baselineFill === 0) && !data.baselineLocked} onClick={() => update(d => ({...d,baselineLocked:!d.baselineLocked}))}>{data.baselineLocked ? 'Reopen baseline' : 'Lock baseline'}</button></div></div>
      {!data.baselineLocked && <p className="baseline-note">Register all containers and bulky items in the area you want to halve, estimate their starting capacity and fill, then lock the baseline. You can sort while you build this inventory.</p>}
      {workspace.status === 'offline' && <div className="crate-alert">This device is keeping a draft. Phone and laptop share changes only while connected to this app’s shared server. Photo uploads need a connection.</div>}
      {workspace.conflict && <div className="crate-alert conflict" role="alert"><strong>Another device saved changes.</strong><p>Your local draft has been preserved. Download it before loading the shared version; changes are not silently overwritten.</p><button onClick={() => { workspace.downloadDraft(); setDraftDownloaded(true) }}>Download my draft</button><button disabled={!draftDownloaded} onClick={() => { workspace.useSharedVersion(); setDraftDownloaded(false) }}>Use shared version</button></div>}
      {workspace.error && !workspace.conflict && <p className="crate-alert" role="alert">{workspace.error}</p>}
      <div className={`crate-workbench ${crate ? 'has-selection' : ''}`}>
        <aside className="crate-roster">
          <div className="crate-roster-heading"><h2>Your containers</h2><button onClick={() => setAdding(true)}>+ Add</button></div>
          <input aria-label="Find a crate" placeholder="Find by ID, contents label or shelf…" value={query} onChange={e=>setQuery(e.target.value)} />
          {!data.crates.length && <div className="roster-empty"><span>01</span><p>Start with one real crate.<br />Give it a label you can find again.</p></div>}
          {filtered.map(c => <button key={c.id} className={`crate-roster-item ${selected===c.id?'selected':''}`} onClick={()=>openCrate(c.id)}><span className="crate-code">{c.code}</span><strong>{c.name}</strong><small>{c.location || 'Location not recorded'}</small><span className={`crate-state ${c.status}`}>{c.status}</span><span className="roster-volume">{liters(c.capacityLiters*(c.status==='repacked'?c.currentFill:c.baselineFill)/100)}</span></button>)}
          {data.crates.length>0 && !filtered.length && <p className="roster-empty">No matching containers.</p>}
        </aside>
        <section className="crate-detail">
          {!crate ? <div className="crate-welcome"><span className="crate-eyebrow">ONE CONTAINER, START TO FINISH</span><h2>{data.crates.length ? 'Pick a crate. Finish a batch.' : 'Let’s open the first one.'}</h2><p>Label it <strong>C-001</strong>. Record where it lives, take a photo, and describe what’s inside. We’ll turn that into a contents list and a repacking plan.</p><ol><li><b>Locate</b><span>ID, shelf, owner and starting volume.</span></li><li><b>Open & sort</b><span>Photograph, describe, decide and assign destinations.</span></li><li><b>Repack</b><span>Record its new fill and confirm the parking floor is clear.</span></li></ol><button className="crate-primary" onClick={()=>setAdding(true)}>{data.crates.length ? 'Register another container →' : 'Register the first crate →'}</button><p className="crate-fine">Phone: use the same app address as your laptop. Use your keyboard’s dictation to describe contents; add one item or group per line.</p></div> : <>
            <button className="crate-back" onClick={()=>setSelected(null)}>← All containers</button>
            <div className="crate-detail-title"><div><span className="crate-eyebrow">{crate.code} · {crate.owner || 'OWNER NOT ASSIGNED'}</span><h2>{crate.name}</h2><p>{crate.location || 'Record the shelf location below.'}</p></div><div className="crate-title-actions">{onPlayCrate&&<button className="crate-primary" onClick={()=>onPlayCrate(crate.id)}>▶ Play this crate</button>}<button className="crate-label-button" onClick={()=>window.print()}>Print label ↗</button></div></div>
            <div className="crate-step-tabs" role="group" aria-label="Crate session step">{(['locate','sort','repack'] as const).map((s,i)=><button key={s} aria-pressed={step===s} onClick={()=>setStep(s)}><span>0{i+1}</span>{s==='locate'?'Locate':s==='sort'?'Open & sort':'Repack'}</button>)}</div>
            {step==='locate' && <div className="crate-locate" key={crate.id}>
              <div className="crate-photo">{crate.photo ? <img src={crate.photo} alt={`${crate.code}: ${crate.name}`} /> : <div><span>▧</span><p>Show the label and the open contents.</p></div>}<label className="crate-photo-button">{photoBusy?'Uploading…':crate.photo?'Replace photo':'Take / add photo'}<input aria-label="Crate photo" type="file" accept="image/*" capture="environment" disabled={photoBusy} onChange={e=>{void addPhoto(e.target.files?.[0]);e.target.value=''}} /></label></div>
              <div className="crate-fields"><label>Name<input key={`${crate.id}-name-${crate.name}`} defaultValue={crate.name} maxLength={160} onBlur={e=>{if(e.target.value.trim())patchCrate(crate.id,{name:e.target.value.trim()})}} /></label><label>Exact shelf / location<input key={`${crate.id}-location-${crate.location}`} defaultValue={crate.location} placeholder="Right rack · middle shelf · left" maxLength={160} onBlur={e=>patchCrate(crate.id,{location:e.target.value.trim()})} /></label><label>Owner<input key={`${crate.id}-owner-${crate.owner}`} defaultValue={crate.owner} placeholder="John / Griffin / LJ / shared / ask" maxLength={80} onBlur={e=>patchCrate(crate.id,{owner:e.target.value.trim()})} /></label><div className="crate-field-pair"><label>Container capacity (liters)<input type="number" min="1" max="2000" step="1" key={`${crate.id}-capacity-${crate.capacityLiters}`} defaultValue={crate.capacityLiters} disabled={data.baselineLocked} onBlur={e=>{const n=Number(e.target.value);if(n>0&&n<=2000)patchCrate(crate.id,{capacityLiters:n})}} /></label><label>Starting fill (%)<input type="number" min="0" max="100" step="5" key={`${crate.id}-baseline-${crate.baselineFill}`} defaultValue={crate.baselineFill} disabled={data.baselineLocked} onBlur={e=>{const n=Number(e.target.value);if(e.target.value!==''&&n>=0&&n<=100&&n!==crate.baselineFill)patchCrate(crate.id,{baselineFill:n,...(crate.status==='repacked'?{}:{currentFill:n})})}} /></label></div><p className="crate-fine">Use the capacity printed on the container, or estimate. A 60 L crate at 50% fill holds about 30 L. Reopen the baseline to correct locked estimates.</p><label>Notes<textarea key={`${crate.id}-notes-${crate.notes}`} defaultValue={crate.notes} rows={3} maxLength={4000} placeholder="What belongs here? Anything fragile or needing a decision?" onBlur={e=>patchCrate(crate.id,{notes:e.target.value.trim()})} /></label></div>
              <button className="crate-primary" onClick={()=>{if(crate.status==='unopened')patchCrate(crate.id,{status:'sorting'});setStep('sort')}}>Open this crate →</button>
            </div>}
            {step==='sort' && <div className="crate-sort"><ContentCapture key={crate.id} crate={crate} onAdd={entries=>update(d=>({...d,items:[...d.items,...entries],crates:d.crates.map(c=>c.id===crate.id?{...c,status:'sorting'}:c)}))} /><div className="contents-heading"><h3>What’s inside <span>{items.length} records</span></h3><p>Decisions are plans. Mark departure only after the material leaves the garage.</p></div>{!items.length && <p className="contents-empty">No contents recorded yet. Add a few items or one related group.</p>}{items.map(item=><div className={`content-item decision-${item.decision}`} key={item.id}><div className="content-item-heading"><label>Contents label<input aria-label={`Contents label for ${item.name}`} key={`${item.id}-name-${item.name}`} defaultValue={item.name} maxLength={160} onBlur={e=>{const name=e.target.value.trim();if(name)patchItem(item.id,{name});else e.target.value=item.name}} /></label><label className="content-quantity">Quantity<input aria-label={`Quantity of ${item.name}`} key={`${item.id}-quantity-${item.quantity}`} type="number" min="1" max="100000" step="1" defaultValue={item.quantity} onBlur={e=>{const quantity=Number(e.target.value);if(Number.isSafeInteger(quantity)&&quantity>0&&quantity<=100000&&quantity!==item.quantity)update(d=>({...d,items:d.items.map(i=>i.id===item.id?{...i,quantity}:i),crates:d.crates.map(c=>c.id===item.crateId?{...c,status:'sorting'}:c)}));else e.target.value=String(item.quantity)}} /></label></div><div className="content-controls"><label>Decision<select aria-label={`Decision for ${item.name}`} value={item.decision} onChange={e=>patchItem(item.id,{decision:e.target.value as ContentItem['decision'],departed:false})}>{decisions.map(d=><option key={d} value={d}>{d==='undecided'?'Ask / undecided':d}</option>)}</select></label><label>Destination<input aria-label={`Destination for ${item.name}`} key={`${item.id}-${item.destination}`} defaultValue={item.destination} placeholder="C-002, shelf, donation pickup…" maxLength={240} onBlur={e=>patchItem(item.id,{destination:e.target.value.trim()})} /></label></div><div className="content-footer">{!['keep','undecided'].includes(item.decision) ? <label><input type="checkbox" checked={item.departed} onChange={e=>patchItem(item.id,{departed:e.target.checked})} />Actually left the garage</label> : <span>{item.decision==='keep'?'Assign a specific home before repacking.':'Leave this pending until the owner decides.'}</span>}<label className="move-item">Move record to<select aria-label={`Move ${item.name} to another crate`} value={item.crateId} onChange={e=>moveItem(item,e.target.value)}>{data.crates.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select></label></div></div>)}<button className="crate-primary" onClick={()=>setStep('repack')}>Review the repack →</button></div>}
            {step==='repack' && <Repack key={`${crate.id}:${crate.currentFill}:${crate.status}:${crate.baselineFill}:${crate.capacityLiters}:${JSON.stringify(items)}`} crate={crate} items={items} onSave={fill=>{if(patchCrate(crate.id,{currentFill:fill,status:'repacked'}))setNotice(`${crate.code} repacking recorded. The volume estimate now reflects its new fill.`)}} onReopen={()=>{patchCrate(crate.id,{status:'sorting'});setStep('sort')}} />}
            {notice && <p className="crate-notice" role="status">{notice}</p>}
            <div className="crate-print-label"><b>{crate.code}</b><h2>{crate.name}</h2><p>{crate.location}</p><p>Owner: {crate.owner || 'Ask'}</p><small>Garage Reset · Updated {new Date().toLocaleDateString()}</small></div>
          </>}
        </section>
      </div>
      <footer className="crate-footer"><span>Parking boundary stays clear. One open container at a time.</span><button onClick={()=>onNavigate('capture')}>Previous inventory →</button></footer>
    </main>
    {adding && <NewCrate locked={data.baselineLocked} existingCodes={data.crates.map(c=>c.code)} onClose={()=>setAdding(false)} onCreate={c=>{const saved=update(d=>({...d,crates:[...d.crates,c]}));if(saved){openCrate(c.id);setAdding(false)}return saved}} />}
  </div>
}

function NewCrate({locked,existingCodes,onClose,onCreate}:{locked:boolean;existingCodes:string[];onClose:()=>void;onCreate:(crate:Crate)=>boolean}) {
  let serial=1; while(existingCodes.some(c=>c.toLowerCase()===`c-${String(serial).padStart(3,'0')}`))serial++
  const [code,setCode]=useState(`C-${String(serial).padStart(3,'0')}`)
  const [name,setName]=useState('')
  const [location,setLocation]=useState('')
  const [capacity,setCapacity]=useState('60')
  const [fill,setFill]=useState(locked?'0':'100')
  const valid=name.trim()&&code.trim()&&!existingCodes.some(c=>c.toLowerCase()===code.trim().toLowerCase())&&Number(capacity)>0&&Number(capacity)<=2000&&Number(fill)>=0&&Number(fill)<=100
  return <div className="crate-modal-backdrop"><section className="crate-modal" role="dialog" aria-modal="true" aria-labelledby="new-crate-heading"><button className="crate-modal-close" onClick={onClose} aria-label="Close new container">×</button><span className="crate-eyebrow">GIVE IT AN ADDRESS</span><h2 id="new-crate-heading">Register a container</h2><p>Use tape or a label to put this ID on the real crate. Bulky items can have their own record too.</p><form onSubmit={e=>{e.preventDefault();if(valid)onCreate({id:uid(),code:code.trim(),name:name.trim(),location:location.trim(),owner:'',capacityLiters:Number(capacity),baselineFill:Number(fill),currentFill:Number(fill),status:'unopened',photo:null,notes:'',createdAt:Date.now()})}}><label>Label ID<input autoFocus value={code} maxLength={32} onChange={e=>setCode(e.target.value)} /></label><label>Container name<input value={name} maxLength={160} placeholder="Camping gear / unknown blue tote…" onChange={e=>setName(e.target.value)} /></label><label>Where it lives<input value={location} maxLength={160} placeholder="Right rack · middle shelf" onChange={e=>setLocation(e.target.value)} /></label><div className="crate-field-pair"><label>Capacity (L)<input type="number" min="1" max="2000" value={capacity} onChange={e=>setCapacity(e.target.value)} /></label><label>Starting fill (%)<input type="number" min="0" max="100" value={fill} disabled={locked} onChange={e=>setFill(e.target.value)} /></label></div><p className="crate-fine">{locked?'Baseline is locked. This adds an empty destination container. Reopen the baseline first to register more existing stuff.':'60 L is only a starting suggestion. Replace it with the container capacity; fill is your estimate.'}</p><button className="crate-primary" disabled={!valid} type="submit">Create {code || 'container'} →</button></form></section></div>
}

function ContentCapture({crate,onAdd}:{crate:Crate;onAdd:(entries:ContentItem[])=>boolean}) {
  const [text,setText]=useState('')
  const [added,setAdded]=useState('')
  return <form className="content-capture" onSubmit={e=>{e.preventDefault();const lines=text.split('\n').map(s=>s.trim()).filter(Boolean);if(lines.length>100){setAdded('Add up to 100 lines at a time. Your text is still here.');return}const entries=lines.map(line=>{const match=line.match(/^(\d+)\s*[x×]\s+(.+)$/i);return{id:uid(),crateId:crate.id,name:(match?match[2]:line).trim(),quantity:match?Number(match[1]):1,decision:'undecided' as const,destination:'',departed:false,notes:''}});if(entries.some(i=>i.name.length>160||!Number.isSafeInteger(i.quantity)||i.quantity<1||i.quantity>100000)){setAdded('Use shorter labels (160 characters maximum) and quantities from 1 to 100,000. Your text is still here.');return}if(entries.length&&onAdd(entries)){setText('');setAdded(`${entries.length} contents records added.`)}}}><label>Describe what you find<textarea aria-label="Describe crate contents" value={text} maxLength={12000} rows={4} onChange={e=>setText(e.target.value)} placeholder={'3x camping mugs\nTent repair kit\nBag of loose cables'} /></label><div><p>One item or related group per line. Use your phone keyboard’s dictation. Nothing is automatically marked for disposal.</p><button className="crate-primary" disabled={!text.trim()}>Add contents +</button></div>{added&&<p role="status">{added}</p>}</form>
}

function Repack({crate,items,onSave,onReopen}:{crate:Crate;items:ContentItem[];onSave:(fill:number)=>void;onReopen:()=>void}) {
  const [fill,setFill]=useState(crate.currentFill)
  const [checked,setChecked]=useState(false)
  const pending=items.filter(i=>i.decision==='undecided').length
  const outgoing=items.filter(i=>!['keep','undecided'].includes(i.decision)&&!i.departed).length
  return <div className="repack-panel"><span className="crate-eyebrow">CLOSE THE LOOP</span><h3>Repack what remains.</h3><p>Group related keepers, give each a destination, and label this crate. Keep unresolved items visible in your holding tote. Record every destination container’s new fill after consolidating.</p><div className="repack-counts"><span>{pending} undecided</span><span>{outgoing} outgoing batches still here</span></div>{outgoing>0&&<p className="crate-alert">Outgoing material still in the garage continues to occupy space. Keep it in this crate’s fill estimate until it leaves, or move its record to a registered staging container and update that container’s fill.</p>}<label className="repack-fill">Remaining occupied fill <strong>{fill}% · {liters(crate.capacityLiters*fill/100)}</strong><input aria-label="Remaining crate fill percentage" type="range" min="0" max="100" step="5" value={fill} onChange={e=>{setFill(Number(e.target.value));setChecked(false)}} /></label><div className="repack-comparison"><span>Starting estimate<strong>{liters(crate.capacityLiters*crate.baselineFill/100)}</strong></span><span>After repacking<strong>{liters(crate.capacityLiters*fill/100)}</strong></span></div><label className="repack-confirm"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} />I’ve checked this fill estimate, accounted for material moved elsewhere, and left the parking boundary clear.</label><button className="crate-primary" disabled={!checked} onClick={()=>{onSave(fill);setChecked(false)}}>Confirm repacking</button>{crate.status==='repacked'&&<button className="crate-secondary" onClick={onReopen}>Reopen this crate</button>}<p className="crate-fine">Progress is an estimate of registered occupied volume. Repacking is recorded by you; a photo alone does not measure capacity or prove removal.</p></div>
}
