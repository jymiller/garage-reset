import { Component, lazy, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Tab } from '../App'
import { currentObjects } from '../garage/currentObjects'
import type { LayoutObject } from '../garage/currentObjects'
import { scanShell } from '../garage/scanGeometry'
import { readCorrections, LAYOUT_CORRECTIONS_KEY } from '../garage/corrections'
import { validGeometry, footprintOverlaps } from '../garage/layoutDraft'
import type { Geometry, Correction, Corrections } from '../garage/layoutDraft'
import { useWorkspace } from '../crates/useWorkspace'
import type { SpatialItem } from '../crates/model'
import { PhotoIdentify } from '../garage/PhotoIdentify'
import type { RegionDraft } from '../garage/PhotoIdentify'
import { SpatialInspector } from '../garage/SpatialInspector'
import { boxVolumeLiters } from '../garage/spatial'
import '../garage/identify.css'
import { photoSurvey, latestPhotoSurvey } from '../pickup/surveyData'
import '../garage/layout.css'

const CurrentScene = lazy(() => import('../garage/CurrentScene').then(m => ({ default: m.CurrentScene })))
const photos = [...latestPhotoSurvey, ...photoSurvey]
type View = '3d' | 'map' | 'photo'
const observedDate = (value: string) => new Date(value).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const fmt = (m: number) => `${m.toFixed(2)} m / ${(m * 3.28084).toFixed(1)} ft`


export function Garage({ onNavigate, onOpenCrate }: { onNavigate: (tab: Tab) => void; onOpenCrate: (id: string) => void }) {
  const workspace = useWorkspace()
  const [selectedSpatialId, setSelectedSpatialId] = useState<string | null>(null)
  const [regionDraft, setRegionDraft] = useState<RegionDraft | null>(null)
  const [itemMessage, setItemMessage] = useState('')
  const [editorEpoch, setEditorEpoch] = useState(0)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [backedUp, setBackedUp] = useState(false)
  const spatialItems = workspace.data.spatialItems ?? []
  const spatialItem = spatialItems.find(item => item.id === selectedSpatialId) ?? null
  const catalog = spatialItems.filter(item => `${item.name} ${item.notes} ${item.parentId} ${workspace.data.crates.find(c => c.id === item.crateId)?.code ?? ''}`.toLowerCase().includes(catalogSearch.toLowerCase()))
  const [view, setView] = useState<View>('3d')
  const [scope, setScope] = useState<'rear' | 'all'>('rear')
  const [selected, setSelected] = useState<string | null>(() => currentObjects.find(o => o.kind === 'rack')?.id ?? null)
  const [showObjects, setShowObjects] = useState(true)
  const [showParking, setShowParking] = useState(true)
  const [corrections, setCorrections] = useState<Corrections>(readCorrections)
  const [saveMessage, setSaveMessage] = useState('')
  const [captureOpen, setCaptureOpen] = useState(false)
  const [photoId, setPhotoId] = useState<string | null>(null)
  const objects = currentObjects.map(o => ({ ...o, ...corrections[o.id] }))
  const object = objects.find(o => o.id === selected) ?? null
  const overlaps = object ? footprintOverlaps(object, objects, object.id) : []
  const related = spatialItem ? photos.filter(p => p.id === spatialItem.photoId) : object ? photos.filter(p => object.photoIds.includes(p.id)) : photos
  const photo = related.find(p => p.id === photoId) ?? related[0] ?? photos[0]
  useEffect(() => { setSaveMessage('') }, [selected])

  function selectParent(id: string | null, fromPhoto = false) { setSelected(id); setSelectedSpatialId(null); setRegionDraft(null); setItemMessage(''); if (fromPhoto) setView('3d') }
  function selectSpatial(id: string) {
    const item = spatialItems.find(i => i.id === id); if (!item) return
    setSelected(item.parentId); setSelectedSpatialId(id); setPhotoId(item.photoId); setRegionDraft(null); setEditorEpoch(n => n + 1); setItemMessage(''); setView('3d')
  }
  function saveSpatial(item: SpatialItem, expected: SpatialItem | null) {
    let conflict = false
    const accepted = workspace.update(data => {
      const current = (data.spatialItems ?? []).find(i => i.id === item.id)
      if (expected ? !current || JSON.stringify(current) !== JSON.stringify(expected) : !!current) { conflict = true; return data }
      return { ...data, spatialItems: current ? data.spatialItems!.map(i => i.id === item.id ? item : i) : [...(data.spatialItems ?? []), item] }
    })
    if (conflict) { setItemMessage('This item changed while you were editing. Your entries are preserved; select the item again to load its latest record.'); return false }
    if (!accepted) return false
    setSelected(item.parentId); setSelectedSpatialId(item.id); setPhotoId(item.photoId); setRegionDraft(null); setEditorEpoch(n => n + 1); setView('3d'); setItemMessage('Item added to the model draft. Check the shared-workspace status for sync.'); return true
  }
  function startRegion(draft: RegionDraft) {
    setRegionDraft(draft); setItemMessage('');
    if (!object) setSelected(currentObjects.find(o => o.kind === 'rack')!.id)
    if (window.matchMedia('(max-width:760px)').matches) setTimeout(() => document.querySelector('.spatial-inspector')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function save(id: string, correction: Correction | null) {
    if (correction && !validGeometry(correction)) return false
    const next = { ...corrections }
    if (correction) next[id] = correction
    else delete next[id]
    try {
      localStorage.setItem(LAYOUT_CORRECTIONS_KEY, JSON.stringify(next))
      setCorrections(next)
      setSaveMessage(correction ? 'Correction saved in this browser.' : 'Photo-based estimate restored for this object.')
      return true
    } catch { setSaveMessage('Could not save. Browser storage is unavailable; keep your measurements elsewhere.'); return false }
  }
  function exportDraft() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), scanDate: scanShell.date, coordinateSystem: 'metres; x from street end, y from rack wall', corrections }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'garage-layout-corrections.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="layout-app">
    <header className="layout-topbar">
      <button className="layout-brand" onClick={() => onNavigate('home')}><span>G↗</span> GARAGE RESET</button>
      <nav aria-label="Workspace">
        <button onClick={() => onNavigate('pickup')}>Pickup</button><button className="active" aria-current="page">Garage model</button><button onClick={() => onNavigate('crates')}>Crate lab</button><button onClick={() => onNavigate('play')}>Play</button>
      </nav>
      <span className="layout-local">{workspace.status === 'shared' ? 'Shared item catalog' : workspace.status === 'saving' ? 'Saving item catalog…' : 'Item catalog · ' + workspace.status}</span>
    </header>
    <main className="layout-main">
      <section className="layout-heading">
        <div><span className="layout-eyebrow">THE SPACE WE’RE TAKING BACK</span><h1>Your garage,<br /><em>closer to reality.</em></h1><p>Select it in a photo. Find it in 3D. Know what it is and how much space its box takes.</p></div>
        <div className="layout-next"><span className="layout-eyebrow">NEXT UPGRADE</span><h2>A fresh scan + a few measurements.</h2><p>Keep the two car spaces, map each shelf, and make every crate findable.</p><button onClick={() => { setCaptureOpen(true); setTimeout(() => document.getElementById('layout-capture')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }}>See the capture checklist ↗</button></div>
      </section>
      <div className="layout-sources">
        <div><span className="layout-dot scan" /><b>Walls & openings</b><span>Polycam · Jun 25, 2026</span></div>
        <div><span className="layout-dot photo" /><b>Objects & conditions</b><span>17 photos · Sep 9, 2026</span></div>
        <div><span className="layout-dot draft" /><b>Positions & sizes</b><span>Photo-based estimates · editable</span></div>
      </div>
      {(workspace.error || workspace.storageError) && <div className="identify-workspace-alert" role="alert">{workspace.error || 'This browser could not store a backup. Export your draft before closing.'}<button onClick={() => workspace.downloadDraft()}>Export item backup</button></div>}
      {workspace.conflict && <div className="identify-workspace-alert"><b>Another device saved first.</b><p>Your draft is preserved. Export it before loading the shared version.</p><button onClick={() => { workspace.downloadDraft(); setBackedUp(true) }}>Export my item draft</button><button disabled={!backedUp} onClick={() => { workspace.useSharedVersion(); setBackedUp(false); setRegionDraft(null); setSelectedSpatialId(null) }}>Load shared version</button></div>}
      <section className="identify-catalog" aria-label="Identified item catalog">
        <div className="identify-catalog-heading"><div><span className="layout-eyebrow">YOUR PHOTO + 3D CATALOG</span><h2>{spatialItems.length} identified {spatialItems.length === 1 ? 'item' : 'items'} <small>{spatialItems.filter(i => i.dimensionBasis === 'measured').length} with measured dimensions</small></h2></div><button onClick={() => { setSelectedSpatialId(null); setRegionDraft(null); setView('photo'); setItemMessage('Select Identify an item on the photo, then drag a box around it.') }}>Identify another item ↗</button></div>
        {spatialItems.length ? <><input aria-label="Search identified items" placeholder="Find an item, note, or crate code…" value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} /><div className="identify-catalog-items">{catalog.map(item => <button key={item.id} aria-pressed={selectedSpatialId === item.id} onClick={() => selectSpatial(item.id)}><strong>{item.name}</strong><span>{item.dimensionBasis === 'measured' ? '' : '≈ '}{boxVolumeLiters(item).toLocaleString('en-US', { maximumFractionDigits: 1 })} L outer box · {item.dimensionBasis === 'measured' ? 'measured dimensions' : 'estimated dimensions'}</span></button>)}</div>{!catalog.length && <p>No identified items match this search.</p>}</> : <p>The 26 reference areas are starting points. Draw around an individual crate or item to give it a name, a 3D box, and an optional crate-inventory link.</p>}
      </section>
      <section className="layout-workbench" aria-label="Garage planning workbench">
        <div className="layout-visual">
          <div className="layout-toolbar"><div><span className="layout-eyebrow">SPATIAL WORKSPACE</span><h2>{view === 'photo' ? 'The evidence' : scope === 'rear' ? 'The back section' : 'The whole garage'}</h2></div><div className="layout-segment" aria-label="View mode">{(['3d', 'map', 'photo'] as View[]).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v === '3d' ? '3D' : v === 'map' ? 'Floor plan' : 'Photo'}</button>)}</div></div>
          <div className="layout-view-tools"><div className="layout-segment" aria-label="Model scope"><button aria-pressed={scope === 'rear'} onClick={() => setScope('rear')}>Back section</button><button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Whole garage</button></div><div className="layout-layer-tools"><label><input type="checkbox" checked={showObjects} onChange={e => setShowObjects(e.target.checked)} /> Objects</label><label><input type="checkbox" checked={showParking} onChange={e => setShowParking(e.target.checked)} /> Parking reminder</label></div></div>
          <div className="layout-viewport">
            {view === '3d' && <SceneBoundary onFallback={() => setView('map')}><Suspense fallback={<div className="layout-loading">Building your garage view…</div>}><CurrentScene objects={objects} selected={selectedSpatialId ? null : selected} onSelect={selectParent} spatialItems={spatialItems} selectedSpatialId={selectedSpatialId} onSelectSpatial={selectSpatial} scope={scope} showObjects={showObjects} showParking={showParking} /></Suspense></SceneBoundary>}
            {view === 'map' && <FloorPlan objects={objects} selected={selected} onSelect={selectParent} scope={scope} showObjects={showObjects} showParking={showParking} />}
            {view === 'photo' && <div className="layout-large-photo"><PhotoIdentify photo={photo} items={spatialItems} selectedParent={selected} selectedItem={selectedSpatialId} onSelectParent={id => selectParent(id, true)} onSelectItem={selectSpatial} onRegion={startRegion} /></div>}
          </div>
          <div className="layout-view-note"><span>{view === '3d' ? 'Drag to orbit · scroll to zoom · select an object' : view === 'map' ? 'Select a footprint to see its source photo' : photo.title}</span><span>{view === 'photo' ? 'Source photo' : scope === 'all' ? 'Front contents not surveyed · schematic objects' : 'Schematic objects · container counts illustrative'}</span></div>
          <div className="layout-parking-note"><b>Two cars stay.</b> You confirmed the white line marks parking clearance. The tinted area is a reminder; its location is provisional. Car positions, door swings and the route out still need measuring.</div>
          <label className="layout-mobile-select">Inspect an object<select aria-label="Inspect an object" value={selected ?? ''} onChange={e => selectParent(e.target.value || null)}><option value="">Choose part of the garage</option>{objects.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <div className="layout-object-list" aria-label="Garage objects">{objects.map(o => <button key={o.id} aria-pressed={selected === o.id} onClick={() => selectParent(o.id)}><i style={{ background: o.color }} />{o.label}</button>)}</div>
        </div>
        <aside className="layout-inspector">
          <p className="identify-item-message" role="status">{itemMessage}</p>
          {object ? <>
            <div className="layout-inspector-title"><span className="layout-eyebrow">{spatialItem ? 'SELECTED ITEM' : 'REFERENCE AREA'}</span><h2>{spatialItem?.name ?? object.label}</h2><div className="layout-badge">{spatialItem ? (spatialItem.dimensionBasis === 'measured' ? 'Measured dimensions · estimated position' : 'Estimated dimensions and position') : corrections[object.id] ? 'Locally corrected footprint' : object.confidence === 'reference' ? 'Earlier photo reference' : 'Seen in photos · estimated footprint'}</div></div>
            {view !== 'photo' && <PhotoIdentify compact photo={photo} items={spatialItems} selectedParent={selected} selectedItem={selectedSpatialId} onSelectParent={id => selectParent(id, true)} onSelectItem={selectSpatial} onRegion={startRegion} />}
            <button className="identify-enlarge" onClick={() => setView(view === 'photo' ? '3d' : 'photo')}>{view === 'photo' ? 'Show linked 3D view' : 'Open larger photo'} ↗</button>
            {related.length > 1 && <div className="layout-photo-strip" aria-label="Source photos">{related.map(p => <button key={p.id} aria-label={`Show ${p.id}`} aria-pressed={p.id === photo.id} onClick={() => setPhotoId(p.id)}><img src={p.src} alt="" /></button>)}</div>}
            {(regionDraft || spatialItem) && <SpatialInspector key={`${spatialItem?.id ?? 'new'}:${JSON.stringify(regionDraft)}:${editorEpoch}`} existing={spatialItem} draft={regionDraft} parent={object} parents={objects} crates={workspace.data.crates} items={spatialItems} onSave={saveSpatial} onCancel={() => { setRegionDraft(null); setSelectedSpatialId(null); setItemMessage('') }} onOpenCrate={onOpenCrate} />}
            {!regionDraft && !spatialItem && <><div className="layout-observation"><span className="layout-eyebrow">WHAT THE PHOTOS SHOW</span><p>{object.observed}</p><small>Last observed: {observedDate(object.lastSeen)}</small></div>
            <div className="layout-action"><span className="layout-eyebrow">NEXT SMALL MOVE</span><p>{object.nextStep}</p><button onClick={() => onNavigate(object.kind === 'rack' ? 'crates' : 'play')}>{object.kind === 'rack' ? 'Open Crate lab' : 'Start a photo mission'} →</button></div>
            {overlaps.length > 0 && <div className="layout-overlap" role="status"><b>Footprints overlap in this draft</b><p>{overlaps.join('; ')}. Recheck these estimates before planning a move.</p></div>}
            <details className="layout-correction" key={object.id}><summary>Correct this footprint <span>↗</span></summary><GeometryEditor key={`${object.id}-${JSON.stringify(corrections[object.id])}`} object={object} note={corrections[object.id]?.note ?? ''} onSave={c => save(object.id, c)} />{corrections[object.id] && <button className="layout-text-button" onClick={() => save(object.id, null)}>Restore this object’s estimate</button>}</details>
            <p className="layout-save-message" role="status">{saveMessage}</p></>}
          </> : <div className="layout-empty"><h2>Pick a part of the garage.</h2><p>Select any object in the model or the list to see its source photos and update its footprint.</p></div>}
          <div className="layout-local-note">Area-footprint corrections stay in this browser. Identified items sync through the shared workspace; neither changes the 50% volume goal.<button onClick={exportDraft}>Export layout corrections ↓</button></div>
        </aside>
      </section>
      <section className="layout-roadmap" aria-label="Make the model more useful">
        <article><span>01 / RECREATE</span><h3>A scan you can walk around.</h3><p>A fresh textured scan will capture the actual surfaces and clutter. Keep the measured floor plan underneath it for planning.</p></article>
        <article><span>02 / LOCATE</span><h3>A home for every crate.</h3><p>Give each rack, shelf and crate a stable label. Record what’s inside in Crate lab, then return it to that location.</p><button onClick={() => onNavigate('crates')}>Open Crate lab →</button></article>
        <article><span>03 / RECLAIM</span><h3>Free half the storage volume.</h3><p>Sort and repack one container at a time. Confirm its new fill in Crate lab; eventually consolidate enough to empty a shelf.</p><button onClick={() => onNavigate('play')}>Play a cleanup round →</button></article>
      </section>
      <section className="layout-capture" id="layout-capture">
        <button className="layout-capture-heading" aria-expanded={captureOpen} aria-controls="layout-capture-content" onClick={() => setCaptureOpen(!captureOpen)}><div><span className="layout-eyebrow">MAKE THE NEXT MODEL ACCURATE</span><h2>Your next garage capture.</h2></div><span>{captureOpen ? '−' : '+'}</span></button>
        {captureOpen && <div id="layout-capture-content" className="layout-capture-content"><p>A useful capture needs three things: current geometry, clear reference photos, and a few measured anchors.</p><div className="layout-capture-grid">
          <div><b>1. Capture the shell</b><p>In Polycam, use Space Mode. If your phone has LiDAR, include the floor plan. Move slowly with the lights on; capture wall–floor edges, corners, door openings and the ceiling. Keep doors fixed during the pass.</p></div>
          <div><b>2. Measure the constraints</b><p>Record rear wall width, each rack’s length × depth × height, rack-front to white-line distance at both ends and any bend, and door openings. With both cars parked normally, measure their outlines, door space and the narrowest route out.</p></div>
          <div><b>3. Photograph each rack</b><p>One straight-on photo per rack, then one per shelf. Use temporary labels such as R1–S2–C03. Open just one crate, photograph its contents, and describe them in Crate lab before repacking.</p></div>
          <div><b>4. Keep the export together</b><p>Export a textured GLB if offered, or the complete glTF package with its textures and binary file. Include the floor plan and measurements. This view currently uses the June floor plan; a fresh scan has not been imported yet.</p></div>
        </div><div className="layout-capture-links"><a href="https://learn.poly.cam/hc/en-us/articles/36655587097620-How-to-Use-Space-Mode-with-LiDAR-enabled-devices" target="_blank" rel="noreferrer">Polycam capture guide ↗</a><a href="https://learn.poly.cam/hc/en-us/articles/27756102599572-What-File-Types-Can-Polycam-Export" target="_blank" rel="noreferrer">Export formats ↗</a><a href="/evidence/polycam-june-25.png" target="_blank" rel="noreferrer">Original June floor plan ↗</a></div></div>}
      </section>
      <footer className="layout-footer"><span>June scan estimates: {fmt(scanShell.interiorBounds.length)} inside length × {fmt(scanShell.interiorBounds.width)} maximum inside width. Irregular outline, not a rectangle.</span><span>Object placement is approximate. No parking or pickup fit is certified by this model.</span></footer>
    </main>
  </div>
}

function GeometryEditor({ object, note, onSave }: { object: LayoutObject; note: string; onSave: (c: Correction) => boolean }) {
  const [units, setUnits] = useState<'m' | 'ft'>('m')
  const [values, setValues] = useState<Record<keyof Geometry, string>>(() => ({ x: String(object.x), y: String(object.y), w: String(object.w), d: String(object.d), h: String(object.h) }))
  const [notes, setNotes] = useState(note)
  const [error, setError] = useState('')
  function changeUnits(next: 'm' | 'ft') {
    if (units === next) return
    setValues(v => Object.fromEntries(Object.entries(v).map(([k, n]) => [k, n.trim() && Number.isFinite(Number(n)) ? (Number(n) * (next === 'ft' ? 1 / .3048 : .3048)).toPrecision(14) : n])) as typeof v)
    setUnits(next)
  }
  return <form onSubmit={e => { e.preventDefault(); const parsed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim() ? Math.round(Number(v) * (units === 'ft' ? .3048 : 1) * 1e9) / 1e9 : NaN])) as Geometry; const c = { ...parsed, note: notes.trim() }; if (!validGeometry(c)) { setError('Enter positive sizes that stay inside the stepped floor and clear of walls. Height cannot exceed the scan’s 3.2 m ceiling.'); return }; setError(''); onSave(c) }}>
    <p>Offsets start at the street end (X) and the long rack wall (Y). Sizes and positions are estimates until you check them on site. The wall outline stays tied to the scan.</p>
    <div className="layout-segment" aria-label="Measurement units"><button type="button" aria-pressed={units === 'm'} onClick={() => changeUnits('m')}>Metres</button><button type="button" aria-pressed={units === 'ft'} onClick={() => changeUnits('ft')}>Feet</button></div>
    <div className="layout-geometry-fields">{([['w', 'Length along garage'], ['d', 'Depth from rack wall'], ['h', 'Height'], ['x', 'X offset'], ['y', 'Y offset']] as [keyof Geometry, string][]).map(([key, label]) => <label key={key}>{label} ({units})<input type="number" step="any" inputMode="decimal" required min={key === 'x' || key === 'y' ? '0' : '.01'} value={values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} /></label>)}</div>
    <label>Measurement note<textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} rows={2} placeholder="e.g. Rack measured with a tape, September 10" /></label>
    <p className="layout-field-help">The footprint must stay inside the scanned floor and clear of walls. Overlapping object estimates are flagged after saving.</p>
    {error && <p role="alert" className="layout-error">{error}</p>}<button className="layout-primary" type="submit">Save footprint correction</button>
  </form>
}

function FloorPlan({ objects, selected, onSelect, scope, showObjects, showParking }: { objects: LayoutObject[]; selected: string | null; onSelect: (id: string | null) => void; scope: 'rear' | 'all'; showObjects: boolean; showParking: boolean }) {
  const minX = scope === 'rear' ? 10.5 : -.8
  const width = scope === 'rear' ? scanShell.totalLength - 9.7 : scanShell.totalLength + 1.6
  return <svg viewBox={`${minX} -1 ${width} ${scanShell.width + 2}`} role="group" aria-label="June Polycam floor plan with September photo-based objects" className="layout-plan">
    <defs><pattern id="layout-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#cccfc7" strokeWidth=".015" /></pattern><pattern id="parking-hatch" width=".3" height=".3" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line y2=".3" stroke="#819a89" strokeWidth=".035" /></pattern></defs>
    <polygon points={scanShell.outline.map(p => p.join(',')).join(' ')} fill="#e5e7df" /><polygon points={scanShell.outline.map(p => p.join(',')).join(' ')} fill="url(#layout-grid)" />
    {showParking && <g><rect x={16} y={2.05} width={8} height={3.8} rx=".12" fill="url(#parking-hatch)" opacity=".6" stroke="#708d7e" strokeWidth=".025" strokeDasharray=".15 .12" /><text x={20} y={4.6} textAnchor="middle" fontSize=".19" fill="#526e5f">PARKING · POSITION TO CONFIRM</text></g>}
    {scanShell.walls.map((wall, i) => <line key={i} x1={wall.a[0]} y1={wall.a[1]} x2={wall.b[0]} y2={wall.b[1]} stroke="#5f6a64" strokeWidth=".10" strokeLinecap="square" />)}
    <text x={20} y={-.45} textAnchor="middle" fontSize=".22" fill="#465d50">RACK WALL</text><text x={scanShell.totalLength + .2} y={3.6} transform={`rotate(90 ${scanShell.totalLength + .2} 3.6)`} textAnchor="middle" fontSize=".20" fill="#465d50">BACK · YARD DOOR</text>
    {scope === 'all' && <text x={-.4} y={2.6} transform="rotate(-90 -.4 2.6)" textAnchor="middle" fontSize=".22" fill="#465d50">STREET / VEHICLE ENTRANCE</text>}
    {showObjects && objects.map((o, i) => <g key={o.id} role="button" tabIndex={0} aria-label={`Select ${o.label}`} aria-pressed={selected === o.id} onClick={() => onSelect(o.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(o.id) } }} className="layout-plan-object"><title>{o.label} · estimated footprint</title><rect x={o.x} y={o.y} width={o.w} height={o.d} fill={o.color} fillOpacity={selected && selected !== o.id ? .35 : .85} rx=".07" stroke={selected === o.id ? '#1b4a35' : '#53665c'} strokeWidth={selected === o.id ? '.07' : '.025'} /><text x={o.x + o.w / 2} y={o.y + o.d / 2 + .065} fontSize=".18" textAnchor="middle" fill={o.kind === 'rack' || o.kind === 'vehicle' || o.kind === 'cabinet' ? '#fff' : '#16382a'} pointerEvents="none">{i + 1}</text></g>)}
    <line x1={minX + .4} y1={scanShell.width + .4} x2={minX + 1.4} y2={scanShell.width + .4} stroke="#506b5b" strokeWidth=".045" /><text x={minX + .9} y={scanShell.width + .72} textAnchor="middle" fontSize=".18" fill="#506b5b">1 metre</text>
  </svg>
}

class SceneBoundary extends Component<{ children: ReactNode; onFallback: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="layout-loading"><p>3D couldn’t start in this browser.</p><button onClick={this.props.onFallback}>Open the floor plan</button></div> : this.props.children }
}
