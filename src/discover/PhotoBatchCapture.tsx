import { useEffect, useRef, useState } from 'react'
import { GarageIcon } from '../components/GarageIcons'
import { uploadCratePhoto, useWorkspace } from '../crates/useWorkspace'
import { appendObservation, buildObservation } from './observationDraft'
import { addPhotoBatchFiles, loadPhotoBatch, removePhotoBatchEntries, updatePhotoBatchEntry } from './photoBatch'
import type { PhotoBatchContext, PhotoBatchEntry } from './photoBatch'
import './photo-batch.css'

type WorkspaceState = ReturnType<typeof useWorkspace>
export type PhotoBatchSelection = { id: string; groups: { files: File[]; context: PhotoBatchContext }[] }
const activeUploads = new Map<string, Promise<string>>()

/** The uploaded URL is durable before any workspace write is attempted. */
function uploadEntry(entry: PhotoBatchEntry) {
  const existing = activeUploads.get(entry.id)
  if (existing) return existing
  const pending = uploadCratePhoto(entry.file).then(async photo => {
    await updatePhotoBatchEntry(entry.id, { photo, error: null })
    return photo
  })
  activeUploads.set(entry.id, pending)
  void pending.finally(() => { if (activeUploads.get(entry.id) === pending) activeUploads.delete(entry.id) }).catch(() => {})
  return pending
}

export function PhotoBatchCapture({ workspace, selection, context, hidden, onConsumed, onActiveChange }: {
  workspace: WorkspaceState; selection: PhotoBatchSelection | null; context: PhotoBatchContext;
  hidden: boolean; onConsumed: (id: string) => void; onActiveChange: (active: boolean) => void;
}) {
  const [entries, setEntries] = useState<PhotoBatchEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [durable, setDurable] = useState(true)
  const [running, setRunning] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const mounted = useRef(false)
  const operation = useRef(false)
  const seenSelection = useRef<string | null>(null)
  const workspaceRef = useRef(workspace)
  const entriesRef = useRef(entries)
  const pendingNotes = useRef(new Map<string, string>())
  const fileInput = useRef<HTMLInputElement>(null)
  workspaceRef.current = workspace
  entriesRef.current = entries
  const ready = workspace.status === 'shared' && !workspace.dirty && !workspace.conflict

  async function refresh() {
    const state = await loadPhotoBatch()
    if (mounted.current) { setEntries(state.entries.map(entry => pendingNotes.current.has(entry.id) ? { ...entry, notes: pendingNotes.current.get(entry.id)! } : entry)); setDurable(state.persistence === 'saved'); setLoaded(true) }
    return state
  }
  useEffect(() => {
    mounted.current = true
    void refresh()
    return () => { mounted.current = false }
  }, [])
  useEffect(() => { if (loaded) onActiveChange(entries.length > 0) }, [loaded, entries.length, onActiveChange])
  useEffect(() => {
    if (!selection || seenSelection.current === selection.id) return
    seenSelection.current = selection.id
    setAdding(true)
    void (async () => {
      let duplicates = 0, limited = 0
      for (const group of selection.groups) {
        const result = await addPhotoBatchFiles(group.files, group.context)
        duplicates += result.duplicateCount; limited += result.limitCount
      }
      await refresh()
      if (mounted.current) {
        setAdding(false)
        setMessage(limited ? 'Up to 50 photos fit in one batch. Add the rest after this batch.' : duplicates ? 'Repeated selections were skipped.' : '')
        onConsumed(selection.id)
      }
    })().catch(() => { if (mounted.current) { setAdding(false); setMessage('Could not prepare this batch. Your original files are unchanged.') } })
  }, [selection, onConsumed])

  // Only a clean shared snapshot confirms completion; local drafts never count as saved.
  useEffect(() => {
    if (!ready) return
    const ids = new Set((workspace.data.observations ?? []).map(item => item.id))
    setConfirmed(new Set(entries.filter(entry => ids.has(entry.id)).map(entry => entry.id)))
  }, [ready, workspace.data.observations, entries])

  useEffect(() => {
    if (!running || !ready || operation.current || adding) return
    const observations = workspace.data.observations ?? []
    const next = entries.find(entry => !entry.error && !observations.some(item => item.id === entry.id))
    if (!next) { setRunning(false); return }
    operation.current = true
    setActiveId(next.id)
    void (async () => {
      try {
        const photo = next.photo ?? await uploadEntry(next)
        if (!mounted.current) return
        const state = await refresh()
        if (!mounted.current) return
        const current = state.entries.find(entry => entry.id === next.id)
        if (!current) return
        const shared = workspaceRef.current
        if (shared.status !== 'shared' || shared.dirty || shared.conflict) return
        if ((shared.data.observations ?? []).some(item => item.id === current.id)) return
        const c = current.context
        const helperId = shared.data.rewards?.players.some(player => player.id === c.helperId) ? c.helperId : null
        const result = buildObservation({
          id: current.id, kind: c.kind ?? 'general', photo, notes: current.notes,
          location: c.location ?? '', crateId: c.crateId ?? null, labelCode: c.labelCode,
          photoRole: c.photoRole, helperId,
          measurementEnabled: c.measurementEnabled ?? false, measurementLabel: c.measurementLabel ?? '',
          measurementValue: c.measurementValue ?? '', measurementUnit: c.measurementUnit ?? 'cm',
        }, current.createdAt)
        if (!result.observation) throw new Error(result.error)
        let accepted = false
        const updated = shared.update(data => {
          const withPhoto = appendObservation(data, result.observation!)
          accepted = withPhoto !== data || (data.observations ?? []).some(item => item.id === current.id)
          return withPhoto
        })
        if (!updated || !accepted) throw new Error('Check this photo’s crate link, then retry.')
      } catch (error) {
        await updatePhotoBatchEntry(next.id, { error: error instanceof Error ? error.message : 'Could not upload. Try again.' })
      } finally {
        operation.current = false
        if (mounted.current) { setActiveId(null); await refresh() }
      }
    })()
  }, [running, ready, entries, adding, workspace.data.observations])

  async function addFiles(files: File[]) {
    if (!files.length) return
    setAdding(true)
    try {
      const result = await addPhotoBatchFiles(files, context)
      await refresh()
      setMessage(result.limitCount ? 'Up to 50 photos fit in one batch.' : result.duplicateCount ? 'Repeated selections were skipped.' : '')
    } finally { if (mounted.current) setAdding(false) }
  }
  async function patch(id: string, notes: string) {
    pendingNotes.current.set(id, notes)
    setEntries(current => current.map(entry => entry.id === id ? { ...entry, notes, error: null } : entry))
    await updatePhotoBatchEntry(id, { notes, error: null })
    if (pendingNotes.current.get(id) === notes) pendingNotes.current.delete(id)
    await refresh()
  }
  async function unlinkCrate(id: string) {
    await updatePhotoBatchEntry(id, { context: { crateId: null }, error: null })
    await refresh()
  }
  async function remove(ids: string[]) {
    await removePhotoBatchEntries(ids)
    await refresh()
    setMessage('')
  }
  async function retry() {
    for (const entry of entriesRef.current.filter(entry => entry.error && !confirmed.has(entry.id))) {
      await updatePhotoBatchEntry(entry.id, { error: null })
    }
    await refresh(); setRunning(true)
  }
  if (hidden || (!entries.length && !adding)) return null
  const saved = entries.filter(entry => confirmed.has(entry.id)).length
  const failed = entries.filter(entry => entry.error && !confirmed.has(entry.id)).length
  const remaining = entries.length - saved
  return <section className="photo-batch" aria-label="Selected photos">
    <div className="photo-batch-heading"><div><h2>{adding && !entries.length ? 'Adding photos…' : remaining ? `${entries.length} photos` : 'Photos saved'}</h2><p role="status">{saved} of {entries.length} shared{failed ? ` · ${failed} need a retry` : ''}</p></div><GarageIcon name={remaining ? 'missions' : 'trophy'} /></div>
    <input ref={fileInput} className="quick-file-input" type="file" accept="image/*,.heic,.heif" multiple aria-label="Add more photos to this batch" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void addFiles(files) }} />
    {!durable && <p className="quick-alert" role="status">Keep this page open. This browser couldn’t keep a backup of the selected files.</p>}
    <div className="photo-batch-actions">
      {remaining > 0 && !running && <button className="quick-button" disabled={!ready || adding} onClick={() => void retry()}>{failed ? 'Retry unsaved photos' : `Save ${remaining} ${remaining === 1 ? 'photo' : 'photos'}`}</button>}
      {running && <button className="quick-button secondary" onClick={() => setRunning(false)}>Pause after this photo</button>}
      {!remaining && !adding && <button className="quick-button" onClick={() => void remove(entries.map(entry => entry.id))}>Done</button>}
      <button className="quick-button secondary" disabled={adding || entries.length >= 50} onClick={() => fileInput.current?.click()}>{adding ? 'Adding…' : 'Add more photos'}</button>
    </div>
    {!ready && remaining > 0 && <p className="quick-small">Waiting for the shared connection. Your selected photos stay in this queue.</p>}
    {running && <p className="quick-small">Keep the app open while photos save.</p>}
    {message && <p className="quick-message" role="status">{message}</p>}
    <div className="photo-batch-list">{entries.map(entry => {
      const isSaved = confirmed.has(entry.id)
      const isActive = activeId === entry.id
      const recorded = (workspace.data.observations ?? []).some(item => item.id === entry.id)
      return <article className={`photo-batch-item${isSaved ? ' is-saved' : ''}`} key={entry.id}>
        <BatchThumbnail entry={entry} />
        <div className="photo-batch-item-copy"><strong>{entry.fileName}</strong><span className="photo-batch-status" role="status">{isSaved ? '✓ Saved' : entry.error ? 'Needs retry' : isActive ? entry.photo ? 'Sharing…' : 'Uploading…' : recorded ? 'Sharing…' : entry.photo ? 'Ready to share' : 'Ready'}</span>
          {entry.context.labelCode && <span>{entry.context.labelCode}{entry.context.photoRole ? ` · ${entry.context.photoRole === 'contents' ? 'Contents' : 'Outside'}` : ''}</span>}
          {entry.error && !isSaved && <p className="photo-batch-error">{entry.error}</p>}
          {entry.error && entry.context.crateId && !isSaved && !running && <button type="button" className="quick-text-button" onClick={() => void unlinkCrate(entry.id)}>Save without crate link</button>}
          {!isSaved && <details><summary>{entry.notes ? 'Edit note' : 'Add a note'}</summary><label><span className="quick-visually-hidden">Note for {entry.fileName}</span><textarea value={entry.notes} rows={2} maxLength={4000} disabled={running || recorded || isActive} placeholder="What changed?" onChange={event => void patch(entry.id, event.target.value)} /></label></details>}
          {!isSaved && !recorded && !isActive && !running && <button type="button" className="quick-text-button" aria-label={`Remove ${entry.fileName} from this batch`} onClick={() => void remove([entry.id])}>Remove</button>}
        </div>
      </article>
    })}</div>
    <p className="quick-small photo-batch-footer">Useful photos earn points after review.</p>
  </section>
}

function BatchThumbnail({ entry }: { entry: PhotoBatchEntry }) {
  const [url, setUrl] = useState<string | null>(entry.photo)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
    if (entry.photo) { setUrl(entry.photo); return }
    const objectUrl = URL.createObjectURL(entry.file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [entry.photo, entry.file])
  return <div className="photo-batch-thumbnail">{url && !failed ? <img src={url} alt={entry.fileName} loading="lazy" onError={() => setFailed(true)} /> : <GarageIcon name="missions" />}</div>
}
