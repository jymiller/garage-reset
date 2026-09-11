import { useEffect, useState } from 'react'
import type { PointerEvent } from 'react'
import type { SpatialItem } from '../crates/model'
import { normalizedRegionFromDrag } from './spatial'
import { photoLinks } from './photoLinks'
import { currentObjects } from './currentObjects'

type Region = SpatialItem['region']
export type RegionDraft = { photoId: string; region: Region }
type Point = { x: number; y: number }

export function PhotoIdentify({ photo, items, selectedParent, selectedItem, onSelectParent, onSelectItem, onRegion, compact = false }: {
  photo: { id: string; src: string; observed: string }; items: SpatialItem[];
  selectedParent: string | null; selectedItem: string | null;
  onSelectParent: (id: string) => void; onSelectItem: (id: string) => void;
  onRegion: (draft: RegionDraft) => void; compact?: boolean;
}) {
  const [drawing, setDrawing] = useState(false)
  const [start, setStart] = useState<Point | null>(null)
  const [end, setEnd] = useState<Point | null>(null)
  const [loadedPhoto, setLoadedPhoto] = useState<string | null>(null)
  const ready = loadedPhoto === photo.id
  const [message, setMessage] = useState('')
  useEffect(() => { setDrawing(false); setStart(null); setEnd(null); setMessage('') }, [photo.id])
  const references = photoLinks.filter(p => p.photoId === photo.id)
  const identified = items.filter(item => item.photoId === photo.id)
  const draft = start && end ? normalizedRegionFromDrag(start, end, { width: 1, height: 1 }) : null
  function point(event: PointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }
  }
  function finish(event: PointerEvent<SVGSVGElement>) {
    if (!drawing || !start) return
    const region = normalizedRegionFromDrag(start, point(event), { width: 1, height: 1 })
    setStart(null); setEnd(null)
    if (!region || region.w < .015 || region.h < .015) { setMessage('Drag a box around the item, from one corner to the opposite corner.'); return }
    setDrawing(false); setMessage('Area selected. Name the item and check its size below.')
    onRegion({ photoId: photo.id, region })
  }
  return <div className={`identify-photo ${compact ? 'compact' : ''}`}>
    <div className="identify-photo-toolbar"><span>{photo.id} · SEP 9</span><button disabled={!ready} aria-pressed={drawing} onClick={() => { setDrawing(!drawing); setStart(null); setEnd(null); setMessage('') }}>{drawing ? 'Cancel drawing' : selectedItem ? 'Redraw selected item' : '＋ Identify an item'}</button></div>
    <div className="identify-photo-image">
      <img key={photo.id} src={photo.src} alt={photo.observed} onLoad={() => setLoadedPhoto(photo.id)} onError={() => { setLoadedPhoto(null); setMessage('Photo could not load. Choose another photo or reload.'); }} draggable={false} />
      {ready && <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="group" aria-label={`Items in ${photo.id}`} className={drawing ? 'drawing' : ''}
        onPointerDown={event => { if (!drawing) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setStart(point(event)); setEnd(point(event)); }}
        onPointerMove={event => { if (drawing && start) setEnd(point(event)) }} onPointerUp={finish} onPointerCancel={() => { setStart(null); setEnd(null) }}>
        {!drawing && references.map(link => <g key={link.parentId} role="button" tabIndex={0} aria-label={`Locate ${currentObjects.find(o => o.id === link.parentId)?.label ?? link.parentId} in 3D`} onClick={() => onSelectParent(link.parentId)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectParent(link.parentId) } }} className="identify-region reference">
          <rect x={link.region.x * 100} y={link.region.y * 100} width={link.region.w * 100} height={link.region.h * 100} fill="transparent" stroke={selectedParent === link.parentId && !selectedItem ? '#dcefa4' : '#f5ffeb'} strokeOpacity={selectedParent === link.parentId && !selectedItem ? 1 : .45} strokeWidth={selectedParent === link.parentId && !selectedItem ? '.7' : '.3'} vectorEffect="non-scaling-stroke" />
        </g>)}
        {!drawing && identified.map(item => <g key={item.id} role="button" tabIndex={0} aria-label={`Locate ${item.name} in 3D`} onClick={() => onSelectItem(item.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectItem(item.id) } }} className="identify-region item">
          <rect x={item.region.x * 100} y={item.region.y * 100} width={item.region.w * 100} height={item.region.h * 100} fill="#e7c66e" fillOpacity={selectedItem === item.id ? .22 : .08} stroke="#ffe090" strokeWidth={selectedItem === item.id ? '2.5' : '1.5'} vectorEffect="non-scaling-stroke" />
          <title>{item.name} · {item.dimensionBasis === 'measured' ? 'Measured dimensions' : 'Estimated dimensions'}</title>
        </g>)}
        {draft && <rect x={draft.x * 100} y={draft.y * 100} width={draft.w * 100} height={draft.h * 100} fill="#ffe194" fillOpacity=".2" stroke="#ffe194" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      </svg>}
    </div>
    <p className="identify-photo-help" role="status">{message || (drawing ? 'Drag from one corner of the item to the opposite corner.' : 'Select an outlined area to locate it in 3D. Thin outlines are suggested reference areas.')}</p>
    {!drawing && identified.length > 0 && <div className="identify-photo-labels">{identified.map(item => <button key={item.id} aria-pressed={selectedItem === item.id} onClick={() => onSelectItem(item.id)}>{item.name}</button>)}</div>}
  </div>
}
