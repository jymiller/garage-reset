// Run with: node src/crates/sync.test.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('./sync.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const { validRevision, applyRemote, acknowledgeSave } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const data = notes => ({ schemaVersion: 1, crates: [], items: [], baselineLocked: false, notes })

test('revisions must be nonnegative safe integers', () => {
  for (const value of [0, 1, Number.MAX_SAFE_INTEGER]) assert.equal(validRevision(value), true)
  for (const value of [-1, 1.1, NaN, Infinity, '1', undefined, null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(validRevision(value), false)
  }
})

test('a delayed GET cannot roll back a write acknowledged after that GET started', async () => {
  let deliver
  const response = new Promise(resolve => { deliver = resolve })
  let current = { revision: 1, data: data('old'), dirty: false }
  const refresh = response.then(remote => { current = applyRemote(current, remote, false) })
  const sent = { ...current, data: data('saved update'), dirty: true }
  current = acknowledgeSave(sent, sent, 2)
  deliver({ revision: 1, data: data('old') })
  await refresh
  assert.equal(current.revision, 2)
  assert.equal(current.data.notes, 'saved update')
  assert.equal(current.dirty, false)
})

test('refresh preserves drafts and conflicts even when the remote revision is newer', () => {
  const current = { revision: 1, data: data('draft'), dirty: true }
  const remote = { revision: 2, data: data('other device') }
  assert.equal(applyRemote(current, remote, false), current)
  const clean = { ...current, dirty: false }
  assert.equal(applyRemote(clean, remote, true), clean)
  assert.deepEqual(applyRemote(clean, remote, false), { ...remote, dirty: false })
})

test('acknowledgement preserves newer in-flight edits and advances their CAS revision', async () => {
  let deliver
  const response = new Promise(resolve => { deliver = resolve })
  const sent = { revision: 8, data: data('first edit'), dirty: true }
  let current = sent
  const save = response.then(revision => { current = acknowledgeSave(current, sent, revision) })
  const newerData = data('second edit')
  current = { ...current, data: newerData, dirty: true }
  deliver(9)
  await save
  assert.equal(current.data, newerData)
  assert.equal(current.revision, 9)
  assert.equal(current.dirty, true)
  assert.deepEqual(acknowledgeSave(current, current, 10), { ...current, revision: 10, dirty: false })
})

test('invalid or stale acknowledgement cannot clear a pending draft', () => {
  const sent = { revision: 3, data: data('draft'), dirty: true }
  for (const revision of [-1, 0, 3, 3.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(acknowledgeSave(sent, sent, revision), null)
  }
  assert.equal(acknowledgeSave({ ...sent, revision: 6 }, sent, 5), null)
})
