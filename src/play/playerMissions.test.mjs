// Run with: node src/play/playerMissions.test.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const moduleUrl = async (path, replacements = {}) => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  for (const [specifier, url] of Object.entries(replacements)) compiled = compiled.replaceAll(`'${specifier}'`, `'${url}'`)
  return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
}
const rewardsUrl = new URL('../rewards/contract.mjs', import.meta.url).href
const modelUrl = await moduleUrl('../crates/model.ts', { '../rewards/contract.mjs': rewardsUrl })
const missionUrl = await moduleUrl('./mission.ts', { '../crates/model': modelUrl })
const { validateWorkspace, emptyWorkspace } = await import(modelUrl)
const { createMission } = await import(missionUrl)
const { openMissionsForPlayer, savePlayerMissionSetup } = await import(await moduleUrl('./playerMissions.ts', {
  '../crates/model': modelUrl, '../rewards/model': rewardsUrl, './mission': missionUrl,
}))

const book = () => ({ version: 1, goalCents: 10000, missionsForGoal: 10, budgetMode: 'per-player',
  players: [{ id: 'john', name: 'John', createdAt: 1 }, { id: 'friend', name: 'Friend', createdAt: 1 }], entries: [] })
const workspace = () => ({ ...emptyWorkspace(), rewards: book() })
const setup = (id, playerId, extra = {}) => ({ id, playerId, editing: false, kind: 'floor', area: 'Front floor',
  crateId: null, plannedMinutes: 10, title: 'Clear a floor area', defaultArea: 'Front floor', ...extra })
const save = (data, id, playerId, extra) => savePlayerMissionSetup(data, setup(id, playerId, extra), 10)
const completed = mission => ({ ...mission, phase: 'complete', beforePhoto: '/api/photos/before.jpg', afterPhoto: '/api/photos/after.jpg',
  summary: 'Floor clear', parkingClear: true, completedAt: 20 })

test('different players create independent missions and attribution in one snapshot', () => {
  const initial = workspace()
  const first = save(initial, 'john-round', 'john')
  const second = save(first.data, 'friend-round', 'friend')
  assert.equal(first.error, null)
  assert.equal(second.error, null)
  assert.equal(initial.missions, undefined)
  assert.deepEqual(second.data.rewards.entries, [
    { missionId: 'john-round', playerId: 'john', approvedAt: null, paidAt: null },
    { missionId: 'friend-round', playerId: 'friend', approvedAt: null, paidAt: null },
  ])
  assert.equal(validateWorkspace(second.data), true)
  assert.deepEqual(openMissionsForPlayer(second.data, 'john').map(m => m.id), ['john-round'])
  assert.deepEqual(openMissionsForPlayer(second.data, 'friend').map(m => m.id), ['friend-round'])
  assert.deepEqual(openMissionsForPlayer(second.data, null), [])
  assert.deepEqual(openMissionsForPlayer(second.data, 'removed-player'), [])
})

test('the same player cannot start a second mission against a newer snapshot', () => {
  const data = save(workspace(), 'first', 'john').data
  const rejected = save(data, 'second', 'john')
  assert.equal(rejected.data, data)
  assert.equal(rejected.missionId, null)
  assert.match(rejected.error, /John already has an unfinished mission/)
  assert.equal(data.rewards.entries.length, 1)
})

test('new rewarded missions require an explicit existing player', () => {
  for (const playerId of [null, '', 'deleted']) {
    const data = workspace()
    const rejected = save(data, 'new', playerId)
    assert.equal(rejected.data, data)
    assert.equal(rejected.missionId, null)
    assert.match(rejected.error, /Choose a registered player/)
    assert.equal(data.missions, undefined)
  }
})

test('legacy no-plan missions still work without assignment and retain one-open limit', () => {
  const first = save(emptyWorkspace(), 'legacy', null)
  assert.equal(first.error, null)
  assert.equal('rewards' in first.data, false)
  assert.deepEqual(openMissionsForPlayer(first.data, null).map(m => m.id), ['legacy'])
  const rejected = save(first.data, 'another', null)
  assert.equal(rejected.data, first.data)
  assert.match(rejected.error, /Continue the unfinished mission/)
})

test('an old unassigned mission neither gains a player nor blocks another player', () => {
  const legacy = createMission({ id: 'legacy', kind: 'floor', title: 'Old mission', area: 'Front floor', plannedMinutes: 10 }, 1)
  const data = { ...workspace(), missions: [legacy] }
  const first = save(data, 'new', 'john')
  assert.equal(first.error, null)
  assert.equal(first.data.missions[0], legacy)
  assert.equal(first.data.rewards.entries.some(entry => entry.missionId === 'legacy'), false)
  const edited = save(first.data, 'legacy', null, { editing: true, plannedMinutes: 5 })
  assert.equal(edited.error, null)
  assert.equal(edited.data.rewards.entries.some(entry => entry.missionId === 'legacy'), false)
})

test('before-mission edits preserve its title, photo, date and attribution', () => {
  const created = save(workspace(), 'mine', 'john').data
  const mission = { ...created.missions[0], title: 'My own title', beforePhoto: '/api/photos/original.jpg' }
  const data = { ...created, missions: [mission] }
  const entry = data.rewards.entries[0]
  const edited = save(data, 'mine', 'john', { editing: true, plannedMinutes: 15 })
  assert.equal(edited.error, null)
  assert.equal(edited.data.missions[0].plannedMinutes, 15)
  assert.equal(edited.data.missions[0].title, 'My own title')
  assert.equal(edited.data.missions[0].beforePhoto, '/api/photos/original.jpg')
  assert.equal(edited.data.missions[0].createdAt, mission.createdAt)
  assert.equal(edited.data.rewards.entries[0], entry)
  assert.equal(data.missions[0].plannedMinutes, 10)
})

test('changing area keeps the title while changing mission kind refreshes it', () => {
  const data = save(workspace(), 'mine', 'john').data
  data.missions[0].beforePhoto = '/api/photos/original.jpg'
  const edited = save(data, 'mine', 'john', { editing: true, area: 'Back floor' })
  assert.equal(edited.error, null)
  assert.equal(edited.data.missions[0].beforePhoto, null)
  assert.equal(edited.data.missions[0].title, data.missions[0].title)
  assert.equal(edited.data.missions[0].createdAt, 10)
  assert.equal(edited.data.rewards.entries[0], data.rewards.entries[0])
  const differentKind = save(data, 'mine', 'john', { editing: true, kind: 'shelf', title: 'Sort a shelf' })
  assert.equal(differentKind.error, null)
  assert.equal(differentKind.data.missions[0].title, 'Sort a shelf')
  assert.equal(differentKind.data.missions[0].beforePhoto, null)
  assert.equal(differentKind.data.rewards.entries[0], data.rewards.entries[0])
})

test('switching crates refreshes the crate label without changing its player', () => {
  const crate = (id, code) => ({ id, code, name: code, location: 'Shelf', owner: '', capacityLiters: 60,
    baselineFill: 100, currentFill: 100, status: 'unopened', photo: null, notes: '', createdAt: 1 })
  const data = { ...workspace(), crates: [crate('one', 'C-001'), crate('two', 'C-002')] }
  const first = save(data, 'mine', 'john', { kind: 'crate', crateId: 'one' }).data
  assert.equal(first.missions[0].title, 'Sort C-001')
  first.missions[0].beforePhoto = '/api/photos/first-crate.jpg'
  const second = save(first, 'mine', 'john', { editing: true, kind: 'crate', crateId: 'two' })
  assert.equal(second.error, null)
  assert.equal(second.data.missions[0].title, 'Sort C-002')
  assert.equal(second.data.missions[0].beforePhoto, null)
  assert.equal(second.data.rewards.entries[0], first.rewards.entries[0])
  const timing = save(second.data, 'mine', 'john', { editing: true, kind: 'crate', crateId: 'two', plannedMinutes: 15 })
  assert.equal(timing.error, null)
  assert.equal(timing.data.missions[0].title, 'Sort C-002')
})

test('an explicit reassignment is atomic and cannot move onto a busy player', () => {
  const first = save(workspace(), 'first', 'john').data
  const reassigned = save(first, 'first', 'friend', { editing: true })
  assert.equal(reassigned.error, null)
  assert.equal(reassigned.data.rewards.entries[0].playerId, 'friend')
  assert.equal(first.rewards.entries[0].playerId, 'john')
  const two = save(first, 'second', 'friend').data
  const rejected = save(two, 'first', 'friend', { editing: true, area: 'Changed area' })
  assert.equal(rejected.data, two)
  assert.match(rejected.error, /Friend already has an unfinished mission/)
  assert.equal(two.missions[0].area, 'Front floor')
})

test('editing cannot remove attribution or modify an active/completed mission', () => {
  const data = save(workspace(), 'first', 'john').data
  assert.equal(save(data, 'first', null, { editing: true }).data, data)
  for (const mission of [
    { ...data.missions[0], phase: 'active', beforePhoto: '/api/photos/before.jpg', runningSince: 11 },
    completed(data.missions[0]),
  ]) {
    const current = { ...data, missions: [mission] }
    const rejected = save(current, 'first', 'friend', { editing: true })
    assert.equal(rejected.data, current)
    assert.match(rejected.error, /changed/)
  }
})

test('completed missions do not block new ones and approval/payment entries stay intact', () => {
  const data = save(workspace(), 'first', 'john').data
  data.missions = [completed(data.missions[0])]
  data.rewards.entries[0] = { ...data.rewards.entries[0], approvedAt: 21, paidAt: 22 }
  const next = savePlayerMissionSetup(data, setup('second', 'john'), 30)
  assert.equal(next.error, null)
  assert.deepEqual(next.data.rewards.entries[0], data.rewards.entries[0])
  assert.deepEqual(openMissionsForPlayer(next.data, 'john').map(m => m.id), ['second'])
})

test('invalid fields or missing crate references leave both mission and attribution unchanged', () => {
  for (const extra of [{ area: 'x'.repeat(161) }, { kind: 'crate', crateId: 'missing' }, { plannedMinutes: 7 }, { title: '' }]) {
    const data = workspace()
    const rejected = save(data, 'invalid', 'john', extra)
    assert.equal(rejected.data, data)
    assert.equal(rejected.missionId, null)
    assert.ok(rejected.error)
  }
})
