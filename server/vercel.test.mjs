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
const observation = (changes = {}) => ({
  id: 'observation-one', kind: 'crate', photo: '/api/photos/one.jpg', notes: '', location: '',
  crateId: null, measurement: null, createdAt: 1000, ...changes,
})
const observationMeasurement = (changes = {}) => ({ value: 84.5, unit: 'in', label: 'Between the parking lines', basis: 'user-measured', ...changes })
const photoAward = (changes = {}) => ({ observationId: 'observation-one', helperId: 'griff', points: 25, reviewedAt: 2000, ...changes })
const activityCrate = (changes = {}) => ({ id: 'crate-one', code: 'A01', name: 'Camping', location: '', owner: '',
  capacityLiters: 100, baselineFill: 80, currentFill: 80, status: 'unopened', photo: null, notes: '', createdAt: 1000, ...changes })
const activityItem = (changes = {}) => ({ id: 'item-one', crateId: 'crate-one', name: 'Lantern', quantity: 1,
  decision: 'undecided', destination: '', departed: false, notes: '', ...changes })
const stickerCredit = (changes = {}) => ({ id: 'sticker:C-001:front', kind: 'sticker', helperId: 'griff', points: 25, createdAt: 2000, labelCode: 'C-001', surface: 'front', ...changes })
const inventoryCredit = (changes = {}) => ({ id: 'inventory-one', kind: 'inventory', helperId: 'griff', points: 25, createdAt: 2000, labelCode: 'A01', itemIds: ['item-one'], ...changes })

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
  const handler = createVercelHandler({ storage, authorize: req => req.headers['x-test-access'] === 'yes', access: async () => false, logError: () => {}, ...overrides })
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

test('concurrent sticker and inventory claims award each activity once across function instances', async t => {
  for (const kind of ['sticker', 'inventory']) {
    const first = await fixture(t)
    const rewards = defaultRewards(1000)
    rewards.players.push({ id: 'alex', name: 'Alex', createdAt: 1000 })
    const original = { ...empty(), crates: [activityCrate()], rewards, activityCredits: [] }
    assert.equal((await first.put(0, original)).status, 200)
    const second = await fixture(t, { storage: first.storage })
    first.storage.synchronizeReads(2)
    const make = helperId => ({ ...original, items: kind === 'inventory' ? [activityItem()] : [],
      activityCredits: [kind === 'sticker' ? stickerCredit({ helperId }) : inventoryCredit({ helperId })] })
    const responses = await Promise.all([first.put(1, make('griff')), second.put(1, make('alex'))])
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409])
    const current = await (await first.get()).json()
    assert.equal(current.data.activityCredits.length, 1)
    assert.equal(current.data.activityCredits[0].points, 25)
    assert.deepEqual(await responses.find(response => response.status === 409).json(), current)
    const dropped = { ...current.data }; delete dropped.activityCredits
    const credited = current.data.activityCredits[0]
    for (const candidate of [dropped, { ...current.data, activityCredits: [] },
      { ...current.data, activityCredits: [{ ...credited, helperId: credited.helperId === 'griff' ? 'alex' : 'griff' }] },
      { ...current.data, activityCredits: [{ ...credited, createdAt: 2001 }] }]) {
      const response = await second.put(2, candidate)
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), current)
    }
    const moved = { ...current.data, notes: 'Moved after credit.', crates: [activityCrate({ code: 'Renamed' }), activityCrate({ id: 'crate-two', code: 'B02' })],
      items: current.data.items.map(item => ({ ...item, crateId: 'crate-two', destination: 'Back shelf', decision: 'keep' })) }
    assert.equal((await second.put(2, moved)).status, 200)
    const fresh = await fixture(t, { storage: first.storage })
    assert.deepEqual(await (await fresh.get()).json(), { revision: 3, data: moved })
    assert.deepEqual(moved.rewards.entries, [])
  }
})

test('Blob requires atomic new inventory items and rejects duplicate or malformed receipts', async t => {
  const { put, get, storage } = await fixture(t)
  const data = { ...empty(), crates: [activityCrate()], items: [activityItem()], rewards: defaultRewards(1000) }
  assert.equal((await put(0, data)).status, 200)
  for (const activityCredits of [null, [stickerCredit(), stickerCredit()], [stickerCredit({ helperId: 'missing' })],
    [stickerCredit({ id: 'random' })], [stickerCredit({ surface: 'lid' })], [stickerCredit({ points: 50 })],
    [stickerCredit({ itemIds: [] })], [inventoryCredit({ surface: 'front' })], [inventoryCredit({ itemIds: [] })],
    [inventoryCredit({ itemIds: ['missing'] })], [inventoryCredit({ itemIds: ['item-one', 'item-one'] })]]) {
    assert.equal((await put(1, { ...data, activityCredits })).status, 400)
  }
  for (const candidate of [{ ...data, activityCredits: [inventoryCredit()] },
    { ...data, items: [...data.items, activityItem({ id: 'new-item' })], activityCredits: [inventoryCredit({ itemIds: ['new-item'], labelCode: 'Wrong crate' })] }]) {
    const response = await put(1, candidate)
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { revision: 1, data })
  }
  assert.equal(storage.writes.length, 1)
  const added = { ...data, items: [...data.items, activityItem({ id: 'new-item' })], activityCredits: [inventoryCredit({ itemIds: ['new-item'] })] }
  assert.equal((await put(1, added)).status, 200)
  assert.equal((await put(2, { ...added, activityCredits: [...added.activityCredits, inventoryCredit({ id: 'duplicate', itemIds: ['new-item'] })] })).status, 400)
  assert.equal((await put(2, { ...added, items: data.items })).status, 400)
  assert.deepEqual(await (await get()).json(), { revision: 2, data: added })
})

test('concurrent photo reviews award a photo once and preserve the winner across function instances', async t => {
  const first = await fixture(t)
  const rewards = defaultRewards(1000)
  rewards.players.push({ id: 'alex', name: 'Alex', createdAt: 1000 })
  const original = { ...empty(), rewards, observations: [observation({ kind: 'placement' })] }
  assert.equal((await first.put(0, original)).status, 200)
  const second = await fixture(t, { storage: first.storage })
  first.storage.synchronizeReads(2)
  const responses = await Promise.all([
    first.put(1, { ...original, photoAwards: [photoAward()] }),
    second.put(1, { ...original, photoAwards: [photoAward({ helperId: 'alex' })] }),
  ])
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409])
  const current = await (await first.get()).json()
  assert.equal(current.data.photoAwards.length, 1)
  assert.equal(current.data.photoAwards[0].points, 25)
  assert.deepEqual(await responses.find(response => response.status === 409).json(), current)
  const candidates = [original, { ...current.data, photoAwards: [] },
    { ...current.data, photoAwards: [photoAward({ helperId: current.data.photoAwards[0].helperId === 'griff' ? 'alex' : 'griff' })] },
    { ...current.data, photoAwards: [{ ...current.data.photoAwards[0], reviewedAt: 2001 }] },
    { ...current.data, observations: [observation({ kind: 'placement', photo: '/api/photos/replaced.jpg' })] },
    { ...current.data, observations: [observation({ kind: 'placement', createdAt: 900 })] },
  ]
  for (const candidate of candidates) {
    const response = await second.put(2, candidate)
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), current)
  }
  const described = { ...current.data, observations: [{ ...current.data.observations[0], notes: 'Location corrected.', location: 'Rear rack' }] }
  assert.equal((await second.put(2, described)).status, 200)
  assert.deepEqual(await (await first.get()).json(), { revision: 3, data: described })
  assert.deepEqual(described.rewards, rewards)
  assert.deepEqual(described.rewards.entries, [])
})

test('Blob rejects malformed, orphaned and duplicate photo awards before storage', async t => {
  const { put, get, storage } = await fixture(t)
  const data = { ...empty(), rewards: defaultRewards(1000), observations: [observation()] }
  assert.equal((await put(0, data)).status, 200)
  for (const photoAwards of [null, [photoAward(), photoAward()], [photoAward({ points: 100 })],
    [photoAward({ points: '25' })], [photoAward({ reviewedAt: 999 })], [photoAward({ helperId: 'missing' })],
    [photoAward({ observationId: 'missing' })], [photoAward({ extra: true })]]) {
    assert.equal((await put(1, { ...data, photoAwards })).status, 400)
  }
  assert.deepEqual(await (await get()).json(), { revision: 1, data })
  assert.equal(storage.writes.length, 1)
})

test('Blob general photos round trip without setup and reject unknown kinds without changing the saved photo', async t => {
  const first = await fixture(t)
  const data = { ...empty(), observations: [observation({ kind: 'general' })] }
  assert.equal((await first.put(0, data)).status, 200)
  const second = await fixture(t, { storage: first.storage })
  assert.deepEqual(await (await second.get()).json(), { revision: 1, data })
  const invalid = { ...data, observations: [observation({ kind: 'anything' })] }
  assert.equal((await second.put(1, invalid)).status, 400)
  assert.deepEqual(await (await first.get()).json(), { revision: 1, data })
  assert.equal(first.storage.writes.length, 1)
})

test('Blob quick photos survive fresh handlers and old clients cannot remove whole or partial observations', async t => {
  const first = await fixture(t)
  assert.equal((await first.put(0, empty())).status, 200)
  const data = { ...empty(), observations: [observation(), observation({ id: 'parking', kind: 'parking', measurement: observationMeasurement() })] }
  assert.equal((await first.put(1, data)).status, 200)
  const second = await fixture(t, { storage: first.storage })
  assert.deepEqual(await (await second.get()).json(), { revision: 2, data })
  for (const candidate of [empty(), { ...data, observations: [] }, { ...data, observations: [data.observations[0]] }]) {
    const result = await second.put(2, candidate)
    assert.equal(result.status, 409)
    assert.deepEqual(await result.json(), { revision: 2, data })
  }
  const revised = { ...data, notes: 'Laptop update', observations: data.observations.map(entry => ({ ...entry, location: 'Rear garage' })) }
  assert.equal((await second.put(2, revised)).status, 200)
  assert.deepEqual(await (await first.get()).json(), { revision: 3, data: revised })
  assert.equal(first.storage.writes.length, 3)
})

test('concurrent phone and laptop quick photos use CAS and retain both additions after explicit retry', async t => {
  const first = await fixture(t)
  const original = { ...empty(), observations: [observation()] }
  assert.equal((await first.put(0, original)).status, 200)
  const second = await fixture(t, { storage: first.storage })
  const phone = { ...original, observations: [...original.observations, observation({ id: 'phone', kind: 'parking' })] }
  const laptop = { ...original, observations: [...original.observations, observation({ id: 'laptop', kind: 'measurement' })] }
  first.storage.synchronizeReads(2)
  const responses = await Promise.all([first.put(1, phone), second.put(1, laptop)])
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409])
  const conflict = await responses.find(response => response.status === 409).json()
  const current = await (await first.get()).json()
  assert.deepEqual(conflict, current)
  const missing = conflict.data.observations.some(entry => entry.id === 'phone') ? laptop.observations[1] : phone.observations[1]
  const merged = { ...conflict.data, observations: [...conflict.data.observations, missing] }
  assert.equal((await second.put(conflict.revision, merged)).status, 200)
  assert.deepEqual((await (await first.get()).json()).data.observations.map(entry => entry.id).sort(), ['laptop', 'observation-one', 'phone'])
  const stale = await first.put(1, phone)
  assert.equal(stale.status, 409)
  assert.equal((await stale.json()).revision, 3)
})

test('malformed quick photo measurements, links and identities fail before any Blob write', async t => {
  const { get, put, storage } = await fixture(t)
  const data = { ...empty(), observations: [observation()] }
  assert.equal((await put(0, data)).status, 200)
  for (const observations of [null, [observation(), observation()], [observation({ crateId: 'missing' })],
    [observation({ photo: '/api/photos/one.jpg?key=private' })], [observation({ unexpected: true })],
    [observation({ measurement: observationMeasurement({ extra: true }) })],
    [observation({ measurement: observationMeasurement({ basis: 'estimated' }) })],
    [observation({ measurement: observationMeasurement({ value: 0 }) })],
  ]) assert.equal((await put(1, { ...data, observations })).status, 400)
  assert.deepEqual(await (await get()).json(), { revision: 1, data })
  assert.equal(storage.writes.length, 1)
})

test('Blob label progress keeps both photo roles and helper attribution without registering a crate or awarding points', async t => {
  const first = await fixture(t)
  const data = { ...empty(), rewards: defaultRewards(1000), observations: [
    observation({ labelCode: 'C-032', photoRole: 'outside', helperId: 'griff' }),
    observation({ id: 'contents', labelCode: 'C-032', photoRole: 'contents', helperId: null }),
  ] }
  assert.equal((await first.put(0, data)).status, 200)
  const second = await fixture(t, { storage: first.storage })
  assert.deepEqual(await (await second.get()).json(), { revision: 1, data })
  for (const field of ['labelCode', 'photoRole', 'helperId']) {
    const candidate = structuredClone(data); delete candidate.observations[0][field]
    const response = await second.put(1, candidate)
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { revision: 1, data })
  }
  for (const patch of [{ labelCode: 'C-000' }, { labelCode: 'c-032' }, { photoRole: 'after' }, { helperId: 'missing' }]) {
    assert.equal((await second.put(1, { ...data, observations: [{ ...data.observations[0], ...patch }, data.observations[1]] })).status, 400)
  }
  const changed = { ...data, observations: data.observations.map(entry => ({ ...entry, helperId: null })) }
  assert.equal((await second.put(1, changed)).status, 200)
  const persisted = await (await first.get()).json()
  assert.deepEqual(persisted, { revision: 2, data: changed })
  assert.deepEqual(persisted.data.crates, [])
  assert.deepEqual(persisted.data.rewards.entries, [])
  assert.equal(first.storage.writes.length, 2)
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

test('503 diagnostics log only fixed failure stages and allowed error classes', async t => {
  const validStored = { bytes: Buffer.from(JSON.stringify({ revision: 0, data: empty() })), etag: '"tag"' }
  const secret = 'private token https://provider.example/garage/private-photo.jpg customer notes'
  const cases = [
    { stage: 'workspace-read', errorClass: 'TypeError', read: async () => { throw new TypeError(secret) } },
    { stage: 'workspace-metadata', errorClass: 'Error', read: async () => ({ ...validStored, etag: '' }) },
    { stage: 'workspace-decode', errorClass: 'SyntaxError', read: async () => ({ ...validStored, bytes: Buffer.from(secret) }) },
    { stage: 'workspace-schema', errorClass: 'Error', read: async () => ({ ...validStored, bytes: Buffer.from('{"private":"notes"}') }) },
    { stage: 'workspace-write', errorClass: 'unexpected', read: async () => validStored, write: async () => {
      const error = new Error(secret); error.constructor = { name: secret }; throw error
    } },
    { stage: 'workspace-recovery-read', errorClass: 'RangeError', calls: 0, read: async function () {
      if (++this.calls > 1) throw new RangeError(secret)
      return validStored
    }, write: async () => { throw new Error(secret) } },
  ]
  for (const item of cases) {
    const diagnostics = []
    const storage = { calls: 0, read: item.read, write: item.write ?? (async () => {}) }
    const { put } = await fixture(t, { storage, logError: diagnostic => diagnostics.push(diagnostic) })
    const response = await put(0, empty())
    assert.equal(response.status, 503)
    assert.deepEqual(diagnostics, [{ event: 'garage-storage-failure', stage: item.stage, errorClass: item.errorClass }])
    assert.doesNotMatch(JSON.stringify(diagnostics), /token|https:|photo|customer|notes|stack|message/)
    assert.doesNotMatch(await response.text(), /provider|token|customer|notes|errorClass|workspace-read/)
  }
})

test('logging cannot mask a storage failure and ordinary rejected requests are not storage diagnostics', async t => {
  const failing = await fixture(t, { storage: { read: async () => { throw new Error('secret') } }, logError: () => { throw new Error('logger failed') } })
  assert.equal((await failing.get()).status, 503)
  const diagnostics = []
  const { put } = await fixture(t, { logError: diagnostic => diagnostics.push(diagnostic) })
  assert.equal((await put(-1, empty())).status, 400)
  assert.equal((await put(0, empty())).status, 200)
  assert.equal((await put(0, empty())).status, 409)
  assert.deepEqual(diagnostics, [])
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
  assert.deepEqual(calls[0].options.headers, { 'accept-encoding': 'identity' })
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

test('compressed JSON HTTP ETags do not break conditional workspace saves', async t => {
  let stored = null, sequence = 0
  const getCalls = [], writes = []
  const sdk = {
    get: async (_key, options) => {
      getCalls.push(options)
      if (!stored) return null
      const identity = options.headers?.['accept-encoding'] === 'identity'
      return { statusCode: 200, stream: new Blob([stored.bytes]).stream(),
        blob: { etag: identity ? stored.etag : `W/${stored.etag}`, size: stored.bytes.length, contentType: 'application/json' } }
    },
    put: async (_key, bytes, options) => {
      // The storage API requires its strong object ETag. The CDN may have
      // supplied a weak ETag for a compressed HTTP representation instead.
      if (stored ? options.ifMatch !== stored.etag : options.allowOverwrite) throw new Error('ETag precondition failed')
      writes.push(options)
      stored = { bytes: Buffer.from(bytes), etag: `"${++sequence}"` }
    },
  }
  const storage = createBlobStorage({ loadSdk: async () => sdk, token: () => 'test-only-token' })
  const first = await fixture(t, { storage })
  const original = { ...empty(), notes: 'Large JSON workspace '.repeat(80).trim(), rewards: defaultRewards(1000), observations: [observation(), observation({ id: 'second-photo' })] }
  assert.ok(Buffer.byteLength(JSON.stringify(original)) > 1024)
  assert.equal((await first.put(0, original)).status, 200)
  const next = { ...original, observations: [...original.observations, observation({ id: 'third-photo' })] }
  assert.equal((await first.put(1, next)).status, 200)
  const second = await fixture(t, { storage })
  assert.deepEqual(await (await second.get()).json(), { revision: 2, data: next })
  assert.equal((await second.put(1, original)).status, 409)
  assert.equal(writes.length, 2)
  assert.equal(writes[1].ifMatch, '"1"')
  assert.ok(getCalls.every(options => options.headers?.['accept-encoding'] === 'identity'))
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
