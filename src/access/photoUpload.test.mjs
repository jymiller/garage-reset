import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createHash } from 'node:crypto'
import { createOriginalPhotoService, handleOriginalPhotoOperation } from '../../server/photo-originals.mjs'
import { photoFormat } from '../../server/app.mjs'

const code = ts.transpileModule(await fs.readFile(new URL('./photoUpload.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { uploadOriginalPhoto } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xd9])
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

function setup(t, { lostFinish = false } = {}) {
  const objects = new Map(), calls = []
  const service = createOriginalPhotoService({ photoFormat, storage: {
    async read(key) { const bytes = objects.get(key); return bytes ? { bytes } : null },
    async write(key, bytes) { if (objects.has(key)) throw new Error('Exists'); objects.set(key, Buffer.from(bytes)) },
    async remove(keys) { keys.forEach(key => objects.delete(key)) },
  } })
  const old = { fetch: globalThis.fetch, Image: globalThis.Image, document: globalThis.document }
  t.after(() => Object.assign(globalThis, old))
  globalThis.Image = class { async decode() { throw new Error('HEIC decode unavailable') } }
  globalThis.document = { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ fillRect() {}, fillText() {} }),
    toBlob: callback => callback(new Blob([JPEG], { type: 'image/jpeg' })),
  }) }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/photos')
    assert.equal(options.credentials, 'same-origin')
    const headers = Object.fromEntries(Object.entries(options.headers).map(([key, value]) => [key.toLowerCase(), value]))
    const operation = headers['x-garage-photo-operation']
    calls.push(operation)
    const bytes = typeof options.body === 'string' ? Buffer.from(options.body) : Buffer.from(await options.body.arrayBuffer())
    const result = await handleOriginalPhotoOperation({ operation, headers, readBytes: async () => bytes, service })
    if (lostFinish && operation === 'finish') { lostFinish = false; throw new TypeError('Lost response after successful save') }
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
  }
  return { objects, calls, service }
}

test('HEIC browser decode failure still uploads exact selected bytes, with a distinct unavailable-preview record', async t => {
  const { objects, calls, service } = setup(t, { lostFinish: true })
  const bytes = Buffer.alloc(5 * 1024 * 1024 + 20, 55)
  bytes.writeUInt32BE(24, 0); bytes.write('ftypheic', 4); bytes.writeUInt32BE(0, 12); bytes.write('mif1heic', 16)
  bytes.writeUInt32BE(bytes.length - 24, 24); bytes.write('meta', 28)
  bytes.write('untouched embedded metadata', 100)
  const file = new File([bytes], 'original.HEIC', { type: 'image/heic', lastModified: 123456 })
  const url = await uploadOriginalPhoto(file)
  const original = await service.read(url.split('/').at(-1), 'original')
  assert.equal(hash(original.bytes), hash(bytes))
  assert.equal(original.metadata.original.fileLastModified, 123456)
  assert.equal(original.metadata.preview.kind, 'unavailable')
  assert.equal(calls.filter(operation => operation === 'finish').length, 2)
  assert.equal([...objects.keys()].filter(key => key.startsWith('garage/photos/')).length, 1)
  const count = calls.length
  assert.equal(await uploadOriginalPhoto(file), url)
  assert.deepEqual(calls.slice(count), ['begin'])
})

test('oversized and empty originals fail before any network request or conversion', async t => {
  const { calls } = setup(t)
  await assert.rejects(uploadOriginalPhoto(new File([], 'empty.jpg', { type: 'image/jpeg' })), /up to 50 MB/)
  await assert.rejects(uploadOriginalPhoto(new File([new Uint8Array(50 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' })), /up to 50 MB/)
  assert.equal(calls.length, 0)
})
