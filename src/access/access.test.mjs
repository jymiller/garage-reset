// Run with: node src/access/access.test.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const load = async path => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
}
const { isLocalhost, parseAccessKey, accessKeyFromHash, checkAccess, openFamilyAccess } = await load('./access.ts')
const { MAX_ENCODED_PHOTO_BYTES, encodePhotoWithinLimit } = await load('./photoUpload.ts')
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('only explicit loopback hosts bypass family access', () => {
  for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '::1', '[::1]']) assert.equal(isLocalhost(host), true)
  for (const host of ['192.168.1.20', 'garage-reset.vercel.app', 'localhost.example.com', '127.0.0.1.example.com', '0.0.0.0', '']) {
    assert.equal(isLocalhost(host), false)
  }
})

test('family links and opaque keys parse locally without accepting incomplete or ambiguous links', () => {
  assert.equal(parseAccessKey('  example-family-key_123  '), 'example-family-key_123')
  assert.equal(parseAccessKey('opaque+key/value=='), 'opaque+key/value==')
  assert.equal(parseAccessKey('https://garage-reset.vercel.app/#access=example-family-key_123'), 'example-family-key_123')
  assert.equal(parseAccessKey('https://example.com/other#access=a%2Bb%2Fc%3D'), 'a+b/c=')
  assert.equal(accessKeyFromHash('#access=example-family-key_123'), 'example-family-key_123')
  assert.equal(parseAccessKey('#access=example-family-key_123'), 'example-family-key_123')
  for (const invalid of ['', 'not a complete link', 'https://garage-reset.vercel.app/', 'https://example.com/?access=key',
    'javascript:alert(1)', '//example.com/#access=key', '#access=', '#access=one&access=two', '#access=contains%20space', 'x'.repeat(2049)]) {
    assert.equal(parseAccessKey(invalid), null, invalid.slice(0, 70))
  }
})

test('remote authorization fails closed for unavailable or malformed access responses', async () => {
  for (const status of [401, 403, 404, 500]) {
    assert.equal((await checkAccess(async () => json({}, status))).state, 'error')
  }
  for (const body of [null, {}, { authorized: 'true' }, { authorized: 1 }]) {
    assert.equal((await checkAccess(async () => json(body))).state, 'error')
  }
  assert.equal((await checkAccess(async () => new Response('not json'))).state, 'error')
  assert.equal((await checkAccess(async () => { throw new TypeError('network failed') })).state, 'error')
  assert.deepEqual(await checkAccess(async () => json({ authorized: false })), { state: 'locked' })
  assert.deepEqual(await checkAccess(async () => json({ authorized: true })), { state: 'authorized' })
})

test('pasted URLs only exchange the extracted key with the same-origin access endpoint', async () => {
  const calls = []
  const key = parseAccessKey('https://a-different-host.example/#access=family-token')
  const result = await openFamilyAccess(key, async (url, options) => {
    calls.push({ url, options })
    return options.method === 'POST' ? json({ authorized: true }) : json({ authorized: true })
  })
  assert.equal(result.state, 'authorized')
  assert.equal(calls.length, 2)
  assert.ok(calls.every(call => call.url === '/api/access' && call.options.credentials === 'same-origin'))
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].options.body), { key: 'family-token' })
  assert.equal(calls[1].options.method, 'GET')
})

test('exchange success alone cannot open the app before cookie authorization is confirmed', async () => {
  assert.equal((await openFamilyAccess('family-token', async (_url, options) =>
    options.method === 'POST' ? json({ authorized: true }) : json({ authorized: false }))).state, 'error')
  for (const status of [401, 403]) {
    let calls = 0
    const result = await openFamilyAccess('family-token', async () => { calls++; return json({}, status) })
    assert.equal(result.state, 'locked')
    assert.equal(calls, 1)
  }
  assert.equal((await openFamilyAccess('family-token', async () => { throw new TypeError('offline') })).state, 'error')
})

test('a JPEG within the hosted cap is accepted without needless recompression', async () => {
  assert.equal(MAX_ENCODED_PHOTO_BYTES, 3_500_000)
  const blob = new Blob([new Uint8Array(50)], { type: 'image/jpeg' })
  let calls = 0
  const encoded = await encodePhotoWithinLimit(async () => { calls++; return blob }, 50)
  assert.equal(encoded, blob)
  assert.equal(calls, 1)
})

test('oversized encodings get smaller dimensions before a body is accepted', async () => {
  const attempts = []
  const result = await encodePhotoWithinLimit(async (maxEdge, quality) => {
    attempts.push({ maxEdge, quality })
    return new Blob([new Uint8Array(maxEdge > 1280 ? 101 : 60)], { type: 'image/jpeg' })
  }, 100)
  assert.ok(result.size <= 100)
  assert.ok(attempts.some(attempt => attempt.maxEdge < attempts[0].maxEdge))
  assert.ok(attempts.every(attempt => attempt.maxEdge <= 1600 && attempt.quality <= 0.84))
})

test('the encoder refuses empty, wrong-format or still-oversized bodies', async () => {
  for (const blob of [new Blob([], { type: 'image/jpeg' }), new Blob([new Uint8Array(5)], { type: 'image/png' }),
    new Blob([new Uint8Array(101)], { type: 'image/jpeg' })]) {
    await assert.rejects(encodePhotoWithinLimit(async () => blob, 100), /too large to upload/)
  }
})
