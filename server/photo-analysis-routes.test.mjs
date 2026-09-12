import assert from 'node:assert/strict'
import { test } from 'node:test'
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createGarageServer } from './app.mjs'
import { createVercelHandler } from './vercel.mjs'
import { createPhotoAnalysisService, createAnalysisFileStorage } from './photo-analysis.mjs'
import { validateAnalysisRecord } from '../src/analysis/contract.mjs'

const WORKSPACE_KEY = 'garage/workspace.json'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVXcAAAAASUVORK5CYII=', 'base64')
const PASSWORD = 'analysis-route-test-only'
const WORKSPACE = Buffer.from(JSON.stringify({ revision: 7, data: { schemaVersion: 1, crates: [], items: [], baselineLocked: false, notes: 'Keep the real inventory separate from AI suggestions.' } }))
const result = () => ({ summary: 'A closed storage crate.', objects: [{ id: 'object-1', name: 'Storage crate', category: 'container', quantity: 1, confidence: 'medium', evidence: 'A plastic box with a lid is visible.', region: null, readableLabel: null, suggestedCrateId: null, locationHint: 'Beside a shelf' }], questions: ['What is inside the crate?'] })
const record = (status = 'queued', photoFilename = 'one.png') => ({ version: 1, photoFilename, sourceSha256: 'a'.repeat(64), analysisVersion: 'garage-photo-v1', model: 'openai/gpt-4.1-mini', status, createdAt: 1000, updatedAt: 1001, attempts: status === 'queued' ? 0 : 1, leaseId: status === 'processing' ? 'lease-one' : null, leaseUntil: status === 'processing' ? 91001 : null, errorCode: status === 'failed' ? 'provider_unavailable' : null, result: status === 'complete' ? result() : null })

function memoryStorage() {
  let sequence = 0
  const objects = new Map(), writes = []
  const seed = (key, bytes, contentType = 'application/json') => objects.set(key, { bytes: Buffer.from(bytes), etag: `"${++sequence}"`, contentType })
  return {
    objects, writes, seed,
    async read(key) { const value = objects.get(key); return value ? { ...value, bytes: Buffer.from(value.bytes) } : null },
    async write(key, bytes, options) {
      const current = objects.get(key)
      if (options.createOnly ? Boolean(current) : !current || current.etag !== options.ifMatch) throw new Error('Test storage precondition failed.')
      writes.push(key); seed(key, bytes, options.contentType)
    },
  }
}

async function closeServer(server) {
  if (!server.listening) return
  server.closeAllConnections()
  if (server.closeGarage) { await server.closeGarage(); return }
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}

async function fixture(t, adapter, analysisFactory) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'garage-analysis-route-'))
  const dataDir = path.join(temporary, 'private')
  await fs.mkdir(path.join(dataDir, 'photos'), { recursive: true })
  await fs.writeFile(path.join(dataDir, 'workspace.json'), WORKSPACE)
  await fs.writeFile(path.join(dataDir, 'photos', 'one.png'), PNG)
  const storage = memoryStorage()
  storage.seed(WORKSPACE_KEY, WORKSPACE)
  storage.seed('garage/photos/one.png', PNG, 'image/png')
  const analysisStorage = adapter === 'Node' ? createAnalysisFileStorage(dataDir) : storage
  const calls = { reads: [], queues: [] }
  const service = analysisFactory ? analysisFactory(analysisStorage) : {
    async get(photo) { calls.reads.push(photo); return null },
    async queue(photo, bytes) { calls.queues.push({ photo, bytes }); return record('queued', photo) },
  }
  const headers = adapter === 'Node'
    ? { authorization: `Basic ${Buffer.from(`garage:${PASSWORD}`).toString('base64')}` }
    : { 'x-test-access': 'yes' }
  const server = adapter === 'Node'
    ? await createGarageServer({ root: temporary, dataDir, password: PASSWORD, analysis: service })
    : http.createServer(createVercelHandler({ storage, analysis: service, authorize: request => request.headers['x-test-access'] === 'yes', access: async () => false, logError: () => {} }))
  t.after(async () => { try { await closeServer(server) } finally { await fs.rm(temporary, { recursive: true, force: true }) } })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  const request = (route, options = {}, authorized = true) => fetch(`${origin}${route}`, { ...options, headers: { ...(authorized ? headers : {}), ...options.headers } })
  const retry = (photo = 'one.png', options = {}, authorized = true) => request('/api/analysis/retry', { method: 'POST', body: JSON.stringify({ photo }), ...options, headers: { 'content-type': 'application/json', ...options.headers } }, authorized)
  const assertWorkspaceUnchanged = async () => {
    assert.deepEqual(await fs.readFile(path.join(dataDir, 'workspace.json')), WORKSPACE)
    assert.deepEqual(storage.objects.get(WORKSPACE_KEY).bytes, WORKSPACE)
    assert.equal(storage.writes.includes(WORKSPACE_KEY), false)
    assert.deepEqual(await (await request('/api/workspace')).json(), JSON.parse(WORKSPACE))
  }
  return { request, retry, service, calls, storage, origin, dataDir, assertWorkspaceUnchanged }
}

for (const adapter of ['Node', 'Vercel']) {
  test(`${adapter}: analysis routes require authorization before accessing media`, async t => {
    const f = await fixture(t, adapter)
    for (const response of [await f.request('/api/analysis?photo=one.png', {}, false), await f.retry('one.png', {}, false)]) {
      assert.equal(response.status, 401)
      assert.match(response.headers.get('cache-control'), /no-store/)
      assert.doesNotMatch(await response.text(), /sourceSha256|Storage crate/)
    }
    assert.deepEqual(f.calls, { reads: [], queues: [] })
    await f.assertWorkspaceUnchanged()
  })

  test(`${adapter}: reading an old photo returns null without queueing or writing workspace`, async t => {
    const f = await fixture(t, adapter)
    const response = await f.request('/api/analysis?photo=one.png')
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /application\/json/)
    assert.match(response.headers.get('cache-control'), /no-store/)
    assert.deepEqual(await response.json(), { analysis: null })
    assert.deepEqual(f.calls, { reads: ['one.png'], queues: [] })
    assert.deepEqual(f.storage.writes, [])
    await f.assertWorkspaceUnchanged()
  })

  test(`${adapter}: invalid filenames and duplicate photo parameters never reach analysis`, async t => {
    const f = await fixture(t, adapter)
    for (const photo of ['', '../workspace.json', '/api/photos/one.png', 'https://example.test/one.png', 'one.png?private=token', 'sub/one.png', 'one.svg', 'a'.repeat(129) + '.jpg']) {
      assert.equal((await f.request(`/api/analysis?photo=${encodeURIComponent(photo)}`)).status, 400, photo)
      assert.equal((await f.retry(photo)).status, 400, photo)
    }
    assert.equal((await f.request('/api/analysis')).status, 400)
    assert.equal((await f.request('/api/analysis?photo=one.png&photo=other.png')).status, 400)
    assert.deepEqual(f.calls, { reads: [], queues: [] })
    await f.assertWorkspaceUnchanged()
  })

  test(`${adapter}: unsupported methods and cross-origin retries are rejected`, async t => {
    const f = await fixture(t, adapter)
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
      const response = await f.request('/api/analysis?photo=one.png', { method })
      assert.equal(response.status, 405)
      assert.equal(response.headers.get('allow'), 'GET')
    }
    for (const method of ['GET', 'PUT', 'DELETE', 'HEAD']) {
      const response = await f.request('/api/analysis/retry', { method })
      assert.equal(response.status, 405)
      assert.equal(response.headers.get('allow'), 'POST')
    }
    assert.equal((await f.retry('one.png', { headers: { origin: 'https://other.example' } })).status, 403)
    assert.deepEqual(f.calls, { reads: [], queues: [] })
    await f.assertWorkspaceUnchanged()
  })

  test(`${adapter}: retry accepts only one bounded JSON photo field`, async t => {
    const f = await fixture(t, adapter)
    for (const body of ['{', 'null', '[]', '"one.png"', '{}', '{"photo":7}', '{"photo":"one.png","result":{"summary":"invented"}}', '{"photo":"one.png","providerUrl":"https://example.test"}']) {
      assert.equal((await f.retry('one.png', { body })).status, 400, body)
    }
    assert.equal((await f.retry('one.png', { headers: { 'content-type': 'text/plain' } })).status, 415)
    assert.equal((await f.retry('one.png', { body: JSON.stringify({ photo: 'a'.repeat(1500) }) })).status, 413)
    assert.equal((await f.retry('one.png', { headers: { 'content-encoding': 'gzip' } })).status, 415)
    assert.deepEqual(f.calls, { reads: [], queues: [] })
    await f.assertWorkspaceUnchanged()
  })

  test(`${adapter}: queued, processing, complete, and failed API results satisfy the shared contract`, async t => {
    let next = record()
    const f = await fixture(t, adapter, () => ({ get: async () => next, queue: async () => next }))
    for (const status of ['queued', 'processing', 'complete', 'failed']) {
      next = record(status)
      const get = await f.request('/api/analysis?photo=one.png')
      assert.equal(get.status, 200)
      const read = (await get.json()).analysis
      assert.equal(validateAnalysisRecord(read), true)
      assert.deepEqual(read, next)
      const retry = await f.retry()
      assert.equal(retry.status, ['queued', 'processing'].includes(status) ? 202 : 200)
      const retried = (await retry.json()).analysis
      assert.equal(validateAnalysisRecord(retried), true)
      assert.deepEqual(retried, next)
    }
    await f.assertWorkspaceUnchanged()
  })

  test(`${adapter}: upload stays201 and photo remains readable if queue storage fails`, async t => {
    const attempts = []
    const f = await fixture(t, adapter, () => ({
      get: async () => null,
      queue: async (photo, bytes) => { attempts.push({ photo, bytes }); throw new Error('private provider diagnostic must not be returned') },
    }))
    const response = await f.request('/api/photos', { method: 'POST', headers: { 'content-type': 'image/png' }, body: PNG })
    assert.equal(response.status, 201)
    const uploaded = await response.json()
    assert.equal(uploaded.analysis, null)
    assert.equal(uploaded.src, uploaded.url)
    assert.match(uploaded.filename, /^[a-f0-9-]+\.png$/)
    assert.equal(uploaded.url, `/api/photos/${uploaded.filename}`)
    assert.equal(attempts.length, 1)
    assert.equal(attempts[0].photo, uploaded.filename)
    assert.deepEqual(attempts[0].bytes, PNG)
    const image = await f.request(uploaded.url)
    assert.equal(image.status, 200)
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), PNG)
    assert.equal((await f.request(uploaded.url, {}, false)).status, 401)
    await f.assertWorkspaceUnchanged()
  })

  test(`${adapter}: uploaded photo receives a durable analysis record without adding inventory`, async t => {
    const messages = []
    const f = await fixture(t, adapter, storage => createPhotoAnalysisService({ storage, configured: () => true, enqueue: async message => messages.push(message), analyze: async () => result() }))
    const response = await f.request('/api/photos', { method: 'POST', headers: { 'content-type': 'image/png' }, body: PNG })
    assert.equal(response.status, 201)
    const uploaded = await response.json()
    assert.equal(validateAnalysisRecord(uploaded.analysis), true)
    assert.equal(uploaded.analysis.photoFilename, uploaded.filename)
    assert.equal(uploaded.analysis.status, 'queued')
    assert.equal(messages.length, 1)
    await f.service.process(uploaded.filename)
    const read = (await (await f.request(`/api/analysis?photo=${uploaded.filename}`)).json()).analysis
    assert.equal(validateAnalysisRecord(read), true)
    assert.equal(read.status, 'complete')
    assert.deepEqual(read.result, result())
    const retry = await f.retry(uploaded.filename)
    assert.equal(retry.status, 200)
    assert.deepEqual((await retry.json()).analysis, read)
    assert.equal(messages.length, 1, 'Completed retries do not submit a second analysis.')
    assert.equal((await f.retry('missing.png')).status, 404)
    await f.assertWorkspaceUnchanged()
  })
}

test('Vercel rewrite query routes preserve analysis access and validation', async t => {
  const f = await fixture(t, 'Vercel')
  assert.deepEqual(await (await f.request('/api/garage?route=analysis&photo=one.png')).json(), { analysis: null })
  const retry = await f.request('/api/garage?route=analysis-retry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ photo: 'one.png' }) })
  assert.equal(retry.status, 202)
  assert.equal(validateAnalysisRecord((await retry.json()).analysis), true)
  assert.equal((await f.request('/api/garage?route=analysis&photo=one.png&photo=other.png')).status, 400)
  assert.equal((await f.request('/api/garage?route=analysis&photo=one.png', {}, false)).status, 401)
  await f.assertWorkspaceUnchanged()
})
