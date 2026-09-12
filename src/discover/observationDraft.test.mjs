import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`
const modelSource = (await readFile(new URL('../crates/model.ts', import.meta.url), 'utf8')).replaceAll("'../rewards/contract.mjs'", JSON.stringify(new URL('../rewards/contract.mjs', import.meta.url).href))
const modelURL = compile(modelSource)
const { emptyWorkspace, volumeStats } = await import(modelURL)
const source = (await readFile(new URL('./observationDraft.ts', import.meta.url), 'utf8')).replaceAll("'../crates/model'", JSON.stringify(modelURL))
const { buildObservation, appendObservation } = await import(compile(source))
const input = patch => ({ id: 'capture-a', kind: 'crate', photo: '/api/photos/saved.jpg', location: '', notes: '', crateId: null, measurementEnabled: false, measurementLabel: '', measurementValue: '', measurementUnit: 'cm', ...patch })

test('a photo needs no crate, player, measurement or reward plan', () => {
  const result = buildObservation(input({}), 1000)
  assert.ok(result.observation)
  const before = emptyWorkspace()
  const after = appendObservation(before, result.observation)
  assert.equal(after.observations.length, 1)
  assert.deepEqual(after.crates, before.crates)
  assert.deepEqual(after.items, before.items)
  assert.deepEqual(volumeStats(after), volumeStats(before))
  assert.equal(after.rewards, undefined)
  assert.equal(after.missions, undefined)
})
test('stable IDs make retries idempotent and retain existing data', () => {
  const observation = buildObservation(input({ notes: 'One crate' }), 1000).observation
  const once = appendObservation(emptyWorkspace(), observation)
  assert.equal(appendObservation(once, observation), once)
  assert.equal(appendObservation(once, { ...observation, notes: 'A different record must not replace it' }), once)
  assert.equal(once.observations[0].notes, 'One crate')
})
test('measurements require positive finite values and named endpoints', () => {
  for (const value of ['0', '-1', 'Infinity', 'NaN', '1000001']) assert.equal(buildObservation(input({ measurementEnabled: true, measurementValue: value, measurementLabel: 'Front to back' }), 1000).observation, null)
  assert.equal(buildObservation(input({ measurementEnabled: true, measurementValue: '12.5' }), 1000).observation, null)
  const measured = buildObservation(input({ measurementEnabled: true, measurementValue: '12.5', measurementLabel: ' Front to back ', measurementUnit: 'in' }), 1000).observation
  assert.deepEqual(measured.measurement, { value: 12.5, label: 'Front to back', unit: 'in', basis: 'user-measured' })
})
test('a measurement photo can precede the reading and preserve its endpoint label', () => {
  const result = buildObservation(input({ kind: 'measurement', notes: 'Entrance end', measurementLabel: 'Rack wall to white line' }), 1000)
  assert.equal(result.observation.measurement, null)
  assert.equal(result.observation.notes, 'Entrance end\nReading pending: Rack wall to white line')
})
test('unsafe photos and nonexistent linked crates are rejected', () => {
  assert.equal(buildObservation(input({ photo: 'https://example.com/photo.jpg' }), 1000).observation, null)
  const observation = buildObservation(input({ crateId: 'missing' }), 1000).observation
  const workspace = emptyWorkspace()
  assert.equal(appendObservation(workspace, observation), workspace)
})
test('printed label context persists without creating inventory, and cannot link a different crate', () => {
  const outside = buildObservation(input({ labelCode: 'c-002', photoRole: 'outside' }), 1000).observation
  assert.equal(outside.labelCode, 'C-002')
  assert.equal(outside.photoRole, 'outside')
  assert.equal(appendObservation(emptyWorkspace(), outside).crates.length, 0)
  const workspace = { ...emptyWorkspace(), crates: [{ id: 'crate-one', code: 'C-001', name: 'First crate', location: '', owner: '', capacityLiters: 60, baselineFill: 0, currentFill: 0, status: 'unopened', photo: null, notes: '', createdAt: 1000 }] }
  assert.equal(appendObservation(workspace, { ...outside, crateId: 'crate-one' }), workspace)
  assert.equal(buildObservation(input({ labelCode: 'C-000' }), 1000).observation, null)
})
test('unknown helpers cannot be attributed and anonymous photos still work', () => {
  const observation = buildObservation(input({ helperId: 'not-a-registered-player' }), 1000).observation
  const workspace = emptyWorkspace()
  assert.equal(appendObservation(workspace, observation), workspace)
  assert.equal(appendObservation(workspace, buildObservation(input({ helperId: null }), 1000).observation).observations.length, 1)
})

test('general photos save without assigning a crate, type-specific measurement, or helper', () => {
  const result = buildObservation(input({ kind: 'general' }), 1000)
  assert.ok(result.observation)
  assert.equal(result.observation.kind, 'general')
  assert.equal(result.observation.crateId, null)
  assert.equal(result.observation.measurement, null)
  assert.equal(result.observation.notes, '')
  assert.equal(result.observation.labelCode, undefined)
  assert.equal(result.observation.helperId, undefined)
  const workspace = appendObservation(emptyWorkspace(), result.observation)
  assert.equal(workspace.observations[0].kind, 'general')
  assert.deepEqual(workspace.items, [])
  assert.deepEqual(workspace.crates, [])
  assert.equal(workspace.photoAwards, undefined)
})
