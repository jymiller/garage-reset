import { useState } from 'react'
import type { Crate, SpatialItem } from '../crates/model'
import type { LayoutObject } from './currentObjects'
import { boxVolumeLiters, createSpatialItem, validSpatialItem } from './spatial'
import { validFootprint } from './layoutDraft'
import type { RegionDraft } from './PhotoIdentify'

const inch = .0254
const inches = (m: number) => String(Math.round(m / inch * 1000) / 1000)
const metres = (value: string) => value.trim() ? Math.round(Number(value) * inch * 1e9) / 1e9 : NaN
const volumeLabel = (liters: number) => `${liters.toLocaleString('en-US', { maximumFractionDigits: 1 })} L`

export function SpatialInspector({ existing, draft, parent, parents, crates, items, onSave, onCancel, onOpenCrate }: {
  existing: SpatialItem | null; draft: RegionDraft | null; parent: LayoutObject; parents: LayoutObject[];
  crates: Crate[]; items: SpatialItem[]; onSave: (item: SpatialItem, expected: SpatialItem | null) => boolean; onCancel: () => void; onOpenCrate: (id: string) => void;
}) {
  const [initial] = useState(() => {
    if (existing) return existing
    const item = createSpatialItem({ id: crypto.randomUUID(), name: 'New item', parentId: parent.id, photoId: draft!.photoId, region: draft!.region })
    const w = Math.min(item.w, parent.w), d = Math.min(item.d, parent.d), h = Math.min(item.h, parent.h)
    return { ...item, w, d, h, x: parent.x + (parent.w - w) / 2, y: parent.y + (parent.d - d) / 2 }
  })
  const [name, setName] = useState(existing?.name ?? '')
  const [parentId, setParentId] = useState(initial.parentId)
  const [crateId, setCrateId] = useState(initial.crateId ?? '')
  const [size, setSize] = useState({ w: inches(initial.w), d: inches(initial.d), h: inches(initial.h) })
  const [position, setPosition] = useState({ x: inches(initial.x - parent.x), y: inches(initial.y - parent.y), z: inches(initial.z) })
  const [measured, setMeasured] = useState(initial.dimensionBasis === 'measured')
  const [notes, setNotes] = useState(initial.notes)
  const [error, setError] = useState('')
  const selectedParent = parents.find(p => p.id === parentId) ?? parent
  const outerLiters = boxVolumeLiters({ w: metres(size.w), d: metres(size.d), h: metres(size.h) })
  const linked = crates.find(crate => crate.id === crateId)
  const linkedElsewhere = new Set(items.filter(item => item.id !== existing?.id).map(item => item.crateId).filter(Boolean))

  function submit() {
    const region = draft?.region ?? initial.region
    const photoId = draft?.photoId ?? initial.photoId
    const item: SpatialItem = { ...initial, name: name.trim(), parentId, crateId: crateId || null, photoId, region,
      w: metres(size.w), d: metres(size.d), h: metres(size.h),
      x: Math.round((selectedParent.x + metres(position.x)) * 1e9) / 1e9,
      y: Math.round((selectedParent.y + metres(position.y)) * 1e9) / 1e9,
      z: metres(position.z), dimensionBasis: measured ? 'measured' : 'estimated', notes: notes.trim(),
    }
    if (!validSpatialItem(item) || !validFootprint(item)) {
      setError('Give the item a name and positive dimensions. Its box must stay inside the scanned floor, clear of walls, and below the 3.2 m ceiling.'); return
    }
    if (item.crateId && linkedElsewhere.has(item.crateId)) { setError('That crate already has a 3D marker. Select its existing marker instead.'); return }
    setError('')
    if (!onSave(item, existing ? initial : null)) setError('The item could not be saved. Your entries are still here; check the workspace message.')
  }

  return <section className="spatial-inspector" aria-label={existing ? 'Identified item details' : 'Identify a new item'}>
    <div className="spatial-form-heading"><span className="layout-eyebrow">{existing ? 'PHOTO ↔ 3D ↔ INVENTORY' : 'NAME IT. PLACE IT. MEASURE IT.'}</span><button onClick={onCancel}>{existing ? 'Back to area' : 'Cancel'}</button></div>
    <form onSubmit={event => { event.preventDefault(); submit() }}>
      <label>Item name<input aria-label="Identified item name" value={name} onChange={event => setName(event.target.value)} maxLength={160} required placeholder="e.g. Camping crate — tents" /></label>
      <label>Located in<select aria-label="Item area" value={parentId} onChange={event => { setParentId(event.target.value); setPosition({ x: '0', y: '0', z: '0' }); setMeasured(false) }}>{parents.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <div className="spatial-volume"><span>OUTER BOX VOLUME</span><strong>{measured ? '' : '≈ '}{volumeLabel(outerLiters)}</strong><small>{(outerLiters / 28.316846592).toFixed(2)} cu ft · {(outerLiters / 1000).toFixed(3)} m³</small><p>Length × depth × height, including empty space. This does not measure the material inside or count toward the 50% cleanup goal.</p></div>
      <div className="spatial-size-fields">{([['w', 'Length'], ['d', 'Depth'], ['h', 'Height']] as const).map(([key, label]) => <label key={key}>{label} (in)<input aria-label={`Item ${label.toLowerCase()} in inches`} type="number" step="any" min="0.3937" inputMode="decimal" value={size[key]} required onChange={event => { setSize(s => ({ ...s, [key]: event.target.value })); setMeasured(false) }} /></label>)}</div>
      <label className="spatial-confirm"><input type="checkbox" checked={measured} onChange={event => setMeasured(event.target.checked)} />I measured all three outside dimensions.</label>
      <p className="spatial-field-note">Initial sizes are placeholders. A photo box does not provide depth or scale.</p>
      <details className="spatial-position"><summary>Place the box in 3D</summary><p>Along starts at this area’s street-side edge. Across starts at its edge nearest the long rack wall and increases toward the opposite wall. The area’s position is still an estimate.</p><div className="spatial-size-fields">{([['x', 'Along area'], ['y', 'Across area'], ['z', 'Above floor']] as const).map(([key, label]) => <label key={key}>{label} (in)<input aria-label={`${label} in inches`} type="number" step="any" inputMode="decimal" value={position[key]} required onChange={event => setPosition(p => ({ ...p, [key]: event.target.value }))} /></label>)}</div></details>
      <label>Link a crate record<select aria-label="Linked crate record" value={crateId} onChange={event => setCrateId(event.target.value)}><option value="">No crate link</option>{crates.filter(crate => !linkedElsewhere.has(crate.id)).map(crate => <option key={crate.id} value={crate.id}>{crate.code} · {crate.name}</option>)}</select></label>
      {linked ? <div className="spatial-crate-link"><strong>{linked.code} · {linked.name}</strong><p>Crate lab contents estimate: {volumeLabel(linked.capacityLiters * (linked.status === 'repacked' ? linked.currentFill : linked.baselineFill) / 100)}.</p>{existing?.crateId === linked.id && <button type="button" onClick={() => onOpenCrate(linked.id)}>Open this crate’s inventory →</button>}</div> : <p className="spatial-field-note">Register crates in Crate lab, then connect them here. One crate gets one 3D marker.</p>}
      <label>Notes<textarea aria-label="Identified item notes" rows={2} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Visible label, contents, or what to measure next…" /></label>
      {error && <p className="layout-error" role="alert">{error}</p>}
      <button className="layout-primary" type="submit">{existing ? 'Save item changes' : 'Add item to 3D model'}</button>
    </form>
  </section>
}
