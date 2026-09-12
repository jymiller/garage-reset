import assert from 'node:assert/strict'
import { test } from 'node:test'
import http from 'node:http'
import { createBlobStorage, createVercelHandler } from './vercel.mjs'
import { handleAccess, isAuthorized } from './access.mjs'
import { defaultRewards, assignMission, approveMission, markMissionPaid } from '../src/rewards/contract.mjs'

const WORKSPACE_KEY = 'garage/workspace.json'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVXcAAAAASUVORK5CYII=', 'base64')
const empty = () => ({ schemaVersion: 1, crates: [], items: [], baselineLocked: false, notes: '' })
const workspace = (notes = '') => ({ ...empty(), notes })
const headers = { 'x-test-access': 'yes' }
const rewardMission = (id = 'mission-one') => ({ id, title: 'One shelf', area: 'Right rack', kind: 'shelf', crateId: null,
  phase: 'complete', beforePhoto: '/api/photos/before.jpg', afterPhoto: '/api/photos/after.jpg', plannedMinutes: 10,
  elapsedSeconds: 100, runningSince: null, createdAt: 1000, completedAt: 2000, kept: 0, bagged: 0,
  donated: 0, ask: 0, summary: 'Grouped the shelf contents.', parkingClear: true })

function fakeStorage() {
  const objects = new Map(), writes = []
  let sequence = 0, barrier = null
  const storage = {
    objects, writes,
    seed(key, bytes, contentType = 'application/json') {
      objects.set(key, { bytes: Buffer.from(bytes), etag: `"${++sequence}"`, contentType })
    },
    synchronizeReads(count = 2) {
      let release
      barrier = { count, ready: new Promise(resolve => { release = resolve }), release }
    },
    async read(key) {
      const stored = objects.get(key)
      const snapshot = stored ? { ...stored, bytes: Buffer.from(stored.bytes) } : null
      if (barrier && key === WORKSPACE_KEY) {
        const current = barrier
        current.count -= 1
        if (current.count === 0) { barrier = null; current.release() }
        await current.ready
      }
      return snapshot
    },
    async write(key, bytes, options) {
      const current = objects.get(key)
      if (options.createOnly ? Boolean(current) : !current || current.etag !== options.ifMatch) {
        throw new Error('Atomic storage precondition failed')
      }
      writes.push({ key, options: { ...options } })
      storage.seed(key, bytes, options.contentType)
    },
  }
  return storage
}

async function fixture(t, overrides = {}) {
  const storage = overrides.storage ?? fakeStorage()
  const handler = createVercelHandler({ storage, authorize: req => req.headers['x-test-access'] === 'yes', access: async () => false, ...overrides })
  const server = http.createServer(handler)
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
    server.closeAllConnections()
  }))
  const base = `http://127.0.0.1:${server.address().port}/api/garage`
  const get = (route = 'workspace', extra = {}) => fetch(`${base}?route=${route}`, { headers, ...extra })
  const put = (revision, data, extra = {}) => get('workspace', {
    method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ revision, data }), ...extra,
  })
  return { storage, base, get, put }
}

test('access handler runs before authorization and private API routes fail closed', async t => {
  let accessCalls = 0, authCalls = 0
  const { get, storage } = await fixture(t, {
    access: async (req, res) => {
      accessCalls++
      if (new URL(req.url, 'http://local').searchParams.get('route') !== 'access') return false
      res.end('{"authorized":false}'); return true
    },
    authorize: () => { authCalls++; return false },
  })
  assert.equal((await get('access')).status, 200)
  assert.equal(authCalls, 0)
  for (const route of ['workspace', 'photos', 'photo&name=one.png', 'evidence&name=2026-09-09/IMG_1908.jpg']) {
    const response = await get(route)
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('www-authenticate'), null)
    assert.match(response.headers.get('cache-control'), /no-store/)
  }
  assert.equal(accessCalls, 5)
  assert.equal(authCalls, 4)
  assert.equal(storage.writes.length, 0)
})

test('Blob rewards persist across handlers and CAS protects duplicate approvals, payments and ledger history', async t => {
  const first = await fixture(t)
  const data = assignMission({ ...empty(), missions: [rewardMission()], rewards: defaultRewards(1000) }, 'mission-one', 'griff')
  assert.equal((await first.put(0, data)).status, 200)
  const second = await fixture(t, { storage: first.storage })
  const dropped = { ...data }; delete dropped.rewards
  assert.equal((await second.put(0, dropped)).status, 409)
  assert.equal((await second.put(1, dropped)).status, 400)
  const approved = approveMission(data, 'mission-one', 3000)
  first.storage.synchronizeReads(2)
  const approvals = await Promise.all([first.put(1, approved), second.put(1, approved)])
  assert.deepEqual(approvals.map(response => response.status).sort(), [200, 409])
  const paid = markMissionPaid(approved, 'mission-one', 4000)
  assert.equal((await second.put(2, paid)).status, 200)
  assert.equal((await first.put(2, paid)).status, 409)
  assert.equal((await first.put(3, approved)).status, 400)
  assert.equal((await first.put(3, { ...paid, missions: [{ ...rewardMission(), summary: 'Changed evidence' }] })).status, 400)
  assert.equal((await first.put(3, { ...paid, rewards: { ...paid.rewards, budgetMode: 'shared' } })).status, 400)
  assert.deepEqual(await (await first.get()).json(), { revision: 3, data: paid })
})

test('Blob validation rejects malformed rewards and payment for a zero-value capped mission', async t => {
  const { put, get } = await fixture(t)
  let data = { ...empty(), missions: Array.from({ length: 11 }, (_, i) => rewardMission(`m${i}`)), rewards: defaultRewards(1000) }
  for (const mission of data.missions) data = assignMission(data, mission.id, 'griff')
  for (let i = 0; i < 11; i++) data = approveMission(data, `m${i}`, 3000 + i)
  assert.equal((await put(0, data)).status, 200)
  const invalidPaid = { ...data, rewards: { ...data.rewards, entries: data.rewards.entries.map(entry => entry.missionId === 'm10' ? { ...entry, paidAt: 4000 } : entry) } }
  assert.equal((await put(1, invalidPaid)).status, 400)
  const duplicated = { ...data, rewards: { ...data.rewards, entries: [...data.rewards.entries, data.rewards.entries[0]] } }
  assert.equal((await put(1, duplicated)).status, 400)
  assert.deepEqual(await (await get()).json(), { revision: 1, data })
})

test('workspace persists without a process cache and stale revisions cannot overwrite it', async t => {
  const first = await fixture(t)
  assert.deepEqual(await (await first.get()).json(), { revision: 0, data: empty() })
  const data = workspace('A saved laptop edit')
  assert.deepEqual(await (await first.put(0, data)).json(), { revision: 1, data })
  const second = await fixture(t, { storage: first.storage })
  assert.deepEqual(await (await second.get()).json(), { revision: 1, data })
  const conflict = await second.put(0, workspace('A stale phone edit'))
  assert.equal(conflict.status, 409)
  assert.deepEqual(await conflict.json(), { revision: 1, data })
  assert.equal((await second.put(1, workspace('Next edit'))).status, 200)
  assert.deepEqual(first.storage.writes.map(write => write.options.createOnly), [true, false])
  assert.equal(first.storage.writes[1].options.ifMatch, '"1"')
})

test('original request paths and the real family cookie authorize the shared API', async t => {
  const key = 'test-only-family-key-at-least-thirty-two-characters'
  const { base, storage } = await fixture(t, { authorize: req => isAuthorized(req, key), access: (req, res) => handleAccess(req, res, { key }) })
  const origin = new URL(base).origin
  assert.equal((await fetch(`${origin}/api/workspace`)).status, 401)
  const access = await fetch(`${origin}/api/access`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ key }) })
  assert.equal(access.status, 200)
  const cookie = access.headers.get('set-cookie').split(';')[0]
  const accepted = { cookie }
  assert.deepEqual(await (await fetch(`${origin}/api/workspace`, { headers: accepted })).json(), { revision: 0, data: empty() })
  const upload = await fetch(`${origin}/api/photos`, { method: 'POST', headers: { ...accepted, 'content-type': 'image/png', origin }, body: PNG })
  const photo = await upload.json()
  assert.equal(upload.status, 201)
  assert.equal((await fetch(`${origin}${photo.url}`, { headers: accepted })).status, 200)
  storage.seed('garage/evidence/2026-09-09/IMG_1908.jpg', PNG, 'image/jpeg')
  assert.equal((await fetch(`${origin}/evidence/2026-09-09/IMG_1908.jpg`, { headers: accepted })).status, 200)
})

test('concurrent initialization and updates use atomic storage preconditions across instances', async t => {
  const storage = fakeStorage()
  const first = await fixture(t, { storage }), second = await fixture(t, { storage })
  for (const revision of [0, 1]) {
    storage.synchronizeReads()
    const edits = [workspace(`Laptop ${revision}`), workspace(`Phone ${revision}`)]
    const responses = await Promise.all([first.put(revision, edits[0]), second.put(revision, edits[1])])
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409])
    const winner = responses.findIndex(response => response.status === 200)
    const expected = { revision: revision + 1, data: edits[winner] }
    for (const response of responses) assert.deepEqual(await response.json(), expected)
    assert.deepEqual(await (await first.get()).json(), expected)
  }
  assert.equal(storage.writes.length, 2)
})

test('a lost storage success response returns the persisted snapshot for safe client recovery', async t => {
  const storage = fakeStorage()
  const write = storage.write.bind(storage)
  storage.write = async (...args) => { await write(...args); throw new Error('Response lost after committed write') }
  const { put, get } = await fixture(t, { storage })
  const data = workspace('Already committed')
  const response = await put(0, data)
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { revision: 1, data })
  assert.deepEqual(await (await get()).json(), { revision: 1, data })
  assert.equal(storage.writes.length, 1)
})

test('invalid records and unsupported methods never replace a saved workspace', async t => {
  const { put, get, storage } = await fixture(t)
  const data = workspace('Preserve this')
  assert.equal((await put(0, data)).status, 200)
  for (const invalid of [{ ...data, spatialItems: null }, { ...data, notes: ' untrimmed' }, { ...data, unknown: true }, { ...data, crates: [{}] }]) {
    assert.equal((await put(1, invalid)).status, 400)
  }
  assert.equal((await put(-1, data)).status, 400)
  assert.equal((await get('workspace', { method: 'DELETE' })).status, 405)
  assert.equal((await get('workspace', { method: 'PUT', body: 'broken json', headers: { ...headers, 'content-type': 'application/json' } })).status, 400)
  assert.equal((await get('workspace', { method: 'PUT', body: '{}', headers })).status, 415)
  assert.deepEqual(await (await get()).json(), { revision: 1, data })
  assert.equal(storage.writes.length, 1)
})

test('storage errors and corrupt stored data return 503 without provider details or false empty state', async t => {
  for (const storage of [
    { read: async () => { const error = new Error('secret provider URL or token'); error.status = 403; throw error }, write: async () => {} },
    { read: async () => ({ bytes: Buffer.from('bad json'), etag: '"tag"' }), write: async () => {} },
    { read: async () => ({ bytes: Buffer.from(JSON.stringify({ revision: 4, data: empty() })), etag: '' }), write: async () => {} },
    { read: async () => null, write: async () => { throw new Error('secret token') } },
  ]) {
    const { get, put } = await fixture(t, { storage })
    const response = await put(0, empty())
    assert.equal(response.status, 503)
    const body = await response.text()
    assert.doesNotMatch(body, /secret|token|provider|https:/)
    assert.ok(body.includes('not been replaced'))
    const read = await get()
    if (read.status === 503) assert.doesNotMatch(await read.text(), /secret|token|provider/)
  }
})

test('requests enforce same-origin writes and workspace/photo byte limits before storage', async t => {
  const { get, base, storage } = await fixture(t)
  for (const extra of [{ origin: 'https://outside.example' }, { origin: 'null' }, { origin: base.replace('http:', 'https:') }, { 'sec-fetch-site': 'cross-site' }]) {
    const response = await get('workspace', { method: 'PUT', headers: { ...headers, 'content-type': 'application/json', ...extra }, body: JSON.stringify({ revision: 0, data: empty() }) })
    assert.equal(response.status, 403)
  }
  const same = await get('workspace', { method: 'PUT', headers: { ...headers, 'content-type': 'application/json', origin: new URL(base).origin }, body: JSON.stringify({ revision: 0, data: empty() }) })
  assert.equal(same.status, 200)
  assert.equal((await get('workspace', { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: ' '.repeat(2 * 1024 * 1024 + 1) })).status, 413)
  assert.equal((await get('photos', { method: 'POST', headers: { ...headers, 'content-type': 'image/png' }, body: Buffer.alloc(3.5 * 1024 * 1024 + 1) })).status, 413)
  assert.equal((await get('photos', { method: 'POST', headers: { ...headers, 'content-encoding': 'gzip' }, body: PNG })).status, 415)
  assert.equal(storage.writes.length, 1)
})

test('photo uploads inspect signatures and expose only protected application URLs', async t => {
  const { get, storage } = await fixture(t)
  const uploaded = await get('photos', { method: 'POST', headers: { ...headers, 'content-type': 'image/png' }, body: PNG })
  assert.equal(uploaded.status, 201)
  const data = await uploaded.json()
  assert.match(data.url, /^\/api\/photos\/[a-f0-9-]+\.png$/)
  assert.equal(data.src, data.url)
  assert.equal(storage.writes[0].key, `garage/photos/${data.filename}`)
  assert.equal(storage.writes[0].options.createOnly, true)
  const image = await get(`photo&name=${data.filename}`)
  assert.equal(image.headers.get('content-type'), 'image/png')
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), PNG)
  const head = await get(`photo&name=${data.filename}`, { method: 'HEAD' })
  assert.equal(head.headers.get('content-length'), String(PNG.length))
  assert.equal((await head.arrayBuffer()).byteLength, 0)
  assert.equal((await get('photos', { method: 'POST', headers: { ...headers, 'content-type': 'image/jpeg' }, body: PNG })).status, 415)
  assert.equal((await get('photos', { method: 'POST', headers, body: 'not an image' })).status, 415)
  assert.equal(storage.writes.length, 1)
})

test('evidence stays inside its prefix and encoded traversal cannot reach workspace or other blobs', async t => {
  const { get, storage } = await fixture(t)
  storage.seed('garage/evidence/2026-09-09/IMG_1908.jpg', PNG, 'image/jpeg')
  storage.seed('other/private.jpg', PNG, 'image/jpeg')
  const image = await get('evidence&name=2026-09-09%2FIMG_1908.jpg')
  assert.equal(image.status, 200)
  assert.equal(image.headers.get('content-type'), 'image/jpeg')
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), PNG)
  for (const name of ['../workspace.json', '../photos/one.jpg', '/other/private.jpg', 'https://example.com/one.jpg', '2026/../../other/private.jpg', '2026\\one.jpg', '.hidden.jpg', 'one.svg', '%2e%2e/private.jpg', 'one.jpg\0']) {
    assert.equal((await get(`evidence&name=${encodeURIComponent(name)}`)).status, 404, name)
    assert.equal((await get(`photo&name=${encodeURIComponent(name)}`)).status, 404, name)
  }
  assert.equal((await get('evidence&name=missing.png')).status, 404)
  assert.equal((await get('photo&name=one.png&name=two.png')).status, 400)
  assert.equal((await get('workspace&route=photo')).status, 400)
})

test('Blob SDK adapter bypasses cache and uses create-only or ETag-conditional private writes', async () => {
  const calls = []
  const sdk = {
    get: async (key, options) => {
      calls.push({ method: 'get', key, options })
      return { statusCode: 200, stream: new Blob([PNG]).stream(), blob: { etag: '"etag"', size: PNG.length, contentType: 'image/png' } }
    },
    put: async (key, bytes, options) => { calls.push({ method: 'put', key, bytes, options }) },
  }
  const storage = createBlobStorage({ loadSdk: async () => sdk, token: () => 'test-only-token' })
  assert.deepEqual((await storage.read('garage/evidence/one.png')).bytes, PNG)
  assert.equal(calls[0].options.useCache, false)
  await storage.write(WORKSPACE_KEY, '{}', { contentType: 'application/json', createOnly: true })
  await storage.write(WORKSPACE_KEY, '{}', { contentType: 'application/json', ifMatch: '"etag"' })
  for (const call of calls) assert.equal(call.options.access, 'private')
  assert.equal(calls[1].options.allowOverwrite, false)
  assert.equal(calls[1].options.addRandomSuffix, false)
  assert.equal(Object.hasOwn(calls[1].options, 'ifMatch'), false)
  assert.equal(calls[2].options.allowOverwrite, true)
  assert.equal(calls[2].options.ifMatch, '"etag"')
  await assert.rejects(storage.write(WORKSPACE_KEY, '{}', { contentType: 'application/json' }), /ETag/)
  await assert.rejects(createBlobStorage({ loadSdk: async () => sdk, token: () => '' }).read(WORKSPACE_KEY), /not configured/)
  await assert.rejects(storage.read(WORKSPACE_KEY, { limit: 1 }), /size limit/)
})

test('preparsed Vercel query and body values retain validation and upload support', async t => {
  const storage = fakeStorage()
  const handler = createVercelHandler({ storage, authorize: () => true, access: async () => false })
  const { get } = await fixture(t, { storage, access: async (req, res) => {
    const url = new URL(req.url, 'http://local')
    const route = url.searchParams.get('route')
    req.query = { route }
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const bytes = Buffer.concat(chunks)
    req.body = req.headers['content-type'] === 'application/json' ? JSON.parse(bytes.toString()) : bytes
    await handler(req, res)
    return true
  } })
  const put = await get('workspace', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: 0, data: empty() }) })
  assert.equal(put.status, 200)
  const photo = await get('photos', { method: 'POST', headers: { 'content-type': 'image/png' }, body: PNG })
  assert.equal(photo.status, 201)
  assert.equal(storage.writes.length, 2)
})
