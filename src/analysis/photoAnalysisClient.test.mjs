import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = (await readFile(new URL('./photoAnalysisClient.ts', import.meta.url), 'utf8'))
  .replaceAll("'./contract.mjs'", JSON.stringify(new URL('./contract.mjs', import.meta.url).href))
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { photoFilenameFromUrl, requestPhotoAnalysis } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const record = overrides => ({ version: 1, photoFilename: 'crate.jpg', sourceSha256: 'a'.repeat(64), analysisVersion: 'garage-photo-v1', model: 'openai/gpt-4.1-mini', status: 'queued', createdAt: 1, updatedAt: 1, attempts: 0, leaseId: null, leaseUntil: null, errorCode: null, result: null, ...overrides })
const reply = (analysis, status = 200) => new Response(JSON.stringify({ analysis }), { status, headers: { 'Content-Type': 'application/json' } })

test('only protected app photo URLs produce analysis filenames', () => {
  assert.equal(photoFilenameFromUrl('/api/photos/crate_12-ab.jpg'), 'crate_12-ab.jpg')
  for (const url of ['https://example.com/crate.jpg', '/api/photos/../private.jpg', '/api/photos/%2e%2e.jpg', '/api/photos/crate.jpg?key=secret', '/api/photos/sub/crate.jpg', '/api/photos/crate.svg']) assert.equal(photoFilenameFromUrl(url), null)
})
test('reading missing analysis is a same-origin GET, never a queue write', async () => {
  let request
  const analysis = await requestPhotoAnalysis('crate.jpg', false, undefined, async (url, options) => { request = { url, options }; return reply(null) })
  assert.equal(analysis, null)
  assert.equal(request.url, '/api/analysis?photo=crate.jpg')
  assert.equal(request.options.method, 'GET')
  assert.equal(request.options.credentials, 'same-origin')
  assert.equal(request.options.cache, 'no-store')
  assert.equal(request.options.body, undefined)
  assert.equal(request.options.headers, undefined)
})
test('retry explicitly posts only the photo filename and accepts queued202', async () => {
  const queued = record({})
  let request
  assert.deepEqual(await requestPhotoAnalysis('crate.jpg', true, undefined, async (url, options) => { request = { url, options }; return reply(queued, 202) }), queued)
  assert.equal(request.url, '/api/analysis/retry')
  assert.equal(request.options.method, 'POST')
  assert.deepEqual(JSON.parse(request.options.body), { photo: 'crate.jpg' })
  assert.deepEqual(request.options.headers, { 'Content-Type': 'application/json' })
})
test('results for another image or malformed records cannot appear on this photo', async () => {
  for (const result of [record({ photoFilename: 'different.jpg' }), record({ status: 'complete' }), {}, 'unknown']) await assert.rejects(requestPhotoAnalysis('crate.jpg', false, undefined, async () => reply(result)), /Analysis is unavailable/)
  await assert.rejects(requestPhotoAnalysis('crate.jpg', true, undefined, async () => reply(null)), /Analysis is unavailable/)
})
test('complete results remain portable metadata without changing inventory', async () => {
  const complete = record({ status: 'complete', updatedAt: 2, attempts: 1, result: { summary: 'A storage crate beside a shelf.', objects: [{ id: 'object-1', name: 'Storage crate', category: 'container', quantity: 1, confidence: 'medium', evidence: 'Plastic container with a lid.', region: { x: 0.1, y: 0.1, w: 0.3, h: 0.4 }, readableLabel: null, suggestedCrateId: null, locationHint: 'Beside the shelf' }], questions: ['Is there a label on its front?'] } })
  assert.deepEqual(await requestPhotoAnalysis('crate.jpg', false, undefined, async () => reply(complete)), complete)
})
test('network and access failures show concise errors without response details', async () => {
  for (const [status, expected] of [[401, /family link/], [403, /family link/], [404, /original photo/], [500, /Could not check analysis/]]) await assert.rejects(requestPhotoAnalysis('crate.jpg', false, undefined, async () => new Response('private diagnostic detail', { status })), expected)
  await assert.rejects(requestPhotoAnalysis('crate.jpg', false, undefined, async () => new Response('private diagnostic detail', { status: 200 })), /Analysis is unavailable/)
  let called = false
  await assert.rejects(requestPhotoAnalysis('../private.jpg', false, undefined, async () => { called = true; return reply(null) }), /cannot be analyzed/)
  assert.equal(called, false)
})
test('abort signals reach fetch so unmounted photos stop pending requests', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(requestPhotoAnalysis('crate.jpg', false, controller.signal, async (_url, options) => { assert.equal(options.signal, controller.signal); options.signal.throwIfAborted() }), { name: 'AbortError' })
})
