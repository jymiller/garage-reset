import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('./photoBatch.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { createPhotoBatchQueue, MAX_PHOTO_BATCH_FILES } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

const photo = (name = 'IMG_1930.HEIC', lastModified = 1789212345678, content = new Uint8Array([0, 0, 0, 28, 102, 116, 121, 112, 104, 101, 105, 99, 0, 255, 38])) =>
  new File([content], name, { type: 'image/heic', lastModified })
const hash = async file => createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex')

// Mimic structured-clone persistence and reconstruction, including runtimes that
// restore a File as a Blob. Each queue instance has an independent in-memory state.
function disk() {
  const records = new Map()
  let failRead = false
  let failWrite = false
  const clone = entry => ({
    ...structuredClone({ ...entry, file: undefined }),
    file: new File([entry.file], entry.fileName, { type: entry.file.type, lastModified: entry.file.lastModified }),
  })
  return {
    records,
    failRead: value => { failRead = value },
    failWrite: value => { failWrite = value },
    storage: {
      async read() {
        if (failRead) throw new DOMException('Unavailable', 'InvalidStateError')
        return [...records.values()].map(clone)
      },
      async write(puts, removeIds) {
        if (failWrite) throw new DOMException('Full', 'QuotaExceededError')
        const updates = puts.map(clone)
        for (const id of removeIds) records.delete(id)
        for (const entry of updates) records.set(entry.id, entry)
      },
    },
  }
}

test('HEIC originals, per-photo metadata and stable observation IDs survive reopening the queue', async () => {
  const persistence = disk()
  const original = photo()
  const queue = createPhotoBatchQueue(persistence.storage)
  const added = await queue.add([original, photo('IMG_1931.HEIC')], {
    kind: 'placement', crateId: 'crate-2', labelCode: 'C-002', photoRole: 'outside',
    location: 'By the street', helperId: 'griff', notes: 'Moved outside',
    measurementEnabled: true, measurementLabel: 'Wall to line', measurementValue: '120', measurementUnit: 'cm',
  })
  assert.equal(added.persistence, 'saved')
  assert.equal(new Set(added.addedIds).size, 2)
  const firstId = added.addedIds[0]
  await queue.update(firstId, { notes: 'Ready for pickup', photo: '/api/photos/uploaded-2.jpg' })
  const recovered = await createPhotoBatchQueue(persistence.storage).load()
  assert.equal(recovered.entries.length, 2, 'uploading bytes does not acknowledge or remove an observation')
  const entry = recovered.entries.find(entry => entry.id === firstId)
  assert.equal(entry.photo, '/api/photos/uploaded-2.jpg')
  assert.equal(entry.notes, 'Ready for pickup')
  assert.equal(recovered.entries.find(entry => entry.id !== firstId).notes, 'Moved outside')
  assert.equal(entry.file.name, original.name)
  assert.equal(entry.file.lastModified, original.lastModified)
  assert.equal(entry.file.type, 'image/heic')
  assert.equal(await hash(entry.file), await hash(original), 'original bytes and embedded metadata are untouched')
  assert.equal(entry.context.helperId, 'griff')
  assert.equal(entry.context.labelCode, 'C-002')
  assert.equal(entry.context.measurementValue, '120')
  assert.equal(entry.context.notes, undefined, 'notes have one authoritative per-photo field')
})

test('duplicate selection detection is scoped to queued filename, byte size and last-modified time', async () => {
  const persistence = disk()
  const queue = createPhotoBatchQueue(persistence.storage)
  const first = await queue.add([photo(), photo(), photo('different-name.HEIC'), photo('IMG_1930.HEIC', 123)])
  assert.equal(first.entries.length, 3)
  assert.equal(first.duplicateCount, 1)
  const repeated = await queue.add([photo()])
  assert.equal(repeated.addedIds.length, 0)
  assert.equal(repeated.duplicateCount, 1)
  await queue.remove([first.addedIds[0]])
  const later = await queue.add([photo()])
  assert.equal(later.addedIds.length, 1, 'there is no authoritative/global media deduplication')
})

test('large selections report the queue limit without discarding the existing queue', async () => {
  const queue = createPhotoBatchQueue(disk().storage)
  const first = await queue.add([photo('already-selected.HEIC')])
  const next = await queue.add(Array.from({ length: MAX_PHOTO_BATCH_FILES + 3 }, (_, index) => photo(`${index}.HEIC`)))
  assert.equal(next.entries.length, MAX_PHOTO_BATCH_FILES)
  assert.equal(next.addedIds.length, MAX_PHOTO_BATCH_FILES - 1)
  assert.equal(next.limitCount, 4)
  assert.ok(next.entries.some(entry => entry.id === first.addedIds[0]))
})

test('quota failures keep original files usable in memory and report the lack of durable saving', async () => {
  const persistence = disk()
  persistence.failWrite(true)
  const queue = createPhotoBatchQueue(persistence.storage)
  const added = await queue.add([photo()])
  assert.equal(added.persistence, 'memory-only')
  assert.match(added.error, /storage is full/i)
  assert.equal(persistence.records.size, 0)
  assert.equal(await hash(added.entries[0].file), await hash(photo()))
  await queue.update(added.addedIds[0], { photo: '/api/photos/already-uploaded.jpg' })
  persistence.failWrite(false)
  const retried = await queue.load()
  assert.equal(retried.persistence, 'saved')
  assert.equal(retried.error, '')
  const recovered = await createPhotoBatchQueue(persistence.storage).load()
  assert.equal(recovered.entries[0].id, added.addedIds[0])
  assert.equal(recovered.entries[0].photo, '/api/photos/already-uploaded.jpg')
})

test('a failed initial read does not overwrite older drafts when storage recovers', async () => {
  const persistence = disk()
  const older = await createPhotoBatchQueue(persistence.storage).add([photo('older.HEIC')])
  persistence.failRead(true)
  const queue = createPhotoBatchQueue(persistence.storage)
  const duringFailure = await queue.add([photo('newer.HEIC')])
  assert.equal(duringFailure.persistence, 'memory-only')
  assert.equal(persistence.records.size, 1)
  persistence.failRead(false)
  const recovered = await queue.load()
  assert.equal(recovered.persistence, 'saved')
  assert.deepEqual(new Set(recovered.entries.map(entry => entry.id)), new Set([...older.addedIds, ...duringFailure.addedIds]))
})

test('a failed removal is retried atomically and cannot silently resurrect a completed entry in the current session', async () => {
  const persistence = disk()
  const queue = createPhotoBatchQueue(persistence.storage)
  const added = await queue.add([photo()])
  persistence.failWrite(true)
  const failed = await queue.remove(added.addedIds)
  assert.equal(failed.entries.length, 0)
  assert.equal(failed.persistence, 'memory-only')
  assert.equal(persistence.records.size, 1)
  persistence.failWrite(false)
  const retried = await queue.load()
  assert.equal(retried.persistence, 'saved')
  assert.equal((await createPhotoBatchQueue(persistence.storage).load()).entries.length, 0)
})

test('the API waits for commit, serializes overlapping operations and does not permit identity or file replacement', async () => {
  const persistence = disk()
  let commit
  const waiting = new Promise(resolve => { commit = resolve })
  const queue = createPhotoBatchQueue({
    read: persistence.storage.read,
    async write(puts, ids) { await waiting; return persistence.storage.write(puts, ids) },
  })
  let returned = false
  const adding = queue.add([photo()]).then(result => { returned = true; return result })
  const loading = queue.load()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(returned, false, 'saved state must wait for the storage transaction')
  commit()
  const added = await adding
  assert.deepEqual((await loading).entries.map(entry => entry.id), added.addedIds)
  const updated = await queue.update(added.addedIds[0], { id: 'replacement', file: photo('other.HEIC'), fileName: 'other.HEIC', notes: 'New note' })
  assert.equal(updated.entries[0].id, added.addedIds[0])
  assert.equal(updated.entries[0].fileName, 'IMG_1930.HEIC')
  assert.equal(updated.entries[0].notes, 'New note')
})

test('callers cannot mutate returned metadata or shared initialization objects', async () => {
  const queue = createPhotoBatchQueue(disk().storage)
  const context = { location: 'Garage' }
  const pending = queue.add([photo()], context)
  context.location = 'Changed by caller'
  const added = await pending
  added.entries[0].context.location = 'Changed in result'
  added.entries.length = 0
  const loaded = await queue.load()
  assert.equal(loaded.entries.length, 1)
  assert.equal(loaded.entries[0].context.location, 'Garage')
})

test('selection order survives storage key ordering when all recorded times are identical', async t => {
  t.mock.method(Date, 'now', () => 1789212345678)
  const persistence = disk()
  const queue = createPhotoBatchQueue(persistence.storage)
  const names = ['zebra.HEIC', 'apple.HEIC', 'middle.HEIC']
  const added = await queue.add(names.map(name => photo(name)))
  assert.equal(new Set(added.entries.map(entry => entry.createdAt)).size, 1, 'recorded time is not fabricated to order photos')
  const outOfOrderStorage = {
    ...persistence.storage,
    read: async () => (await persistence.storage.read()).reverse(),
  }
  const reopened = createPhotoBatchQueue(outOfOrderStorage)
  const restored = await reopened.load()
  assert.deepEqual(restored.entries.map(entry => entry.fileName), names)
  assert.deepEqual(restored.entries.map(entry => entry.id), added.addedIds)
  await reopened.add([photo('last.HEIC')])
  const restoredAgain = await createPhotoBatchQueue(outOfOrderStorage).load()
  assert.deepEqual(restoredAgain.entries.map(entry => entry.fileName), [...names, 'last.HEIC'])
  assert.equal(new Set(restoredAgain.entries.map(entry => entry.createdAt)).size, 1)
})

test('older drafts without queue order remain readable and precede newly selected photos', async () => {
  const persistence = disk()
  const added = await createPhotoBatchQueue(persistence.storage).add([photo('older.HEIC'), photo('newer.HEIC')])
  for (const [index, entry] of [...persistence.records.values()].entries()) {
    delete entry.queueOrder
    entry.createdAt = 1000 + index
  }
  const storage = { ...persistence.storage, read: async () => (await persistence.storage.read()).reverse() }
  const reopened = createPhotoBatchQueue(storage)
  const restored = await reopened.load()
  assert.equal(restored.persistence, 'saved')
  assert.deepEqual(restored.entries.map(entry => entry.id), added.addedIds)
  const appended = await reopened.add([photo('last.HEIC')])
  assert.deepEqual(appended.entries.map(entry => entry.fileName), ['older.HEIC', 'newer.HEIC', 'last.HEIC'])
})
