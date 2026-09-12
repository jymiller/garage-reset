import { Component, lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Crate, SpatialItem } from '../crates/model'
import type { LayoutObject } from '../garage/currentObjects'
import type { CurrentSceneCameraCommand } from '../garage/CurrentScene'
import { GarageIcon } from '../components/GarageIcons'
import { latestPhotoSurvey, photoSurvey } from '../pickup/surveyData'
import { missionAreaForObject } from './missionArea'
import type { MissionAreaSuggestion } from './missionArea'
import './mission-world.css'

const CurrentScene = lazy(() => import('../garage/CurrentScene').then(module => ({ default: module.CurrentScene })))
const referencePhotos = [...latestPhotoSurvey, ...photoSurvey]
type ReferencePhoto = typeof referencePhotos[number]
type CameraAction = CurrentSceneCameraCommand['kind']

interface MissionWorldPickerProps {
  objects: LayoutObject[]
  spatialItems: SpatialItem[]
  crates: Crate[]
  onUseArea: (area: MissionAreaSuggestion) => void
  onOpenGarage: () => void
}

class WorldBoundary extends Component<{ children: ReactNode; onPhoto: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return (
      <div className="mission-world-fallback" role="status">
        <GarageIcon name="garage" />
        <strong>3D couldn’t start here.</strong>
        <p>You can still choose an area from the list and check its reference photo.</p>
        <button type="button" className="mission-world-button" onClick={this.props.onPhoto}>View reference photo</button>
      </div>
    )
    return this.props.children
  }
}

function CameraIcon({ kind }: { kind: CameraAction }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'left' && <><path d="M8 5 4 9l4 4M4 9h9a6 6 0 0 1 0 12" /><path d="M13 3a9 9 0 0 1 8 9" opacity=".4" /></>}
    {kind === 'right' && <><path d="m16 5 4 4-4 4m4-4h-9a6 6 0 0 0 0 12" /><path d="M11 3a9 9 0 0 0-8 9" opacity=".4" /></>}
    {(kind === 'zoom-in' || kind === 'zoom-out') && <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M7.5 10.5h6" />{kind === 'zoom-in' && <path d="M10.5 7.5v6" />}</>}
    {kind === 'reset' && <><path d="M4 10a8 8 0 1 1 1.5 7M4 4v6h6" /><path d="m9 13 3-3 3 3v4H9Z" /></>}
  </svg>
}

function PhotoView({ photo }: { photo: ReferencePhoto | undefined }) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  if (!photo || failedSource === photo.src) return <div className="mission-world-fallback" role="status">
    <GarageIcon name="missions" />
    <strong>{photo ? 'This reference photo couldn’t load.' : 'No matching reference photo.'}</strong>
    <p>{photo ? 'The area list is still available below.' : 'Choose another area or open the full garage to check its records.'}</p>
  </div>
  return <figure className="mission-world-photo">
    <img key={photo.src} src={photo.src} alt={photo.observed} onError={() => setFailedSource(photo.src)} />
    <figcaption><span>Reference photo · September 9</span><strong>{photo.title}</strong></figcaption>
  </figure>
}

const cameraButtons: { kind: CameraAction; text: string; label: string }[] = [
  { kind: 'left', text: 'Left', label: 'Rotate garage left' },
  { kind: 'right', text: 'Right', label: 'Rotate garage right' },
  { kind: 'zoom-in', text: 'Zoom in', label: 'Zoom in on garage' },
  { kind: 'zoom-out', text: 'Zoom out', label: 'Zoom out from garage' },
  { kind: 'reset', text: 'Reset', label: 'Reset garage camera' },
]

export function MissionWorldPicker({ objects, spatialItems, crates, onUseArea, onOpenGarage }: MissionWorldPickerProps) {
  const [view, setView] = useState<'3d' | 'photo'>('3d')
  const [scope, setScope] = useState<'rear' | 'all'>('rear')
  const [selection, setSelection] = useState('')
  const [photoId, setPhotoId] = useState<string | null>(null)
  const [cameraCommand, setCameraCommand] = useState<CurrentSceneCameraCommand>()
  const commandSequence = useRef(0)
  const [touchDevice, setTouchDevice] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse), (max-width: 760px)').matches)
  const [touchRotation, setTouchRotation] = useState(false)
  const id = useId()
  const instructionsId = `${id}-instructions`
  const modelNoteId = `${id}-model-note`

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse), (max-width: 760px)')
    const update = () => { setTouchDevice(media.matches); setTouchRotation(false) }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const selectedItem = selection.startsWith('item:') ? spatialItems.find(item => item.id === selection.slice(5)) : undefined
  const selectedObject = objects.find(object => object.id === (selectedItem?.parentId ?? (selection.startsWith('object:') ? selection.slice(7) : null)))
  const validSelection = selectedObject ? (selectedItem ? `item:${selectedItem.id}` : `object:${selectedObject.id}`) : ''
  const suggestion = missionAreaForObject(selectedObject, selectedItem, crates)
  const selectedName = selectedItem?.name ?? selectedObject?.label
  const usableItems = spatialItems.filter(item => objects.some(object => object.id === item.parentId))

  const photos = useMemo(() => {
    const sourceIds = selectedObject
      ? [...(selectedItem ? [selectedItem.photoId] : []), ...selectedObject.photoIds]
      : ['IMG_1930']
    return [...new Set(sourceIds)].flatMap(sourceId => {
      const photo = referencePhotos.find(candidate => candidate.id === sourceId)
      return photo ? [photo] : []
    })
  }, [selectedObject, selectedItem])
  const photo = photos.find(candidate => candidate.id === photoId) ?? photos[0]

  function choose(value: string) {
    setSelection(value)
    setPhotoId(null)
  }
  function changeView(next: '3d' | 'photo') {
    if (next === view) return
    setView(next)
    setCameraCommand(undefined)
    setTouchRotation(false)
  }
  function moveCamera(kind: CameraAction) {
    commandSequence.current += 1
    setCameraCommand({ kind, seq: commandSequence.current })
  }
  const controlsNote = touchDevice
    ? touchRotation ? 'One finger rotates. Pinch to zoom. Tap Done rotating to scroll the page again.' : 'Swipe to scroll the page. Use the camera buttons, or enable touch rotation.'
    : 'Drag to rotate. Scroll to zoom. Click an object, or choose one from the list.'
  const optionLabel = (object: LayoutObject, item?: SpatialItem) => `${item?.name ?? object.label}${missionAreaForObject(object, item, crates) ? '' : ' (reference only)'}`

  return <section className="mission-world" aria-label="Choose a mission area from the garage">
    <div className="mission-world-heading">
      <GarageIcon name="garage" />
      <div><h2>Find your next small win</h2><p>Explore, choose an area, then make a mission.</p></div>
    </div>
    <div className="mission-world-toolbar">
      <div className="mission-world-segment" role="group" aria-label="Garage view">
        <button type="button" aria-pressed={view === '3d'} onClick={() => changeView('3d')}>3D garage</button>
        <button type="button" aria-pressed={view === 'photo'} onClick={() => changeView('photo')}>Reference photo</button>
      </div>
      {view === '3d' && <div className="mission-world-segment mission-world-scope" role="group" aria-label="Garage camera scope">
        <button type="button" aria-pressed={scope === 'rear'} onClick={() => setScope('rear')}>Rear</button>
        <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Whole garage</button>
      </div>}
    </div>
    <div className="mission-world-viewport" role="group" aria-label={view === '3d' ? 'Interactive garage model' : 'Garage reference photo'} aria-describedby={`${instructionsId} ${modelNoteId}`}>
      {view === '3d' ? <>
        <div className={`mission-world-canvas${touchDevice && !touchRotation ? ' is-touch-locked' : ''}`} style={{ touchAction: touchDevice && !touchRotation ? 'pan-y' : 'none' }}>
          <WorldBoundary onPhoto={() => changeView('photo')}>
            <Suspense fallback={<div className="mission-world-fallback" role="status"><GarageIcon name="garage" /><strong>Opening the garage…</strong><p>You can choose an area from the list below.</p></div>}>
              <CurrentScene
                objects={objects} selected={selectedObject?.id ?? null}
                onSelect={objectId => choose(objectId ? `object:${objectId}` : '')}
                scope={scope} showObjects showParking={false}
                spatialItems={spatialItems} selectedSpatialId={selectedItem?.id ?? null}
                onSelectSpatial={itemId => choose(`item:${itemId}`)}
                cameraCommand={cameraCommand} showHint={false}
              />
            </Suspense>
          </WorldBoundary>
        </div>
        {touchDevice && !touchRotation && <div className="mission-world-touch-cover" aria-hidden="true"><span>Use the camera buttons below</span></div>}
      </> : <PhotoView photo={photo} />}
    </div>
    {view === '3d' ? <>
      <div className="mission-world-camera" role="group" aria-label="Move the garage camera">
        {cameraButtons.map(button => <button type="button" key={button.kind} aria-label={button.label} onClick={() => moveCamera(button.kind)}><CameraIcon kind={button.kind} /><span>{button.text}</span></button>)}
      </div>
      {touchDevice && <button type="button" className={`mission-world-button mission-world-touch-button${touchRotation ? ' is-active' : ''}`} aria-pressed={touchRotation} onClick={() => setTouchRotation(enabled => !enabled)}>{touchRotation ? 'Done rotating' : 'Enable touch rotation'}</button>}
      <p className="mission-world-help" id={instructionsId}>{controlsNote}</p>
    </> : <>
      {photos.length > 1 && <label className="mission-world-photo-choice"><span>Reference photo</span><select value={photo?.id ?? ''} onChange={event => setPhotoId(event.target.value)}>{photos.map(source => <option key={source.id} value={source.id}>{source.id.replace('IMG_', 'Photo ')} · {source.title}</option>)}</select></label>}
      <p className="mission-world-help" id={instructionsId}>This is a reference photo. Switch to 3D garage to rotate the model.</p>
    </>}
    <p className="mission-world-model-note" id={modelNoteId}>June scan · Sep 9 object references · positions estimated. Tote shapes are illustrative; named identified items link to saved records.</p>
    <label className="mission-world-area-choice" htmlFor={`${id}-area`}><span>Choose an area or identified item</span>
      <select id={`${id}-area`} value={validSelection} onChange={event => choose(event.target.value)}>
        <option value="">Choose from the garage…</option>
        <optgroup label="Garage areas">{objects.map(object => <option key={object.id} value={`object:${object.id}`}>{optionLabel(object)}</option>)}</optgroup>
        {usableItems.length > 0 && <optgroup label="Identified items">{usableItems.map(item => {
          const parent = objects.find(object => object.id === item.parentId)!
          return <option key={item.id} value={`item:${item.id}`}>{optionLabel(parent, item)} · {parent.label}</option>
        })}</optgroup>}
      </select>
    </label>
    <div className="mission-world-candidate">
      <div className="mission-world-candidate-copy" aria-live="polite">
        <span className="mission-world-eyebrow">{suggestion ? `${suggestion.kind === 'crate' ? 'Crate' : suggestion.kind === 'shelf' ? 'Shelf' : 'Floor'} mission preview` : selectedName ? 'Reference only' : 'Your mission area'}</span>
        <h3>{selectedName ?? 'Choose one small area'}</h3>
        <p>{suggestion ? suggestion.area : selectedName ? 'View this object for context. Choose a shelf, loose-item area, or linked crate for a mission.' : 'Tap an object in 3D or choose from the list. Nothing changes until you use the area.'}</p>
      </div>
      {selectedObject && photo && view === '3d' && <button className="mission-world-photo-link" type="button" onClick={() => changeView('photo')} aria-label={`View reference photo for ${selectedName}`}><img src={photo.src} alt="" loading="lazy" /><span>View reference photo</span></button>}
      <button type="button" className="mission-world-button mission-world-use" disabled={!suggestion} onClick={() => { if (suggestion) onUseArea(suggestion) }}>Use this area <span aria-hidden="true">→</span></button>
    </div>
    <button type="button" className="mission-world-full" onClick={onOpenGarage}>Open full garage <span aria-hidden="true">↗</span></button>
  </section>
}
