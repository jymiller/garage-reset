import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('./workspaceRequest.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { fetchWorkspaceJson } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('preserves PUT content and exposes a 503 body for draft-safe error handling', async () => {
  const body = JSON.stringify({ revision: 3, data: { observations: ['photo-1', 'photo-2', 'photo-3'] } })
  let sent
  const result = await fetchWorkspaceJson({ method: 'PUT', body }, { request: async (url, init) => {
    sent = { url, init }
    return new Response(JSON.stringify({ error: 'Central storage unavailable' }), { status: 503 })
  } })
  assert.equal(sent.url, '/api/workspace')
  assert.equal(sent.init.method, 'PUT')
  assert.equal(sent.init.body, body)
  assert.equal(result.response.status, 503)
  assert.equal(result.remote.error, 'Central storage unavailable')
})

test('a stalled request times out and aborts its underlying connection', async () => {
  let signal
  const pending = fetchWorkspaceJson({}, { timeoutMs: 15, request: (_url, init) => {
    signal = init.signal
    return new Promise(() => {})
  } })
  await assert.rejects(pending, { name: 'TimeoutError' })
  assert.equal(signal.aborted, true)
})

test('timeout includes a stalled JSON body and excludes its late result', async () => {
  const body = deferred()
  let signal
  let delivered = false
  const pending = fetchWorkspaceJson({}, { timeoutMs: 15, request: async (_url, init) => {
    signal = init.signal
    return { status: 200, ok: true, json: () => body.promise }
  } }).then(result => { delivered = true; return result })
  await assert.rejects(pending, { name: 'TimeoutError' })
  assert.equal(signal.aborted, true)
  body.resolve({ revision: 99, data: { late: true } })
  await delay(0)
  assert.equal(delivered, false)
})

test('lifecycle cancellation aborts a body read without returning it', async () => {
  const lifecycle = new AbortController()
  const body = deferred()
  let signal
  const pending = fetchWorkspaceJson({}, { signal: lifecycle.signal, request: async (_url, init) => {
    signal = init.signal
    return { json: () => body.promise }
  } })
  lifecycle.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(signal.aborted, true)
  body.resolve({ revision: 1 })
  await delay(0)
})

test('an already-ended lifecycle never starts a fetch', async () => {
  const lifecycle = new AbortController()
  lifecycle.abort()
  let called = false
  await assert.rejects(fetchWorkspaceJson({}, { signal: lifecycle.signal, request: async () => {
    called = true
    return new Response('{}')
  } }), { name: 'AbortError' })
  assert.equal(called, false)
})

test('completed requests clear both timeout and lifecycle listeners', async () => {
  const lifecycle = new AbortController()
  let signal
  const result = await fetchWorkspaceJson({}, { signal: lifecycle.signal, timeoutMs: 15, request: async (_url, init) => {
    signal = init.signal
    return new Response(JSON.stringify({ revision: 4, data: { notes: 'kept' } }))
  } })
  assert.equal(result.remote.revision, 4)
  lifecycle.abort()
  await delay(25)
  assert.equal(signal.aborted, false)
})

test('invalid JSON cannot become an acknowledgement', async () => {
  await assert.rejects(fetchWorkspaceJson({}, { request: async () => new Response('not JSON') }), SyntaxError)
  const result = await fetchWorkspaceJson({}, { request: async () => new Response('null') })
  assert.deepEqual(result.remote, {})
})

test('a successful retry after timeout uses a new uncancelled request', async () => {
  let expiredSignal
  await assert.rejects(fetchWorkspaceJson({}, { timeoutMs: 15, request: (_url, init) => {
    expiredSignal = init.signal
    return new Promise(() => {})
  } }), { name: 'TimeoutError' })
  const result = await fetchWorkspaceJson({}, { request: async (_url, init) => {
    assert.equal(init.signal.aborted, false)
    assert.notEqual(init.signal, expiredSignal)
    return new Response('{"revision":5}')
  } })
  assert.equal(result.remote.revision, 5)
})
