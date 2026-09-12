import { useEffect, useRef, useState } from 'react'
import { emptyWorkspace, validateWorkspace } from './model'
import type { Workspace } from './model'
import { preparePhotoUpload } from '../access/photoUpload'
import { acknowledgeSave, applyRemote, validRevision } from './sync'
import type { Snapshot } from './sync'
import { fetchWorkspaceJson } from './workspaceRequest'

const CACHE = 'garage-crates-workspace-v1'
type Status = 'connecting' | 'shared' | 'saving' | 'offline' | 'conflict' | 'error'
const initial = (): Snapshot => {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE) || 'null')
    if (saved && validateWorkspace(saved.data) && validRevision(saved.revision) && typeof saved.dirty === 'boolean') {
      return { revision: saved.revision, data: saved.data, dirty: saved.dirty }
    }
  } catch { /* Start a new workspace when no valid cache exists. */ }
  return { revision: 0, data: emptyWorkspace(), dirty: false }
}

export function useWorkspace() {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial)
  const [status, setStatus] = useState<Status>('connecting')
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [conflict, setConflict] = useState<Snapshot | null>(null)
  const [tick, setTick] = useState(0)
  const latest = useRef(snapshot)
  const busy = useRef(false)
  const requests = useRef(new Set<AbortController>())
  const saveRequest = useRef<AbortController | null>(null)
  const retryRef = useRef<() => void>(() => {})
  const conflictRef = useRef(conflict)
  const lifecycle = useRef({ mounted: false, generation: 0 })

  function isCurrent(generation = lifecycle.current.generation) {
    return lifecycle.current.mounted && generation === lifecycle.current.generation
  }

  function cacheSnapshot(next: Snapshot) {
    if (!isCurrent()) return
    try { localStorage.setItem(CACHE, JSON.stringify(next)); setStorageError(false) }
    catch { setStorageError(true) }
  }

  function commit(next: Snapshot, generation = lifecycle.current.generation): boolean {
    if (!isCurrent(generation)) return false
    // Keep all async callbacks and same-event edits coherent before React renders.
    latest.current = next
    // Cache immediately, including when an accepted edit is followed by navigation
    // before React can run this screen's next effect.
    cacheSnapshot(next)
    setSnapshot(next)
    return true
  }

  function recordConflict(next: Snapshot | null) {
    if (!isCurrent()) return
    conflictRef.current = next
    setConflict(next)
  }

  useEffect(() => {
    lifecycle.current.mounted = true
    lifecycle.current.generation += 1
    busy.current = false
    cacheSnapshot(latest.current)
    return () => {
      // Invalidate requests from this effect lifetime, including StrictMode's
      // setup/cleanup/setup cycle. A late callback must never replace a cache
      // now owned by another screen's workspace instance.
      lifecycle.current.mounted = false
      lifecycle.current.generation += 1
      for (const request of requests.current) request.abort()
      requests.current.clear()
    }
  }, [])

  useEffect(() => {
    let stopped = false
    const generation = lifecycle.current.generation
    let activeRefresh: AbortController | null = null
    async function refresh() {
      if (stopped || document.hidden || !isCurrent(generation) || activeRefresh || busy.current || conflictRef.current || latest.current.dirty) return
      const request = new AbortController()
      activeRefresh = request; requests.current.add(request)
      try {
        const { response, remote } = await fetchWorkspaceJson({ cache: 'no-store' }, { signal: request.signal })
        if (!response.ok) throw new Error('Shared workspace unavailable')
        if (!validateWorkspace(remote.data) || !validRevision(remote.revision)) throw new Error('Invalid shared workspace')
        if (stopped || !isCurrent(generation)) return
        const next = applyRemote(latest.current, { data: remote.data as Workspace, revision: remote.revision }, busy.current || conflictRef.current !== null)
        if (next === latest.current) return
        commit(next, generation)
        setStatus('shared'); setError('')
      } catch {
        if (!stopped && isCurrent(generation) && !busy.current && !conflictRef.current) setStatus('offline')
      } finally {
        requests.current.delete(request)
        if (activeRefresh === request) activeRefresh = null
      }
    }
    function retryCurrent() {
      if (stopped || !isCurrent(generation) || conflictRef.current) return
      setTick(t => t + 1); void refresh()
    }
    function whenVisible() { if (!document.hidden) retryCurrent() }
    retryRef.current = retryCurrent
    void refresh()
    const timer = setInterval(retryCurrent, ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname) ? 4000 : 30000)
    window.addEventListener('online', retryCurrent)
    window.addEventListener('focus', whenVisible)
    document.addEventListener('visibilitychange', whenVisible)
    return () => {
      stopped = true; clearInterval(timer)
      activeRefresh?.abort()
      window.removeEventListener('online', retryCurrent)
      window.removeEventListener('focus', whenVisible)
      document.removeEventListener('visibilitychange', whenVisible)
      if (retryRef.current === retryCurrent) retryRef.current = () => {}
    }
  }, [])

  useEffect(() => {
    if (!snapshot.dirty || conflict || busy.current) return
    const generation = lifecycle.current.generation
    const timer = setTimeout(async () => {
      if (!isCurrent(generation) || busy.current || conflictRef.current || !latest.current.dirty) return
      const request = new AbortController()
      saveRequest.current = request; requests.current.add(request)
      busy.current = true
      const sent = latest.current
      setStatus('saving')
      try {
        const { response, remote } = await fetchWorkspaceJson({
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision: sent.revision, data: sent.data }),
        }, { signal: request.signal })
        if (!isCurrent(generation)) return
        if (response.status === 409 && validateWorkspace(remote.data) && validRevision(remote.revision)) {
          // A lost success response can make our own already-saved write look
          // like a conflict on retry. Recognize that case without losing later edits.
          if (JSON.stringify(remote.data) === JSON.stringify(sent.data)) {
            const acknowledged = acknowledgeSave(latest.current, sent, remote.revision)
            if (acknowledged) {
              commit(acknowledged, generation); setStatus(acknowledged.dirty ? 'saving' : 'shared'); setError('')
              return
            }
          }
          recordConflict({ revision: remote.revision, data: remote.data as Workspace, dirty: false }); setStatus('conflict')
          setError('Another device saved changes. Your draft is preserved here.')
          return
        }
        if (!response.ok) {
          setStatus(response.status >= 500 ? 'offline' : 'error')
          setError(typeof remote.error === 'string' ? remote.error : 'The shared workspace rejected this save. Your draft is retained here.')
          return
        }
        const acknowledged = validateWorkspace(remote.data) && validRevision(remote.revision)
          ? acknowledgeSave(latest.current, sent, remote.revision) : null
        if (!acknowledged) {
          setStatus('error'); setError('The server returned an invalid save acknowledgement. Your draft is retained here.')
          return
        }
        commit(acknowledged, generation)
        setStatus(acknowledged.dirty ? 'saving' : 'shared'); setError('')
      } catch {
        if (!isCurrent(generation)) return
        setStatus('offline')
        setError('Your draft is retained here and will retry when the shared workspace is reachable. Check the device backup status before closing this page.')
      } finally {
        requests.current.delete(request)
        if (isCurrent(generation) && saveRequest.current === request) {
          saveRequest.current = null; busy.current = false
        }
      }
    }, 450)
    return () => clearTimeout(timer)
  }, [snapshot, tick, conflict])

  function update(transform: (data: Workspace) => Workspace): boolean {
    if (!isCurrent()) return false
    const current = latest.current
    const data = transform(current.data)
    if (!validateWorkspace(data)) {
      setError('Check the fields: names, locations and volume values must be valid.')
      return false
    }
    if (!commit({ ...current, data, dirty: true })) return false
    if (!conflictRef.current) setError('')
    return true
  }
  function retry() {
    if (isCurrent() && !conflictRef.current) retryRef.current()
  }
  function downloadDraft() {
    if (!isCurrent()) return
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...latest.current }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = 'garage-crates-backup.json'; link.click()
    URL.revokeObjectURL(url)
  }
  function useSharedVersion() {
    if (!isCurrent()) return
    const shared = conflictRef.current
    if (!shared) return
    try { localStorage.setItem(`${CACHE}-preserved-draft`, JSON.stringify(latest.current)) }
    catch { setError('Download your draft before replacing it; this browser cannot store a backup.'); return }
    commit(shared); recordConflict(null); setStatus('shared'); setError('')
  }
  return { data: snapshot.data, update, status, error, storageError, dirty: snapshot.dirty, conflict, retry, downloadDraft, useSharedVersion }
}

export async function uploadCratePhoto(file: File): Promise<string> {
  const blob = await preparePhotoUpload(file)

  let response: Response
  try {
    response = await fetch('/api/photos', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
  } catch {
    throw new Error('Photo could not be uploaded because the connection failed. Keep the original and try again when connected.')
  }
  if (!response.ok) throw new Error('Photo could not be uploaded. Keep the original and try again when connected.')
  let result: unknown
  try { result = await response.json() }
  catch { throw new Error('The photo server returned an invalid response. Keep the original and retry the upload.') }
  const url = result && typeof result === 'object' && 'url' in result ? result.url : null
  if (typeof url !== 'string' || !/^\/api\/photos\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.(jpg|png|webp)$/.test(url)) {
    throw new Error('The photo server returned an invalid photo path. Keep the original and retry the upload.')
  }
  return url
}
