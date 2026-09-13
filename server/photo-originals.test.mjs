import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { createGarageServer, photoFormat } from './app.mjs'
import { createVercelHandler } from './vercel.mjs'
import { createOriginalPhotoService, originalUploadMetadata, originalPhotoFormat, ORIGINAL_LIMIT, UPLOAD_CHUNK_BYTES } from './photo-originals.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xd9])
const makeHeic = size => {
  const bytes = Buffer.alloc(size, 67)
  bytes.writeUInt32BE(24, 0); bytes.write('ftypheic', 4); bytes.writeUInt32BE(0, 12); bytes.write('mif1heic', 16)
  bytes.writeUInt32BE(size - 24, 24); bytes.write('meta', 28)
  bytes.write('EXIF:fixture-original-date-orientation-location-and-unknown-metadata', 40)
  return bytes
}
const source = (original, preview = JPEG, changes = {}) => ({ filename: 'IMG_test.HEIC', contentType: 'image/heic', size: original.length,
  lastModified: 1700000000000, sha256: hash(original), preview: { size: preview.length, sha256: hash(preview), kind: 'unavailable' }, ...changes })
function memoryStorage() {
  const objects = new Map()
  return { objects,
    async read(key, { limit = Infinity } = {}) {
      const bytes = objects.get(key)
      if (!bytes) return null
      if (bytes.length > limit) throw new Error('Over limit')
      return { bytes: Buffer.from(bytes), etag: hash(bytes) }
    },
    async write(key, bytes, { createOnly }) {
      assert.equal(createOnly, true)
      if (objects.has(key)) throw new Error('Precondition failed')
      objects.set(key, Buffer.from(bytes))
    },
    async remove(keys) { for (const key of keys) objects.delete(key) },
  }
}
async function addParts(service, id, original, preview = JPEG) {
  for (const [component, bytes] of [['original', original], ['preview', preview]]) {
    for (let offset = 0, part = 0; offset < bytes.length; offset += UPLOAD_CHUNK_BYTES, part++) {
      const chunk = bytes.subarray(offset, offset + UPLOAD_CHUNK_BYTES)
      await service.chunk(id, component, String(part), chunk, hash(chunk))
    }
  }
}

test('HEIC source bytes and metadata survive separate preview creation, finalize retries and chunk cleanup', async () => {
  const original = makeHeic(UPLOAD_CHUNK_BYTES + 500), storage = memoryStorage()
  const service = createOriginalPhotoService({ storage, photoFormat })
  const info = source(original), first = await service.begin(info), repeated = await service.begin(info)
  assert.equal(first.id, repeated.id)
  await addParts(service, first.id, original)
  const result = await service.finish(first.id)
  assert.equal(result.originalSaved, true)
  assert.match(result.url, /^\/api\/photos\/[a-f0-9]{64}\.jpg$/)
  const stored = await service.read(result.url.split('/').at(-1), 'original')
  assert.deepEqual(stored.bytes, original)
  assert.equal(stored.metadata.original.sha256, hash(original))
  assert.equal(stored.metadata.original.filename, 'IMG_test.HEIC')
  assert.equal(stored.metadata.original.fileLastModified, info.lastModified)
  assert.equal(stored.metadata.original.contentType, 'image/heic')
  assert.equal(stored.metadata.preview.kind, 'unavailable')
  assert.equal(Object.hasOwn(stored.metadata.original, 'capturedAt'), false)
  assert.equal([...storage.objects.keys()].filter(key => /\/(original|preview)-[0-9]+$/.test(key)).length, 0)
  const count = storage.objects.size
  assert.deepEqual(await service.finish(first.id), result)
  assert.equal(storage.objects.size, count)
  assert.equal((await service.begin(info)).originalSaved, true)
})

test('concurrent finalize succeeds even when another request has removed completed chunks', async () => {
  const original = makeHeic(120), storage = memoryStorage()
  const service = createOriginalPhotoService({ storage, photoFormat }), { id } = await service.begin(source(original))
  await addParts(service, id, original)
  const read = storage.read.bind(storage)
  let release, markBlocked, blockOnce = true
  const released = new Promise(resolve => { release = resolve })
  const blocked = new Promise(resolve => { markBlocked = resolve })
  storage.read = async (key, options) => {
    if (key.endsWith('/original-0') && blockOnce) { blockOnce = false; markBlocked(); await released }
    return read(key, options)
  }
  const slow = service.finish(id)
  await blocked
  const fast = await service.finish(id)
  release()
  assert.deepEqual(await slow, fast)
})

test('incomplete, corrupted and invalid-signature originals cannot produce a completed photo', async () => {
  const storage = memoryStorage(), service = createOriginalPhotoService({ storage, photoFormat }), original = makeHeic(120)
  const { id } = await service.begin(source(original))
  await assert.rejects(service.finish(id), /parts are missing/)
  await assert.rejects(service.chunk(id, 'original', '0', original.subarray(1)), /Incomplete photo part/)
  await assert.rejects(service.chunk(id, '../original', '0', original), /Invalid photo part/)
  await assert.rejects(service.chunk('../photos', 'original', '0', original), /Invalid photo upload/)
  const corrupt = Buffer.from(original); corrupt[100] ^= 1
  await assert.rejects(service.chunk(id, 'original', '0', corrupt, hash(original)), /did not arrive intact/)
  await addParts(service, id, corrupt)
  await assert.rejects(service.finish(id), /did not arrive intact/)
  assert.equal([...storage.objects.keys()].some(key => key.startsWith('garage/photo-originals/')), false)
  const notImage = Buffer.from('This is an executable renamed to HEIC.')
  const wrong = await service.begin(source(notImage))
  await addParts(service, wrong.id, notImage)
  await assert.rejects(service.finish(wrong.id), /Choose a JPEG/)
  assert.equal([...storage.objects.keys()].some(key => key.startsWith('garage/photos/')), false)
})

test('original metadata limits reject excessive sizes, ambiguous names and fabricated preview formats', () => {
  const info = source(makeHeic(120))
  for (const patch of [{ size: ORIGINAL_LIMIT + 1 }, { size: 0 }, { size: 1.5 }, { filename: '../photo.HEIC' }, { filename: 'a\r\nb.HEIC' },
    { sha256: '../path' }, { lastModified: -1 }, { contentType: 'text/html' }, { extra: 1 }, { preview: { ...info.preview, kind: 'original' } }]) {
    assert.throws(() => originalUploadMetadata({ ...info, ...patch }), /Invalid original photo information/)
  }
  assert.equal(originalPhotoFormat(makeHeic(120), photoFormat), 'heic')
  const truncated = makeHeic(120).subarray(0, 119)
  assert.equal(originalPhotoFormat(truncated, photoFormat), null)
  const renamedVideo = makeHeic(120); renamedVideo.write('mp42', 8); renamedVideo.write('mp42isom', 16)
  assert.equal(originalPhotoFormat(renamedVideo, photoFormat), null)
  assert.equal(originalPhotoFormat(Buffer.from('IMG.jpg'), photoFormat), null)
})

for (const adapter of ['local', 'vercel']) {
  test(`${adapter}: authenticated chunk requests preserve a >4.5 MB HEIC and expose a separate preview and downloadable original`, async t => {
    const password = 'photo-test-only', authorization = `Basic ${Buffer.from(`garage:${password}`).toString('base64')}`
    let server
    if (adapter === 'local') {
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'garage-original-test-'))
      t.after(() => fs.rm(directory, { recursive: true, force: true }))
      server = await createGarageServer({ dataDir: directory, password, analysis: { queue: async () => null } })
    } else {
      server = http.createServer(createVercelHandler({ storage: memoryStorage(), access: async () => false,
        authorize: req => req.headers.authorization === authorization, analysis: { queue: async () => null }, logError: () => {} }))
    }
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
    const base = `http://127.0.0.1:${server.address().port}`
    const send = (operation, body, headers = {}) => fetch(`${base}/api/photos`, { method: 'POST', headers: {
      authorization, 'x-garage-photo-operation': operation, 'content-type': 'application/json', ...headers }, body })
    const original = makeHeic(5 * 1024 * 1024 + 123), info = source(original)
    const unauthorized = await fetch(`${base}/api/photos`, { method: 'POST', headers: { 'x-garage-photo-operation': 'begin', 'content-type': 'application/json' }, body: JSON.stringify(info) })
    assert.equal(unauthorized.status, 401)
    const rejectedOrigin = await send('begin', JSON.stringify(info), { origin: 'https://unrelated.invalid' })
    assert.equal(rejectedOrigin.status, 403)
    const begin = await send('begin', JSON.stringify(info))
    assert.equal(begin.status, 200)
    const { id } = await begin.json()
    for (const [component, bytes] of [['original', original], ['preview', JPEG]]) {
      for (let offset = 0, part = 0; offset < bytes.length; offset += UPLOAD_CHUNK_BYTES, part++) {
        const result = await send('chunk', bytes.subarray(offset, offset + UPLOAD_CHUNK_BYTES), {
          'content-type': 'application/octet-stream', 'x-garage-upload-id': id, 'x-garage-photo-component': component, 'x-garage-photo-part': String(part), 'x-garage-photo-sha256': hash(bytes.subarray(offset, offset + UPLOAD_CHUNK_BYTES)) })
        assert.equal(result.status, 200, await result.text())
      }
    }
    const finish = await send('finish', JSON.stringify({ id }))
    assert.equal(finish.status, 200)
    const result = await finish.json()
    const preview = await fetch(`${base}${result.url}`, { headers: { authorization } })
    assert.equal(preview.status, 200); assert.deepEqual(Buffer.from(await preview.arrayBuffer()), JPEG)
    const download = await fetch(`${base}${result.originalUrl}`, { headers: { authorization } })
    assert.equal(download.status, 200); assert.match(download.headers.get('content-disposition'), /IMG_test.HEIC/)
    assert.equal(hash(Buffer.from(await download.arrayBuffer())), info.sha256)
    const metadata = await (await fetch(`${base}${result.metadataUrl}`, { headers: { authorization } })).json()
    assert.equal(metadata.original.bytes, original.length)
    assert.equal(metadata.original.contentType, 'image/heic')
    assert.equal((await fetch(`${base}${result.originalUrl}`)).status, 401)
    assert.equal((await fetch(`${base}${result.metadataUrl}`)).status, 401)
    assert.equal((await send('finish', JSON.stringify({ id }))).status, 200)
  })
}
