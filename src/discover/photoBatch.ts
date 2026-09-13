import type { Observation } from '../crates/model'

export const MAX_PHOTO_BATCH_FILES = 50

export type PhotoBatchContext = {
  kind?: Observation['kind']
  crateId?: string | null
  labelCode?: string | null
  photoRole?: 'outside' | 'contents' | null
  location?: string
  helperId?: string | null
  measurementEnabled?: boolean
  measurementLabel?: string
  measurementValue?: string
  measurementUnit?: 'cm' | 'm' | 'in' | 'ft'
  /** Initial note for each new entry. Later edits belong to entry.notes. */
  notes?: string
}

export type PhotoBatchEntry = {
  /** Also used as the shared observation ID; retries must keep it unchanged. */
  id: string
  file: File
  fileName: string
  createdAt: number
  /** Selection order, independent of the actual recorded time; absent on older drafts. */
  queueOrder?: number
  notes: string
  context: Omit<PhotoBatchContext, 'notes'>
  /** A completed file upload is not acknowledgement of a shared observation save. */
  photo: string | null
  error: string | null
}

export type PhotoBatchState = {
  entries: PhotoBatchEntry[]
  /** Browser-local persistence only. This never means saved with the family. */
  persistence: 'saved' | 'memory-only'
  error: string
}

export type PhotoBatchAddResult = PhotoBatchState & {
  addedIds: string[]
  duplicateCount: number
  limitCount: number
}

export type PhotoBatchEntryPatch = Partial<Pick<PhotoBatchEntry, 'notes' | 'context' | 'photo' | 'error'>>

/** A write must commit all puts and removals atomically, or reject. */
export type PhotoBatchStorage = {
  read: () => Promise<PhotoBatchEntry[]>
  write: (puts: PhotoBatchEntry[], removeIds: string[]) => Promise<void>
}

function copyEntry(entry: PhotoBatchEntry): PhotoBatchEntry {
  return { ...entry, context: { ...entry.context } }
}

function orderOf(entry: PhotoBatchEntry): number {
  return Number.isSafeInteger(entry.queueOrder) && entry.queueOrder! >= 0 ? entry.queueOrder! : entry.createdAt
}

function compareEntries(a: PhotoBatchEntry, b: PhotoBatchEntry): number {
  // IndexedDB getAll() returns key order, which is unrelated to selection order.
  return orderOf(a) - orderOf(b) || a.createdAt - b.createdAt || a.id.localeCompare(b.id)
}

/** A convenience guard for duplicate selections, not proof that two photos are identical. */
export function photoSelectionKey(file: File): string {
  return JSON.stringify([file.name, file.size, file.lastModified])
}

function persistenceError(error: unknown): string {
  return error instanceof Error && error.name === 'QuotaExceededError'
    ? 'Browser storage is full. Keep this page open and keep your original photos until they are shared.'
    : 'This browser could not save the photo queue. Keep this page open and keep your original photos until they are shared.'
}

/**
 * Holds original bytes while uploads/shared saves are pending. All operations are
 * serialized, and failed local writes stay queued for retry on the next operation.
 * Removing entries is explicit: an uploaded URL alone never removes a photo.
 */
export function createPhotoBatchQueue(storage: PhotoBatchStorage = createIndexedDBPhotoBatchStorage()) {
  const entries = new Map<string, PhotoBatchEntry>()
  const dirty = new Set<string>()
  const removed = new Set<string>()
  let loaded = false
  let error = ''
  let tail: Promise<unknown> = Promise.resolve()

  const snapshot = (): PhotoBatchState => ({
    entries: [...entries.values()].sort(compareEntries).map(copyEntry),
    persistence: loaded && !error && !dirty.size && !removed.size ? 'saved' : 'memory-only',
    error,
  })

  async function ensureLoaded() {
    if (loaded) return
    try {
      const saved = await storage.read()
      for (const entry of saved) {
        if (!dirty.has(entry.id) && !removed.has(entry.id)) entries.set(entry.id, copyEntry(entry))
      }
      loaded = true
      error = ''
    } catch (cause) { error = persistenceError(cause) }
  }

  async function flush() {
    // Do not mutate a store we could not first read: there may be older drafts in it.
    if (!loaded) return
    if (!dirty.size && !removed.size) { error = ''; return }
    try {
      await storage.write([...dirty].flatMap(id => entries.has(id) ? [copyEntry(entries.get(id)!)] : []), [...removed])
      dirty.clear()
      removed.clear()
      error = ''
    } catch (cause) { error = persistenceError(cause) }
  }

  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = tail.then(operation)
    tail = next.catch(() => undefined)
    return next
  }

  return {
    load: (): Promise<PhotoBatchState> => serial(async () => {
      await ensureLoaded()
      await flush()
      return snapshot()
    }),

    add: (files: Iterable<File>, context: PhotoBatchContext = {}): Promise<PhotoBatchAddResult> => {
      // FileList and caller-owned objects may change while an earlier operation runs.
      const selected = [...files]
      const { notes = '', ...initialContext } = { ...context }
      return serial(async () => {
        await ensureLoaded()
        const existing = new Set([...entries.values()].map(entry => photoSelectionKey(entry.file)))
        let lastOrder = Math.max(0, ...[...entries.values()].map(orderOf))
        const addedIds: string[] = []
        let duplicateCount = 0
        let limitCount = 0
        for (const file of selected) {
          const key = photoSelectionKey(file)
          if (existing.has(key)) { duplicateCount++; continue }
          if (entries.size >= MAX_PHOTO_BATCH_FILES) { limitCount++; continue }
          const createdAt = Date.now()
          const queueOrder = Math.max(createdAt, lastOrder + 1)
          const entry: PhotoBatchEntry = {
            id: crypto.randomUUID(), file, fileName: file.name, createdAt, queueOrder,
            notes, context: { ...initialContext }, photo: null, error: null,
          }
          entries.set(entry.id, entry)
          dirty.add(entry.id)
          existing.add(key)
          lastOrder = queueOrder
          addedIds.push(entry.id)
        }
        await flush()
        return { ...snapshot(), addedIds, duplicateCount, limitCount }
      })
    },

    update: (id: string, patch: PhotoBatchEntryPatch): Promise<PhotoBatchState> => {
      const update = { ...patch, ...(patch.context ? { context: { ...patch.context } } : {}) }
      return serial(async () => {
        await ensureLoaded()
        const entry = entries.get(id)
        if (entry) {
          // Explicitly allow metadata edits only; identity and source bytes are immutable.
          entries.set(id, {
            ...entry,
            ...(update.notes !== undefined ? { notes: update.notes } : {}),
            ...(update.photo !== undefined ? { photo: update.photo } : {}),
            ...(update.error !== undefined ? { error: update.error } : {}),
            ...(update.context ? { context: { ...entry.context, ...update.context } } : {}),
          })
          dirty.add(id)
        }
        await flush()
        return snapshot()
      })
    },

    remove: (ids: Iterable<string>): Promise<PhotoBatchState> => {
      const selected = [...ids]
      return serial(async () => {
        await ensureLoaded()
        for (const id of selected) {
          entries.delete(id)
          dirty.delete(id)
          removed.add(id)
        }
        await flush()
        return snapshot()
      })
    },
  }
}

const DB_NAME = 'garage-photo-batch-v1'
const STORE_NAME = 'photos'

type StoredPhoto = Omit<PhotoBatchEntry, 'file'> & { file: Blob; lastModified: number }

/** File/Blob structured cloning preserves bytes, including embedded HEIC metadata. */
export function createIndexedDBPhotoBatchStorage(): PhotoBatchStorage {
  async function open(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB unavailable')
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      let settled = false
      const fail = (cause: unknown) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        reject(cause ?? new Error('Photo queue storage unavailable'))
      }
      const timeout = setTimeout(() => fail(new Error('Photo queue storage timed out')), 8000)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
      request.onsuccess = () => {
        if (settled) { request.result.close(); return }
        settled = true
        clearTimeout(timeout)
        resolve(request.result)
      }
      request.onerror = () => fail(request.error)
      request.onblocked = () => fail(new Error('Photo queue storage is blocked'))
    })
  }

  async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
    const db = await open()
    try {
      return await new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode)
        let result: T
        const timeout = setTimeout(() => transaction.abort(), 30000)
        transaction.oncomplete = () => { clearTimeout(timeout); resolve(result) }
        transaction.onabort = transaction.onerror = () => { clearTimeout(timeout); reject(transaction.error ?? new Error('Photo queue storage failed')) }
        try { work(transaction.objectStore(STORE_NAME), value => { result = value }) }
        catch (cause) { clearTimeout(timeout); transaction.abort(); reject(cause) }
      })
    } finally { db.close() }
  }

  return {
    async read() {
      const records = await transaction<StoredPhoto[]>('readonly', (store, result) => {
        const request = store.getAll()
        request.onsuccess = () => result(request.result)
      })
      return records.map(record => {
        if (!record || typeof record.id !== 'string' || !(record.file instanceof Blob)
          || typeof record.fileName !== 'string' || !Number.isFinite(record.createdAt)
          || typeof record.notes !== 'string' || !record.context || typeof record.context !== 'object'
          || !Number.isFinite(record.lastModified)) throw new Error('A queued photo could not be restored')
        const { lastModified, ...entry } = record
        return { ...entry, file: new File([entry.file], entry.fileName, { type: entry.file.type, lastModified }) }
      })
    },
    async write(puts, removeIds) {
      await transaction<void>('readwrite', (store, result) => {
        for (const id of removeIds) store.delete(id)
        for (const entry of puts) store.put({ ...copyEntry(entry), lastModified: entry.file.lastModified } satisfies StoredPhoto)
        result(undefined)
      })
    },
  }
}

const photoBatch = createPhotoBatchQueue()
export const loadPhotoBatch = photoBatch.load
export const addPhotoBatchFiles = photoBatch.add
export const updatePhotoBatchEntry = photoBatch.update
export const removePhotoBatchEntries = photoBatch.remove
