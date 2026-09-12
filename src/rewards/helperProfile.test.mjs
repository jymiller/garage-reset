import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const compile = async (path, replacements = {}) => {
  let source = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(`'${from}'`, `'${to}'`)
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}
const rewardsUrl = new URL('./contract.mjs', import.meta.url).href
const modelUrl = await compile('../crates/model.ts', { '../rewards/contract.mjs': rewardsUrl })
const { emptyWorkspace, validateWorkspace } = await import(modelUrl)
const { joinHelper } = await import(await compile('./helperProfile.ts', { '../crates/model': modelUrl, './model': rewardsUrl }))
const observation = { id: 'photo-1', kind: 'parking', photo: '/api/photos/parking.jpg', notes: 'Door route', location: '', crateId: null, measurement: null, createdAt: 10 }

test('first explicit helper join preserves photos and only creates the player book', () => {
  const before = { ...emptyWorkspace(), notes: 'Keep both spaces clear.', observations: [observation] }
  const snapshot = structuredClone(before)
  const joined = joinHelper(before, '  Alex  ', 'alex-id', 100)
  assert.equal(joined.playerId, 'alex-id')
  assert.deepEqual(joined.data.observations, before.observations)
  assert.equal(joined.data.notes, before.notes)
  assert.deepEqual(joined.data.rewards.players.map(player => player.name), ['Griff', 'Alex'])
  assert.deepEqual(joined.data.rewards.entries, [])
  assert.equal(Object.hasOwn(joined.data, 'missions'), false)
  assert.equal(Object.hasOwn(joined.data.observations[0], 'helperId'), false)
  assert.deepEqual(before, snapshot)
  assert.equal(validateWorkspace(joined.data), true)
})

test('first Griff join reuses the existing preset rather than creating a duplicate', () => {
  const joined = joinHelper(emptyWorkspace(), '  gRiFf ', 'unused-id', 100)
  assert.equal(joined.playerId, 'griff')
  assert.equal(joined.data.rewards.players.length, 1)
  assert.deepEqual(joined.data.rewards.entries, [])
})

test('later joins preserve plan settings and same-name selection is idempotent', () => {
  const first = joinHelper(emptyWorkspace(), 'Alex', 'alex-id', 100).data
  const existing = { ...first, rewards: { ...first.rewards, missionsForGoal: 20, budgetMode: 'shared' } }
  const again = joinHelper(existing, 'alex', 'unused-id', 200)
  assert.equal(again.data, existing)
  assert.equal(again.playerId, 'alex-id')
  const second = joinHelper(existing, 'Sam', 'sam-id', 200)
  assert.equal(second.data.rewards.missionsForGoal, 20)
  assert.equal(second.data.rewards.budgetMode, 'shared')
  assert.deepEqual(second.data.rewards.entries, [])
  assert.equal(validateWorkspace(second.data), true)
})

test('invalid names, duplicate IDs and times leave the original workspace intact', () => {
  const before = emptyWorkspace()
  for (const [name, id, at] of [[' ', 'id', 100], ['a'.repeat(81), 'id', 100], ['Alex', 'griff', 100], ['Alex', 'id', NaN], ['Alex', 'id', -1]]) {
    assert.deepEqual(joinHelper(before, name, id, at), { data: before, playerId: null })
  }
})
