import assert from 'node:assert/strict'
import { test } from 'node:test'
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createGarageServer, validWorkspace } from './app.mjs'

const PASSWORD = 'test-only:password'
const authorization = `Basic ${Buffer.from(`garage:${PASSWORD}`).toString('base64')}`
const empty = () => ({ schemaVersion: 1, crates: [], items: [], baselineLocked: false, notes: '' })
const crate = (changes = {}) => ({
  id: 'crate-one', code: 'C01', name: 'Camping', location: 'Middle rack', owner: '',
  capacityLiters: 100, baselineFill: 80, currentFill: 80, status: 'unopened',
  photo: null, notes: '', createdAt: 1000, ...changes,
})
const item = (changes = {}) => ({
  id: 'item-one', crateId: 'crate-one', name: 'Lantern', quantity: 1, decision: 'undecided',
  destination: '', departed: false, notes: '', ...changes,
})
const workspace = (changes = {}) => ({ ...empty(), crates: [crate()], items: [item()], ...changes })
const mission = (changes = {}) => ({
  id: 'mission-one', title: 'One camping crate', area: 'Right rack', kind: 'crate', crateId: 'crate-one',
  phase: 'before', beforePhoto: null, afterPhoto: null, plannedMinutes: 10, elapsedSeconds: 0,
  runningSince: null, createdAt: 1000, completedAt: null, kept: 0, bagged: 0, donated: 0, ask: 0,
  summary: '', parkingClear: false, ...changes,
})
const finishedMission = (changes = {}) => mission({
  phase: 'complete', beforePhoto: '/api/photos/before.jpg', afterPhoto: '/api/photos/after.jpg',
  elapsedSeconds: 480, completedAt: 1000000, kept: 4, bagged: 1, donated: 2, ask: 1,
  summary: 'Repacked the crate and cleared the parking boundary.', parkingClear: true, ...changes,
})
const spatialItem = (changes = {}) => ({
  id: 'spatial-one', name: 'Camping tote', parentId: 'rack-r4', crateId: 'crate-one', photoId: 'IMG_1928',
  region: { x: 0.2, y: 0.3, w: 0.25, h: 0.2 }, x: 21.2, y: 0.2, z: 0.5, w: 0.6, d: 0.5, h: 0.4,
  dimensionBasis: 'estimated', notes: '', createdAt: 1000, ...changes,
})
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVXcAAAAASUVORK5CYII=', 'base64')

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'garage-server-test-'))
  const dataDir = path.join(root, 'private-data')
  await fs.mkdir(path.join(root, 'dist', 'evidence'), { recursive: true })
  await fs.writeFile(path.join(root, 'dist', 'index.html'), '<!doctype html><title>Test garage</title>')
  await fs.writeFile(path.join(root, 'dist', 'evidence', 'private.jpg'), PNG)
  await fs.mkdir(path.join(dataDir, 'evidence'), { recursive: true })
  await fs.writeFile(path.join(dataDir, 'evidence', 'private.jpg'), PNG)
  await fs.writeFile(path.join(root, 'secret.txt'), 'never serve outside dist')
  const servers = []
  const start = async () => {
    const server = await createGarageServer({ root, dataDir, password: PASSWORD })
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    servers.push(server)
    return { server, base: `http://127.0.0.1:${server.address().port}` }
  }
  t.after(async () => {
    for (const server of servers) await close(server)
    await fs.rm(root, { recursive: true, force: true })
  })
  return { root, dataDir, start, ...(await start()) }
}

async function close(server) {
  if (!server.listening) return
  if (server.closeGarage) { server.closeAllConnections(); await server.closeGarage(); return }
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
    server.closeAllConnections()
  })
}

function get(base, route, headers = {}) { return fetch(`${base}${route}`, { headers: { authorization, ...headers } }) }
function put(base, revision, data, headers = {}) {
  return fetch(`${base}/api/workspace`, { method: 'PUT', headers: { authorization, 'content-type': 'application/json', ...headers }, body: JSON.stringify({ revision, data }) })
}

test('production requires a password before touching storage', async () => {
  await assert.rejects(createGarageServer({ password: '', dataDir: '/unused-for-test' }), /GARAGE_PASSWORD/)
  await assert.rejects(createGarageServer({ dev: true, password: '', host: '0.0.0.0', dataDir: '/unused-for-test' }), /loopback/)
  await assert.rejects(createGarageServer({ password: PASSWORD, root: '/tmp/garage', dataDir: '/tmp/garage/public/private' }), /outside/)
  await assert.rejects(createGarageServer({ password: PASSWORD, root: '/tmp/garage', dataDir: '/tmp/garage/dist' }), /outside/)
})

test('authentication covers the app, static evidence, workspace, and photos', async t => {
  const { base } = await fixture(t)
  for (const route of ['/', '/evidence/private.jpg', '/api/workspace', '/api/photos/missing.png']) {
    const result = await fetch(`${base}${route}`)
    assert.equal(result.status, 401, route)
    assert.match(result.headers.get('www-authenticate'), /^Basic /)
  }
  for (const header of ['Basic Zm9v', 'Bearer other', `Basic ${Buffer.from('garage:wrong').toString('base64')}`]) {
    assert.equal((await fetch(`${base}/api/workspace`, { headers: { authorization: header } })).status, 401)
  }
  assert.equal((await get(base, '/')).status, 200)
  assert.equal((await get(base, '/evidence/private.jpg')).status, 200)
  assert.deepEqual(await (await get(base, '/api/workspace')).json(), { revision: 0, data: empty() })
})

test('workspace changes persist atomically and survive server restart', async t => {
  const { base, server, dataDir, start } = await fixture(t)
  const data = workspace()
  const saved = await put(base, 0, data)
  assert.equal(saved.status, 200)
  assert.deepEqual(await saved.json(), { revision: 1, data })
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'workspace.json'), 'utf8')), { revision: 1, data })
  assert.equal((await fs.readdir(dataDir)).some(name => name.endsWith('.tmp')), false)
  await close(server)
  const restarted = await start()
  assert.deepEqual(await (await get(restarted.base, '/api/workspace')).json(), { revision: 1, data })
})

test('stale and simultaneous edits return current state without overwriting it', async t => {
  const { base, dataDir } = await fixture(t)
  const edits = [workspace({ notes: 'Laptop edit' }), workspace({ notes: 'Phone edit' })]
  const responses = await Promise.all(edits.map(data => put(base, 0, data)))
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409])
  const winnerIndex = responses.findIndex(r => r.status === 200)
  const winner = { revision: 1, data: edits[winnerIndex] }
  for (const response of responses) assert.deepEqual(await response.json(), winner)
  const stale = await put(base, 0, workspace({ notes: 'stale replacement' }))
  assert.equal(stale.status, 409)
  assert.deepEqual(await stale.json(), winner)
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'workspace.json'), 'utf8')), winner)
  assert.equal((await put(base, 1, workspace({ notes: 'next edit' }))).status, 200)
})

test('optional photo missions preserve old workspace shape and persist linked sessions', async t => {
  const { base, server, dataDir, start } = await fixture(t)
  const oldData = workspace()
  assert.deepEqual(await (await put(base, 0, oldData)).json(), { revision: 1, data: oldData })
  assert.equal(Object.hasOwn((await (await get(base, '/api/workspace')).json()).data, 'missions'), false)
  const data = workspace({ missions: [finishedMission()] })
  const saved = await put(base, 1, data)
  assert.equal(saved.status, 200)
  assert.deepEqual(await saved.json(), { revision: 2, data })
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'workspace.json'), 'utf8')), { revision: 2, data })
  await close(server)
  const restarted = await start()
  assert.deepEqual(await (await get(restarted.base, '/api/workspace')).json(), { revision: 2, data })
})

test('photo missions reject incomplete completion, orphan links, and invalid phase state without overwriting', async t => {
  const { base } = await fixture(t)
  const data = workspace({ missions: [mission()] })
  assert.equal((await put(base, 0, data)).status, 200)
  const invalid = [
    workspace({ missions: null }),
    workspace({ missions: [mission({ crateId: 'missing' })] }),
    workspace({ missions: [mission(), mission()] }),
    workspace({ missions: [mission({ title: ' untrimmed' })] }),
    workspace({ missions: [mission({ plannedMinutes: 7 })] }),
    workspace({ missions: [mission({ elapsedSeconds: 1 })] }),
    workspace({ missions: [mission({ phase: 'active' })] }),
    workspace({ missions: [mission({ beforePhoto: 'https://example.com/photo.jpg' })] }),
    workspace({ missions: [mission({ runningSince: 1001 })] }),
    workspace({ missions: [mission({ phase: 'active', beforePhoto: '/api/photos/before.jpg', runningSince: 999 })] }),
    workspace({ missions: [mission({ completedAt: 1001 })] }),
    workspace({ missions: [finishedMission({ beforePhoto: null })] }),
    workspace({ missions: [finishedMission({ afterPhoto: null })] }),
    workspace({ missions: [finishedMission({ summary: '' })] }),
    workspace({ missions: [finishedMission({ parkingClear: false })] }),
    workspace({ missions: [finishedMission({ completedAt: null })] }),
    workspace({ missions: [finishedMission({ completedAt: 999 })] }),
    workspace({ missions: [finishedMission({ runningSince: 1001 })] }),
    workspace({ missions: [finishedMission({ donated: -1 })] }),
    workspace({ missions: [finishedMission({ kept: 1.5 })] }),
  ]
  for (const candidate of invalid) assert.equal((await put(base, 1, candidate)).status, 400)
  assert.deepEqual(await (await get(base, '/api/workspace')).json(), { revision: 1, data })
})

test('optional spatial items preserve legacy data and survive authenticated saves and restart', async t => {
  const { base, server, dataDir, start } = await fixture(t)
  const legacy = workspace({ missions: [finishedMission()] })
  assert.deepEqual(await (await put(base, 0, legacy)).json(), { revision: 1, data: legacy })
  assert.equal(Object.hasOwn((await (await get(base, '/api/workspace')).json()).data, 'spatialItems'), false)
  const data = { ...legacy, spatialItems: [spatialItem(), spatialItem({ id: 'spatial-two', crateId: null, dimensionBasis: 'measured' }), spatialItem({ id: 'spatial-three', crateId: null })] }
  const unauthenticated = await fetch(`${base}/api/workspace`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: 1, data }),
  })
  assert.equal(unauthenticated.status, 401)
  assert.deepEqual(await (await get(base, '/api/workspace')).json(), { revision: 1, data: legacy })
  const saved = await put(base, 1, data)
  assert.equal(saved.status, 200)
  assert.deepEqual(await saved.json(), { revision: 2, data })
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'workspace.json'), 'utf8')), { revision: 2, data })
  const stale = await put(base, 1, { ...data, spatialItems: [spatialItem({ name: 'Stale replacement' })] })
  assert.equal(stale.status, 409)
  assert.deepEqual(await stale.json(), { revision: 2, data })
  await close(server)
  const restarted = await start()
  assert.deepEqual(await (await get(restarted.base, '/api/workspace')).json(), { revision: 2, data })
})

test('spatial regions, dimensions, references and identity collisions reject without overwriting', async t => {
  const { base } = await fixture(t)
  const legacy = workspace({ missions: [finishedMission()] })
  const data = { ...legacy, spatialItems: [spatialItem()] }
  assert.equal((await put(base, 0, data)).status, 200)
  const malformedItems = [
    {}, spatialItem({ extra: true }), spatialItem({ name: ' untrimmed' }),
    spatialItem({ name: 'x'.repeat(161) }), spatialItem({ notes: 'x'.repeat(4001) }),
    spatialItem({ parentId: 'unrecognized-rack' }), spatialItem({ photoId: 'IMG_1919' }),
    spatialItem({ photoId: '/api/photos/uploaded.jpg' }), spatialItem({ crateId: 'missing' }),
    spatialItem({ id: 'rack-r4' }), spatialItem({ id: 'crate-one' }), spatialItem({ id: 'item-one' }), spatialItem({ id: 'mission-one' }),
    spatialItem({ dimensionBasis: 'guessed' }), spatialItem({ createdAt: -1 }),
    spatialItem({ x: -0.01 }), spatialItem({ y: -0.01 }), spatialItem({ z: -0.01 }),
    spatialItem({ w: 0.009 }), spatialItem({ d: 0.009 }), spatialItem({ h: 0.009 }),
    spatialItem({ x: 25 }), spatialItem({ y: 7.2 }), spatialItem({ z: 3 }),
    spatialItem({ region: null }), spatialItem({ region: { x: 0, y: 0, w: 0.1 } }),
    spatialItem({ region: { x: 0, y: 0, w: 0.1, h: 0.1, extra: true } }),
    spatialItem({ region: { x: -0.1, y: 0, w: 0.1, h: 0.1 } }),
    spatialItem({ region: { x: 0, y: 0, w: 0, h: 0.1 } }),
    spatialItem({ region: { x: 0, y: 0, w: 0.1, h: 0 } }),
    spatialItem({ region: { x: 0.9, y: 0, w: 0.2, h: 0.1 } }),
    spatialItem({ region: { x: 0, y: 0.9, w: 0.1, h: 0.2 } }),
    spatialItem({ region: { x: '0', y: 0, w: 0.1, h: 0.1 } }),
  ]
  for (const key of ['x', 'y', 'z', 'w', 'd', 'h', 'createdAt']) {
    for (const value of [NaN, Infinity, '1']) malformedItems.push(spatialItem({ [key]: value }))
  }
  for (const key of ['x', 'y', 'w', 'h']) malformedItems.push(spatialItem({ region: { x: 0, y: 0, w: 0.1, h: 0.1, [key]: Infinity } }))
  for (const candidate of malformedItems) {
    assert.equal(validWorkspace({ ...legacy, spatialItems: [candidate] }), false)
    assert.equal((await put(base, 1, { ...legacy, spatialItems: [candidate] })).status, 400)
  }
  for (const spatialItems of [null, {}, [spatialItem(), spatialItem()], [spatialItem(), spatialItem({ id: 'spatial-two' })]]) {
    assert.equal((await put(base, 1, { ...legacy, spatialItems })).status, 400)
  }
  assert.deepEqual(await (await get(base, '/api/workspace')).json(), { revision: 1, data })
})

test('malformed workspace data is rejected and never replaces saved data', async t => {
  const { base } = await fixture(t)
  const valid = workspace()
  assert.equal((await put(base, 0, valid)).status, 200)
  const bad = [null, {}, { ...valid, baselineLocked: 'true' }, { ...valid, extra: 'unknown field' },
    workspace({ crates: [crate({ capacityLiters: 0 })] }),
    workspace({ crates: [crate({ baselineFill: 101 })] }),
    workspace({ crates: [crate({ name: ' leading whitespace' })] }),
    workspace({ crates: [crate({ photo: '/api/photos/../../secret.txt' })] }),
    workspace({ crates: [crate(), crate({ id: 'other', code: 'c01' })] }),
    workspace({ items: [item({ crateId: 'missing' })] }),
    workspace({ items: [item({ quantity: 0 })] }),
    workspace({ items: [item({ quantity: 1.5 })] }),
    workspace({ items: [item({ departed: 'false' })] }),
    workspace({ items: [item({ decision: 'approved' })] }),
  ]
  for (const data of bad) assert.equal((await put(base, 1, data)).status, 400)
  for (const revision of [-1, 0.5, '1']) assert.equal((await put(base, revision, valid)).status, 400)
  assert.equal((await fetch(`${base}/api/workspace`, { method: 'PUT', headers: { authorization, 'content-type': 'application/json' }, body: '{broken' })).status, 400)
  assert.deepEqual(await (await get(base, '/api/workspace')).json(), { revision: 1, data: valid })
})

test('request limits and cross-origin writes are enforced', async t => {
  const { base } = await fixture(t)
  assert.equal((await put(base, 0, workspace(), { origin: 'https://unrelated.example' })).status, 403)
  assert.equal((await put(base, 0, workspace(), { origin: 'null' })).status, 403)
  const large = await fetch(`${base}/api/workspace`, {
    method: 'PUT', headers: { authorization, 'content-type': 'application/json' }, body: 'x'.repeat(2 * 1024 * 1024 + 1),
  })
  assert.equal(large.status, 413)
  assert.equal((await fetch(`${base}/api/photos`, {
    method: 'POST', headers: { authorization, 'content-type': 'image/png' }, body: Buffer.alloc(8 * 1024 * 1024 + 1),
  })).status, 413)
  assert.deepEqual(await (await get(base, '/api/workspace')).json(), { revision: 0, data: empty() })
})

test('photo uploads use inspected image signatures, private storage, and authenticated URLs', async t => {
  const { base, dataDir } = await fixture(t)
  const upload = await fetch(`${base}/api/photos`, { method: 'POST', headers: { authorization, 'content-type': 'image/png' }, body: PNG })
  assert.equal(upload.status, 201)
  const result = await upload.json()
  assert.match(result.url, /^\/api\/photos\/[a-f0-9-]+\.png$/)
  assert.equal(result.src, result.url)
  assert.equal((await fetch(`${base}${result.url}`)).status, 401)
  const loaded = await get(base, result.url)
  assert.equal(loaded.status, 200)
  assert.equal(loaded.headers.get('content-type'), 'image/png')
  assert.equal(loaded.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(Buffer.from(await loaded.arrayBuffer()), PNG)
  assert.deepEqual(await fs.readFile(path.join(dataDir, 'photos', result.filename)), PNG)
  for (const [bytes, type] of [[Buffer.from('<svg>not a photo</svg>'), 'image/png'], [PNG, 'image/jpeg']]) {
    assert.equal((await fetch(`${base}/api/photos`, { method: 'POST', headers: { authorization, 'content-type': type }, body: bytes })).status, 415)
  }
  assert.equal((await fetch(`${base}${result.url}`, { method: 'DELETE', headers: { authorization } })).status, 405)
})

function rawGet(base, route) {
  return new Promise((resolve, reject) => {
    const request = http.get(base, { path: route, headers: { authorization } }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }))
    })
    request.on('error', reject)
  })
}

function websocketHandshake(base, token, auth = authorization) {
  return new Promise((resolve, reject) => {
    const request = http.request(`${base}/?token=${encodeURIComponent(token)}`, {
      headers: {
        connection: 'Upgrade', upgrade: 'websocket', origin: base,
        'sec-websocket-version': '13', 'sec-websocket-protocol': 'vite-hmr',
        'sec-websocket-key': Buffer.from('garage-test-key!').toString('base64'),
        ...(auth ? { authorization: auth } : {}),
      },
    })
    request.on('upgrade', (response, socket) => { socket.destroy(); resolve(response.statusCode) })
    request.on('response', response => { response.resume(); response.on('end', () => resolve(response.statusCode)) })
    request.on('error', reject)
    request.setTimeout(2000, () => request.destroy(new Error('WebSocket handshake timed out')))
    request.end()
  })
}

test('photo and static routes reject traversal and symlinks outside allowed directories', async t => {
  const { base, root, dataDir } = await fixture(t)
  for (const route of ['/api/photos/../workspace.json', '/api/photos/%2e%2e%2fworkspace.json', '/api/photos/%5c..%5csecret.png', '/api/photos/%00.png', '/%2e%2e/secret.txt', '/api/photos/bad.txt']) {
    const result = await rawGet(base, route)
    assert.ok([400, 404].includes(result.status), `${route}: ${result.status}`)
    assert.doesNotMatch(result.body, /never serve outside dist/)
  }
  await fs.symlink(path.join(root, 'secret.txt'), path.join(root, 'dist', 'escape.txt'))
  await fs.symlink(path.join(root, 'secret.txt'), path.join(dataDir, 'photos', 'escape.png'))
  assert.equal((await get(base, '/escape.txt')).status, 404)
  assert.equal((await get(base, '/api/photos/escape.png')).status, 404)
  assert.equal((await get(base, '/.garage-data/workspace.json')).status, 404)
  assert.equal((await get(base, '/api/unknown')).status, 404)
  assert.equal((await get(base, '/planner', { accept: 'text/html' })).status, 200)
  await fs.unlink(path.join(root, 'dist', 'index.html'))
  await fs.symlink(path.join(root, 'secret.txt'), path.join(root, 'dist', 'index.html'))
  assert.equal((await get(base, '/planner', { accept: 'text/html' })).status, 404)
})

test('an invalid existing state file prevents startup rather than resetting it', async t => {
  const { root, dataDir, server } = await fixture(t)
  await close(server)
  const invalid = '{"revision":9,"data":{"schemaVersion":99}}'
  await fs.writeFile(path.join(dataDir, 'workspace.json'), invalid)
  await assert.rejects(createGarageServer({ root, dataDir, password: PASSWORD }), /Stored workspace is invalid/)
  assert.equal(await fs.readFile(path.join(dataDir, 'workspace.json'), 'utf8'), invalid)
})

test('production evidence comes from authenticated private storage with safe nested paths', async t => {
  const { base, root, dataDir } = await fixture(t)
  const evidenceDir = path.join(dataDir, 'evidence')
  await fs.mkdir(path.join(evidenceDir, '2026-09-09'))
  await fs.writeFile(path.join(evidenceDir, '2026-09-09', 'IMG_1908.png'), PNG)
  const route = '/evidence/2026-09-09/IMG_1908.png'
  assert.equal((await fetch(`${base}${route}`)).status, 401)
  const image = await get(base, route)
  assert.equal(image.status, 200)
  assert.equal(image.headers.get('content-type'), 'image/png')
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), PNG)
  const head = await fetch(`${base}${route}`, { method: 'HEAD', headers: { authorization } })
  assert.equal(head.status, 200)
  assert.equal(head.headers.get('content-length'), String(PNG.length))
  await fs.symlink(path.join(root, 'secret.txt'), path.join(evidenceDir, 'escape.txt'))
  assert.equal((await get(base, '/evidence/escape.txt')).status, 404)
  assert.equal((await rawGet(base, '/evidence/%2e%2e/workspace.json')).status, 400)
  await fs.writeFile(path.join(root, 'dist', 'evidence', 'build-only.jpg'), PNG)
  assert.equal((await get(base, '/evidence/build-only.jpg')).status, 404)
})

test('server validation accepts current client model records and rejects the same invalid fields', async () => {
  const ts = await import('typescript')
  const source = await fs.readFile(new URL('../src/crates/model.ts', import.meta.url), 'utf8')
  const compiled = ts.default.transpileModule(source, { compilerOptions: { target: ts.default.ScriptTarget.ES2022, module: ts.default.ModuleKind.ESNext } }).outputText
  const model = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  const examples = [model.emptyWorkspace(), workspace(), workspace({ crates: [crate({ photo: '/api/photos/123-valid.png' })] }),
    workspace({ crates: [crate({ currentFill: -1 })] }), workspace({ items: [item({ departed: 1 })] }),
    workspace({ crates: [crate(), crate({ id: 'other' })] }), workspace({ notes: ' untrimmed' }),
    workspace({ missions: [] }), workspace({ missions: [mission()] }), workspace({ missions: [finishedMission()] }),
    workspace({ missions: [mission({ phase: 'active', beforePhoto: '/api/photos/before.jpg', runningSince: 2000 })] }),
    workspace({ missions: [mission({ kind: 'floor', crateId: null })] }),
    workspace({ missions: [mission({ phase: 'review', beforePhoto: '/api/photos/before.jpg', elapsedSeconds: 120 })] }),
    workspace({ missions: [finishedMission({ parkingClear: false })] }),
    workspace({ missions: [finishedMission({ completedAt: 999 })] }),
    workspace({ missions: [finishedMission({ afterPhoto: null })] }),
    workspace({ missions: [mission({ crateId: 'missing' })] }),
    workspace({ missions: [mission({ phase: 'active' })] }),
    workspace({ missions: [mission({ elapsedSeconds: 1 })] }),
    workspace({ missions: [mission({ runningSince: 2000 })] }),
    workspace({ missions: [mission(), mission()] }),
    workspace({ spatialItems: [] }), workspace({ spatialItems: [spatialItem()] }),
    workspace({ spatialItems: [spatialItem({ crateId: null, dimensionBasis: 'measured' })] }),
    workspace({ spatialItems: [spatialItem({ x: 0, y: 0, z: 0, w: 25.21, d: 7.38, h: 3.2, region: { x: 0, y: 0, w: 1, h: 1 } })] }),
    workspace({ spatialItems: [spatialItem({ region: { x: 0, y: 0, w: Number.MIN_VALUE, h: Number.MIN_VALUE } })] }),
    workspace({ spatialItems: [spatialItem({ region: { x: 0.9, y: 0, w: 0.2, h: 1 } })] }),
    workspace({ spatialItems: [spatialItem({ x: Infinity })] }),
    workspace({ spatialItems: [spatialItem({ w: 0.009 })] }),
    workspace({ spatialItems: [spatialItem({ z: 3, h: 0.3 })] }),
    workspace({ spatialItems: [spatialItem({ dimensionBasis: 'photo-measured' })] }),
    workspace({ spatialItems: [spatialItem({ parentId: 'missing' })] }),
    workspace({ spatialItems: [spatialItem({ photoId: 'IMG_1919' })] }),
    workspace({ spatialItems: [spatialItem({ crateId: 'missing' })] }),
    workspace({ spatialItems: [spatialItem({ id: 'rack-r4' })] }),
    workspace({ spatialItems: [spatialItem({ id: 'crate-one' })] }),
    workspace({ spatialItems: [spatialItem({ id: 'item-one' })] }),
    workspace({ missions: [mission()], spatialItems: [spatialItem({ id: 'mission-one' })] }),
    workspace({ spatialItems: [spatialItem(), spatialItem()] }),
    workspace({ spatialItems: [spatialItem(), spatialItem({ id: 'spatial-two' })] }),
    workspace({ spatialItems: [spatialItem({ crateId: null }), spatialItem({ id: 'spatial-two', crateId: null })] }),
    workspace({ spatialItems: null }),
  ]
  for (const example of examples) assert.equal(validWorkspace(example), model.validateWorkspace(example))

  const loadDataModule = async relativePath => {
    const dataSource = await fs.readFile(new URL(relativePath, import.meta.url), 'utf8')
    const dataCode = ts.default.transpileModule(dataSource, { compilerOptions: { target: ts.default.ScriptTarget.ES2022, module: ts.default.ModuleKind.ESNext } }).outputText
    return import(`data:text/javascript;base64,${Buffer.from(dataCode).toString('base64')}`)
  }
  const objects = await loadDataModule('../src/garage/currentObjects.ts')
  const survey = await loadDataModule('../src/pickup/surveyData.ts')
  const parentIds = objects.currentObjects.map(object => object.id)
  const photoIds = [...survey.photoSurvey, ...survey.latestPhotoSurvey].map(photo => photo.id)
  assert.equal(parentIds.length, 26)
  assert.equal(photoIds.length, 17)
  assert.deepEqual([...model.SPATIAL_PARENT_IDS].sort(), [...parentIds].sort())
  assert.deepEqual([...model.SPATIAL_PHOTO_IDS].sort(), [...photoIds].sort())
  for (const parentId of parentIds) {
    assert.equal(validWorkspace(workspace({ spatialItems: [spatialItem({ parentId })] })), true, parentId)
    assert.equal(validWorkspace(workspace({ spatialItems: [spatialItem({ id: parentId })] })), false, parentId)
  }
  for (const photoId of photoIds) assert.equal(validWorkspace(workspace({ spatialItems: [spatialItem({ photoId })] })), true, photoId)
})

test('development serves Vite middleware and API on one authenticated loopback server', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'garage-vite-test-'))
  const dataDir = path.join(root, '.garage-data')
  await fs.mkdir(path.join(root, 'src'))
  await fs.writeFile(path.join(root, 'package.json'), '{"type":"module"}')
  await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><div id="root"></div><script type="module" src="/src/main.tsx"></script>')
  await fs.writeFile(path.join(root, 'src', 'main.tsx'), 'import { version } from "react"; export const example: number = 1; export { version };')
  await fs.mkdir(path.join(root, 'public', 'evidence'), { recursive: true })
  await fs.writeFile(path.join(root, 'public', 'evidence', 'local.png'), PNG)
  await fs.symlink(new URL('../node_modules', import.meta.url), path.join(root, 'node_modules'), 'dir')
  const server = await createGarageServer({ root, dataDir, dev: true, password: PASSWORD, host: '127.0.0.1' })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  t.after(async () => { await close(server); await fs.rm(root, { recursive: true, force: true }) })
  const base = `http://127.0.0.1:${server.address().port}`
  assert.equal((await fetch(`${base}/`)).status, 401)
  const index = await get(base, '/')
  assert.equal(index.status, 200)
  assert.match(await index.text(), /@vite\/client/)
  const code = await get(base, '/src/main.tsx')
  assert.equal(code.status, 200)
  const transformed = await code.text()
  assert.match(transformed, /export const example = 1/)
  const reactModule = transformed.match(/from "([^"]*\/react\.js[^\"]*)"/)?.[1]
  assert.ok(reactModule, 'Vite resolves React from the existing dependency install')
  assert.equal((await get(base, reactModule)).status, 200)
  const client = await (await get(base, '/@vite/client')).text()
  const token = client.match(/const wsToken = "([^"]+)";/)?.[1]
  assert.ok(token, 'Vite client receives its WebSocket token after authentication')
  assert.equal(await websocketHandshake(base, token, null), 401)
  assert.equal(await websocketHandshake(base, token, `Basic ${Buffer.from('garage:wrong').toString('base64')}`), 401)
  assert.equal(await websocketHandshake(base, token), 101)
  assert.deepEqual(Buffer.from(await (await get(base, '/evidence/local.png')).arrayBuffer()), PNG)
  assert.deepEqual(await (await get(base, '/api/workspace')).json(), { revision: 0, data: empty() })
})
