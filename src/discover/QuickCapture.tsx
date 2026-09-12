import { useEffect, useRef, useState } from 'react'
import type { Tab } from '../App'
import type { Observation } from '../crates/model'
import { uploadCratePhoto, useWorkspace } from '../crates/useWorkspace'
import { GarageIcon } from '../components/GarageIcons'
import { HelperIdentity, readHelperPlayerId } from '../rewards/HelperIdentity'
import { appendObservation, buildObservation } from './observationDraft'
import './quick-capture.css'

type Kind = Observation['kind']
type Unit = NonNullable<Observation['measurement']>['unit']
type Draft = {
  version: 1; id: string; createdAt: number; kind: Kind; photo: string | null; fileName: string;
  location: string; notes: string; crateId: string | null;
  measurementEnabled: boolean; measurementLabel: string; measurementValue: string; measurementUnit: Unit;
  labelCode?: string | null; photoRole?: 'outside' | 'contents' | null;
}
const STORAGE = 'garage-quick-capture-draft-v1'
const UPLOAD_EVENT = 'garage-quick-capture-uploaded'
const PHOTO_PATH = /^\/api\/photos\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.(jpg|png|webp)$/
const uploads = new Map<string, Promise<string>>()
const modes: { kind: Kind; title: string; heading: string; description: string; icon: 'crate' | 'garage' | 'measure' | 'placement' | 'missions' }[] = [
  { kind: 'general', title: 'General', heading: 'Anything that helps.', description: 'A shelf, a loose item, a label, a tight spot, or a wide view. Choose a photo you already have or take one now.', icon: 'missions' },
  { kind: 'crate', title: 'Crate', heading: 'Show one crate as it is.', description: 'Photograph the box where it lives. A closed box is useful; open it only if it’s easy.', icon: 'crate' },
  { kind: 'placement', title: 'Object moved', heading: 'Show where it lives now.', description: 'Photograph the bin, crate or other object with its surroundings. Say what moved, where it was, and where it is now. Include its ID if it has one.', icon: 'placement' },
  { kind: 'parking', title: 'Both cars', heading: 'Show how both cars fit today.', description: 'Photograph both cars in their normal parked positions, including the white boundary and the routes around them.', icon: 'garage' },
  { kind: 'measurement', title: 'Measure', heading: 'One useful measurement.', description: 'Show both endpoints and the tape reading. Enter the number and unit you actually measured.', icon: 'measure' },
]
const presets = [
  { title: 'Shelf depth', label: 'Shelf front edge to back edge', tip: 'Include the shelf’s front and back edges. Keep the tape readable.' },
  { title: 'Clear route width', label: 'Clear route between two obstacles', tip: 'Name both obstacles and measure the narrowest gap you are recording.' },
  { title: 'White boundary', label: 'Rack wall to white parking line', tip: 'Name which end of the garage. Repeat at the other end or a bend; the line may not be parallel.' },
]
const statuses = { connecting: 'Connecting to shared photos…', shared: 'Shared photos', saving: 'Sharing your photo…', offline: 'Connection unavailable', conflict: 'Another device saved changes', error: 'Save needs attention' }

function freshDraft(kind: Kind, crateId: string | null = null, labelCode: string | null = null, photoRole: 'outside' | 'contents' | null = null): Draft {
  return { labelCode, photoRole, version: 1, id: crypto.randomUUID(), createdAt: Date.now(), kind, photo: null, fileName: '', location: '', notes: '', crateId, measurementEnabled: kind === 'measurement', measurementLabel: '', measurementValue: '', measurementUnit: 'cm' }
}
function readDraft(): Draft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(STORAGE) || 'null')
    if (!d || d.version !== 1 || typeof d.id !== 'string' || !d.id || d.id.length > 120
      || !['general', 'crate', 'parking', 'measurement', 'placement'].includes(d.kind) || !Number.isFinite(d.createdAt) || d.createdAt < 0 || d.createdAt > 8.64e15
      || !(d.photo === null || typeof d.photo === 'string' && PHOTO_PATH.test(d.photo))
      || !(d.crateId === null || typeof d.crateId === 'string' && d.crateId.length <= 120)
      || typeof d.measurementEnabled !== 'boolean' || !['cm', 'm', 'in', 'ft'].includes(d.measurementUnit)) return null
    for (const [key, max] of [['fileName', 500], ['location', 160], ['notes', 4000], ['measurementLabel', 160], ['measurementValue', 100]] as const) {
      if (typeof d[key] !== 'string' || d[key].length > max) return null
    }
    if (d.labelCode != null && !(typeof d.labelCode === 'string' && /^C-(?!000)\d{3}$/.test(d.labelCode))) return null
    if (d.photoRole != null && !['outside', 'contents'].includes(d.photoRole)) return null
    return d as Draft
  } catch { return null }
}
function persistDraft(draft: Draft): boolean {
  try { sessionStorage.setItem(STORAGE, JSON.stringify(draft)); return true } catch { return false }
}
function forgetDraft(id: string) {
  try { if (readDraft()?.id === id) sessionStorage.removeItem(STORAGE) } catch { /* Shared save is still valid. */ }
}
function hasContent(draft: Draft) {
  return Boolean(draft.photo || draft.fileName || draft.location || draft.notes || draft.measurementLabel || draft.measurementValue)
}
function uploadOnce(id: string, file: File) {
  const existing = uploads.get(id)
  if (existing) return existing
  const pending = uploadCratePhoto(file)
  uploads.set(id, pending)
  void pending.then(photo => {
    // Finish preserving an upload even if navigation unmounted its form.
    const draft = readDraft()
    if (draft?.id === id) persistDraft({ ...draft, photo })
    window.dispatchEvent(new CustomEvent(UPLOAD_EVENT, { detail: { id, photo } }))
  }).catch(() => {}).finally(() => { if (uploads.get(id) === pending) uploads.delete(id) })
  return pending
}
function reading(observation: Observation) {
  return observation.measurement ? `${observation.measurement.value.toLocaleString()} ${observation.measurement.unit}` : ''
}
const dateLabel = (date: number) => new Date(date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export function QuickCapture({ generalPhotoRequest = 0, initialKind = 'general', initialCrateId = null, initialView = 'capture', initialLabelCode = null, initialPhotoRole = null, onNavigate, onOpenCrate, onLabelQuest }: {
  generalPhotoRequest?: number; initialKind?: Kind; initialCrateId?: string | null; initialView?: 'capture' | 'collection'; initialLabelCode?: string | null; initialPhotoRole?: 'outside' | 'contents' | null; onLabelQuest?: (code?: string) => void; onNavigate: (tab: Tab) => void; onOpenCrate?: (id: string) => void;
}) {
  const workspace = useWorkspace()
  const [view, setView] = useState<'capture' | 'collection'>(initialView)
  const [helperId, setHelperId] = useState<string | null>(readHelperPlayerId)
  const [restored, setRestored] = useState(() => Boolean(readDraft()))
  const [draft, setDraft] = useState<Draft>(() => readDraft() ?? freshDraft(initialLabelCode ? 'crate' : initialKind, initialCrateId, initialLabelCode, initialPhotoRole))
  const draftRef = useRef(draft)
  const workspaceRef = useRef(workspace)
  const mounted = useRef(false)
  const generalRequestSeen = useRef(generalPhotoRequest)
  const busyRef = useRef(false)
  const fileRef = useRef<File | null>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [draftStorageError, setDraftStorageError] = useState(false)
  const [confirmedId, setConfirmedId] = useState<string | null>(null)
  const [backedUp, setBackedUp] = useState(false)
  const [galleryFilter, setGalleryFilter] = useState<Kind | 'all'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [galleryLimit, setGalleryLimit] = useState(12)
  const [presetTip, setPresetTip] = useState('')
  draftRef.current = draft
  workspaceRef.current = workspace
  const observations = workspace.data.observations ?? []
  const record = observations.find(observation => observation.id === draft.id)
  const confirmed = confirmedId === draft.id
  const ready = workspace.status === 'shared' && !workspace.dirty && !workspace.conflict
  const formLocked = busy || Boolean(record)
  const mode = modes.find(candidate => candidate.kind === draft.kind)!
  const photo = draft.photo ?? localPreview
  const missingOriginal = Boolean(draft.fileName && !draft.photo && !fileRef.current && !busy)
  const availableCrates = workspace.data.crates.filter(crate => !draft.labelCode || crate.code.trim().toUpperCase() === draft.labelCode)
  const linkedCrate = availableCrates.find(crate => crate.id === draft.crateId)
  const recent = observations.filter(observation => galleryFilter === 'all' || observation.kind === galleryFilter).slice().sort((a, b) => b.createdAt - a.createdAt)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview) }, [localPreview])
  useEffect(() => {
    if (record && ready) { setConfirmedId(draft.id); forgetDraft(draft.id) }
  }, [record, ready, draft.id])
  useEffect(() => { setBackedUp(false) }, [workspace.conflict])
  useEffect(() => {
    if (generalRequestSeen.current === generalPhotoRequest) return
    generalRequestSeen.current = generalPhotoRequest
    setView('capture')
    // Reopening Add photo must not lose a selected original or an active upload.
    if (busyRef.current || (hasContent(draftRef.current) && !confirmed)) {
      setRestored(true); setMessage('Your current photo is kept. Save it first, then choose another photo.'); return
    }
    const next = freshDraft('general')
    draftRef.current = next; setDraft(next); setConfirmedId(null); setLocalPreview(null)
    fileRef.current = null; setMessage(''); setPresetTip(''); setRestored(false)
  }, [generalPhotoRequest, confirmed])
  useEffect(() => {
    function uploaded(event: Event) {
      const detail = (event as CustomEvent<{ id: string; photo: string }>).detail
      if (detail?.id !== draftRef.current.id || !PHOTO_PATH.test(detail.photo)) return
      const next = { ...draftRef.current, photo: detail.photo }
      draftRef.current = next; setDraft(next)
      setDraftStorageError(!persistDraft(next))
    }
    window.addEventListener(UPLOAD_EVENT, uploaded)
    const pending = uploads.get(draftRef.current.id)
    if (pending) {
      busyRef.current = true; setBusy(true)
      void pending.then(() => { if (mounted.current) setMessage('Your photo finished uploading. Save the photo below to finish its record.') })
        .catch(error => { if (mounted.current) setMessage(error instanceof Error ? error.message : 'Choose the original photo and try again.') })
        .finally(() => { if (mounted.current) { busyRef.current = false; setBusy(false) } })
    }
    return () => window.removeEventListener(UPLOAD_EVENT, uploaded)
  }, [])

  function change(patch: Partial<Draft>) {
    if (busyRef.current || record) return
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next; setDraft(next)
    if (hasContent(next)) setDraftStorageError(!persistDraft(next))
    setMessage('')
  }
  function selectFile(file?: File) {
    if (!file || busyRef.current || record) return
    fileRef.current = file
    setLocalPreview(URL.createObjectURL(file))
    change({ photo: null, fileName: file.name.slice(0, 500) })
  }
  function nextPhoto() {
    if (!confirmed || busyRef.current) return
    const next = freshDraft(draft.kind, linkedCrate?.id ?? null, draft.labelCode ?? null, draft.photoRole ?? null)
    next.location = draft.location
    draftRef.current = next; setDraft(next); setConfirmedId(null); setLocalPreview(null)
    fileRef.current = null; setMessage(''); setPresetTip(''); setDraftStorageError(false); setRestored(false); setView('capture')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
  async function savePhoto() {
    if (busyRef.current || record) return
    if (!ready) { setMessage('Wait for the shared workspace to connect. Your photo and details stay here.'); return }
    const current = draftRef.current
    if (!current.photo && !fileRef.current) { setMessage('Take a photo or choose your original photo first.'); return }
    if (current.crateId && !workspaceRef.current.data.crates.some(crate => crate.id === current.crateId && (!current.labelCode || crate.code.trim().toUpperCase() === current.labelCode))) {
      setMessage('The linked crate is unavailable or does not match this label. Choose a matching crate or leave the link empty.'); return
    }
    busyRef.current = true; setBusy(true); setMessage('')
    // Persist fields before the upload so a route change can recover the result.
    setDraftStorageError(!persistDraft(current))
    try {
      const uploadedPhoto = current.photo ?? await uploadOnce(current.id, fileRef.current!)
      if (!mounted.current || draftRef.current.id !== current.id) return
      const uploadedDraft = { ...draftRef.current, photo: uploadedPhoto }
      draftRef.current = uploadedDraft
      const retained = persistDraft(uploadedDraft)
      if (!mounted.current) return
      setDraft(uploadedDraft); setDraftStorageError(!retained)
      const latest = workspaceRef.current
      if (latest.status !== 'shared' || latest.dirty || latest.conflict) {
        setMessage('The photo uploaded. Your details are kept here; reconnect or review the shared changes, then Save photo.'); return
      }
      const rememberedHelper = readHelperPlayerId()
      const attributedHelper = latest.data.rewards?.players.find(player => player.id === rememberedHelper)?.id ?? null
      const result = buildObservation({ ...uploadedDraft, helperId: attributedHelper }, uploadedDraft.createdAt)
      if (!result.observation) { setMessage(result.error); return }
      let appended = false
      const accepted = latest.update(data => {
        const next = appendObservation(data, result.observation!)
        appended = next !== data
        return next
      })
      if (!accepted || !appended) setMessage('This photo was not added. Your photo and details are still here; check the linked crate and shared records, then retry.')
      else setMessage('Photo recorded on this device. Waiting for the shared save…')
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : 'The photo could not be saved. Your details are still here.')
    } finally {
      if (mounted.current) { busyRef.current = false; setBusy(false) }
    }
  }
  function downloadPhotoDraft() {
    const snapshot = draftRef.current
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), draft: snapshot }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = 'garage-photo-draft.json'; link.click()
    URL.revokeObjectURL(url)
  }
  function openGallery() {
    setView('collection')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  return <main className="quick-capture">
    <header className="quick-header"><span className="quick-header-icon"><GarageIcon name="missions" /></span><div><h1>{view === 'collection' ? 'Photos' : 'Add photo'}</h1></div></header>
    <div className={`quick-sync${ready ? ' is-shared' : ''}`} role="status"><span className="quick-sync-dot" /><span>{workspace.dirty && workspace.status === 'shared' ? 'Photo recorded on this device · waiting to share' : statuses[workspace.status]}</span><button type="button" onClick={openGallery}>{observations.length} photos</button></div>
    {(workspace.conflict || workspace.error || workspace.storageError || draftStorageError) && <section className="quick-alert" aria-label="Save status">
      <p>{workspace.error || (workspace.conflict ? 'Your photo draft is still here. Review the other device’s changes before retrying.' : 'A device backup could not be written. Keep this page open and keep your original photo until the shared save finishes.')}</p>
      <div className="quick-button-row"><button type="button" className="quick-button secondary" onClick={() => { workspace.downloadDraft(); setBackedUp(true) }}>Download device draft</button>{draft.photo && !record && <button type="button" className="quick-button secondary" onClick={downloadPhotoDraft}>Download photo draft</button>}{workspace.conflict && <button type="button" className="quick-button secondary" disabled={!backedUp} onClick={() => { workspace.useSharedVersion(); setMessage('Your photo form is preserved. When the shared version finishes loading, Save photo to add just this find.'); }}>Load shared version</button>}</div>
      {workspace.conflict && <p className="quick-small">Download the device draft first. Loading the shared version keeps this photo form so you can retry it.</p>}
    </section>}
    {view === 'capture' && <div className="quick-layout">
      <section className="quick-workbench" aria-label="Capture a useful photo">
        {!record ? <>
          {restored && <div className="quick-restored" role="status"><strong>Unfinished {draft.labelCode ? `${draft.labelCode} ${draft.photoRole ?? ''}` : mode.title.toLowerCase()} photo restored</strong><p>{draft.crateId ? `Linked crate: ${linkedCrate ? `${linkedCrate.code} · ${linkedCrate.name}` : 'previously selected crate (unavailable)'}.` : 'No crate is linked.'}</p>{(draft.kind !== initialKind || initialCrateId && initialCrateId !== draft.crateId || initialLabelCode && initialLabelCode !== draft.labelCode || initialPhotoRole && initialPhotoRole !== draft.photoRole) && <p>You opened a different photo task. This is your earlier draft; its photo and crate link are preserved. Finish it first, then take another photo.</p>}<button type="button" className="quick-text-button" onClick={() => setRestored(false)}>Continue this draft →</button></div>}
          {(draft.labelCode || draft.kind !== 'general') && <div className="quick-prompt"><h2>{draft.labelCode ? `${draft.labelCode} · ${draft.photoRole === 'contents' ? 'Contents' : 'Outside'}` : mode.title}</h2></div>}
          <input ref={cameraInput} className="quick-file-input" type="file" accept="image/*" capture="environment" aria-label="Take a helpful garage photo" onChange={event => { selectFile(event.target.files?.[0]); event.target.value = '' }} />
          <input ref={libraryInput} className="quick-file-input" type="file" accept="image/*" aria-label="Choose a helpful garage photo" onChange={event => { selectFile(event.target.files?.[0]); event.target.value = '' }} />
          {photo && <figure className="quick-preview"><img src={photo} alt="Your photo draft" /></figure>}
          {!photo ? <div className="quick-camera-actions"><button type="button" className="quick-button quick-camera" disabled={formLocked} onClick={() => cameraInput.current?.click()}><GarageIcon name="missions" />Take photo</button><button type="button" className="quick-button secondary" disabled={formLocked} onClick={() => libraryInput.current?.click()}>Choose from photos</button></div> : <details className="quick-change-photo"><summary>Change photo</summary><div className="quick-camera-actions"><button type="button" className="quick-button secondary" disabled={formLocked} onClick={() => cameraInput.current?.click()}>Retake</button><button type="button" className="quick-button secondary" disabled={formLocked} onClick={() => libraryInput.current?.click()}>Choose another</button></div></details>}
          {missingOriginal && <p className="quick-alert" role="status">Your notes were restored. Choose the original photo again; it had not finished uploading.</p>}
          {draft.kind === 'parking' && <details className="quick-guidance"><summary>What makes a helpful parking photo?</summary><p>Take a wide view from the entrance, then another from the rear. Show both cars where they normally park, the white boundary, and the routes in and out.</p><p>Include the room for opening doors. Note which car goes where and what blocks a route. A photo records the situation; it does not establish a safe clearance.</p></details>}
          {draft.kind === 'measurement' && <div className="quick-measure-prompts"><span>Useful places to measure</span><div>{presets.map(preset => <button type="button" disabled={formLocked} className="quick-button secondary" key={preset.title} onClick={() => { change({ measurementEnabled: true, measurementLabel: preset.label }); setPresetTip(preset.tip) }}>{preset.title}</button>)}</div>{presetTip && <p>{presetTip}</p>}</div>}
          {(photo || draft.fileName) && <form onSubmit={event => { event.preventDefault(); void savePhoto() }}>
            <fieldset className="quick-fields" disabled={formLocked}>
              <label>Note <span className="quick-optional">Optional</span><textarea value={draft.notes} rows={2} maxLength={4000} placeholder={draft.kind === 'placement' ? 'Garbage bin: moved from the car space to beside the entrance…' : draft.kind === 'parking' ? 'Which car goes where? What is blocking the route?' : draft.kind === 'general' ? 'What should we know?' : 'A few words about the contents or what needs a closer look…'} onChange={event => change({ notes: event.target.value })} /></label>
              <details className="quick-extra-details" open={draft.kind!=='general' || draft.measurementEnabled || Boolean(draft.crateId) || undefined}><summary>More details</summary>
              <label>Where is this? <span className="quick-optional">Optional</span><input value={draft.location} maxLength={160} placeholder={draft.kind === 'placement' ? 'Where the object is now' : draft.kind === 'general' ? 'Anywhere in or around the garage' : 'Right rack · middle shelf'} onChange={event => change({ location: event.target.value })} /></label>
              <label className="quick-check"><input type="checkbox" checked={draft.measurementEnabled} onChange={event => change({ measurementEnabled: event.target.checked })} /><span>Add a measurement <span className="quick-optional">Optional</span></span></label>
              {draft.measurementEnabled && <div className="quick-measurement"><label>What did you measure? <span className="quick-optional">Name both endpoints</span><input value={draft.measurementLabel} maxLength={160} placeholder="Rack wall to white line at the entrance end" onChange={event => change({ measurementLabel: event.target.value })} /></label><div className="quick-reading-fields"><label>Your reading<input inputMode="decimal" type="number" min="0" max="1000000" step="any" value={draft.measurementValue} placeholder="Leave blank for now" onChange={event => change({ measurementValue: event.target.value.slice(0, 100) })} /></label><label>Unit<select value={draft.measurementUnit} onChange={event => change({ measurementUnit: event.target.value as Unit })}><option value="cm">cm</option><option value="m">m</option><option value="in">inches</option><option value="ft">feet</option></select></label></div><p className="quick-small">Use your tape reading. You can leave it blank.</p></div>}
              <details className="quick-link-crate" open={Boolean(draft.crateId) || undefined}><summary>Link a crate</summary><label>Crate record<select value={draft.crateId ?? ''} onChange={event => change({ crateId: event.target.value || null })}><option value="">No crate link</option>{draft.crateId && !linkedCrate && <option value={draft.crateId}>Previously selected crate · unavailable</option>}{availableCrates.map(crate => <option key={crate.id} value={crate.id}>{crate.code} · {crate.name}</option>)}</select></label></details>
              </details>
            </fieldset>
            <button type="submit" className="quick-button quick-save" disabled={busy || !ready || (!draft.photo && !fileRef.current)}>{busy ? 'Uploading photo…' : 'Save photo'}<span aria-hidden="true">→</span></button>
            {!ready && <p className="quick-small">Connect to save. Your photo stays here.</p>}
          </form>}
        </> : <section className="quick-saved" aria-live="polite"><span className="quick-saved-icon"><GarageIcon name={confirmed ? 'trophy' : 'missions'} /></span><h2>{confirmed ? 'Photo saved' : 'Saving photo…'}</h2><p>{confirmed ? 'Shared with the family.' : 'Keep this page open until it saves.'}</p><figure className="quick-preview"><img src={record.photo} alt={record.location || 'The photo you captured'} /></figure>{record.measurement && <div className="quick-saved-reading"><strong>{reading(record)}</strong><span>{record.measurement.label}</span><small>Measured by you</small></div>}{record.kind === 'measurement' && !record.measurement && <p>Photo saved as a reference. The reading is still pending.</p>}<div className="quick-button-row">{record.labelCode && onLabelQuest && <button type="button" className="quick-button" disabled={!confirmed} onClick={() => onLabelQuest(record.labelCode)}>Back to this crate</button>}<button type="button" className="quick-button" disabled={!confirmed} onClick={nextPhoto}>{record.labelCode ? `Take another ${record.photoRole === 'contents' ? 'contents' : 'outside'} photo` : 'Add another photo'}</button><button type="button" className="quick-button secondary" onClick={openGallery}>See photos</button></div>{confirmed && <p className="quick-photo-points">{workspace.data.photoAwards?.some(award=>award.observationId===record.id) ? '25 photo points awarded.' : '+25 points after John’s review.'} <button type="button" className="quick-text-button" onClick={()=>onNavigate('score')}>See Score →</button></p>}{record.crateId && onOpenCrate && <button type="button" className="quick-text-button" onClick={() => onOpenCrate(record.crateId!)}>Open linked crate →</button>}</section>}
        {message && !confirmed && <p className="quick-message" role="status">{message}</p>}
      </section>
      <aside className="quick-side"><HelperIdentity workspace={workspace} selectedPlayerId={helperId} onSelectPlayer={setHelperId} /><details className="quick-help"><summary>Photo tips</summary><p>{draft.labelCode ? draft.photoRole === 'contents' ? 'Show what is inside. Include the crate label if you can.' : 'Show the label and where the crate lives.' : mode.description}</p><p>Keep both car routes clear. Useful photos can earn 25 points after John reviews them.</p></details></aside>
    </div>}
    {view === 'collection' && <section className="quick-gallery" ref={galleryRef} aria-labelledby="quick-gallery-heading"><div className="quick-gallery-heading"><div><h2 id="quick-gallery-heading" className="quick-visually-hidden">Saved photos <span>{observations.length}</span></h2></div><label>Show<select value={galleryFilter} onChange={event => { setGalleryFilter(event.target.value as Kind | 'all'); setGalleryLimit(12) }}><option value="all">All photos</option>{modes.map(option => <option key={option.kind} value={option.kind}>{option.title}</option>)}</select></label></div>
      {workspace.dirty && <p className="quick-small">This view includes this device’s draft. It will appear on other devices after the shared save finishes.</p>}
      {!recent.length ? <div className="quick-gallery-empty"><GarageIcon name="missions" /><p>{observations.length ? 'No photos in this group yet.' : 'Your first useful photo will appear here.'}</p></div> : <div className="quick-gallery-grid">{recent.slice(0, galleryLimit).map(observation => <article className={`quick-find${expanded === observation.id ? ' is-expanded' : ''}`} key={observation.id}><button type="button" className="quick-find-photo" aria-expanded={expanded === observation.id} aria-label={`${expanded === observation.id ? 'Close' : 'Enlarge'} ${modes.find(option => option.kind === observation.kind)!.title.toLowerCase()} photo from ${dateLabel(observation.createdAt)}`} onClick={() => setExpanded(expanded === observation.id ? null : observation.id)}><img src={observation.photo} loading="lazy" alt={observation.location || `${observation.kind === 'placement' ? 'Object location' : observation.kind === 'parking' ? 'Parking' : observation.kind === 'measurement' ? 'Measurement' : observation.kind === 'general' ? 'Garage photo' : 'Crate'} observation`} /><span>{expanded === observation.id ? 'Close large photo' : 'View photo'}</span></button><div className="quick-find-copy">{observation.labelCode && <p className="quick-label-context">{observation.labelCode}{observation.photoRole ? ` · ${observation.photoRole === 'contents' ? 'Contents' : 'Outside'}` : ''}</p>}<div className="quick-find-meta"><span>{modes.find(option => option.kind === observation.kind)!.title}</span><time dateTime={new Date(observation.createdAt).toISOString()}>{dateLabel(observation.createdAt)}</time></div>{observation.helperId && <p className="quick-find-helper">Photo by {workspace.data.rewards?.players.find(player => player.id === observation.helperId)?.name ?? 'a helper'}</p>}{workspace.data.photoAwards?.some(award=>award.observationId===observation.id) && <p className="quick-label-context">✓ 25 photo points awarded</p>}{observation.location && <h3>{observation.location}</h3>}{observation.measurement && <div className="quick-find-reading"><strong>{reading(observation)}</strong><span>{observation.measurement.label}</span></div>}{observation.kind === 'measurement' && !observation.measurement && <p className="quick-pending-reading">Reading not entered</p>}{observation.notes && <p className="quick-find-notes">{observation.notes}</p>}{observation.labelCode && onLabelQuest && <button type="button" className="quick-text-button" onClick={() => onLabelQuest(observation.labelCode)}>View this labeled crate →</button>}{observation.crateId && onOpenCrate && <button type="button" className="quick-text-button" onClick={() => onOpenCrate(observation.crateId!)}>Open linked crate →</button>}</div></article>)}</div>}
      {recent.length > galleryLimit && <button type="button" className="quick-button secondary quick-more" onClick={() => setGalleryLimit(limit => limit + 12)}>Show more photos</button>}
    </section>}
  </main>
}
