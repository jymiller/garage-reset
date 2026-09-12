import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { defaultRewards, validateRewardBook, rewardSummary, rewardsTransitionError, assignMission, approveMission, markMissionPaid, updateRewardSettings, addRewardPlayer } from './contract.mjs'
import { validWorkspace as serverValidWorkspace } from '../../server/app.mjs'

const source = (await readFile(new URL('../crates/model.ts', import.meta.url), 'utf8')).replaceAll("'../rewards/contract.mjs'", JSON.stringify(new URL('./contract.mjs', import.meta.url).href))
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { emptyWorkspace, validateWorkspace, sanitizeWorkspace } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const mission = (id = 'm1', patch = {}) => ({ id, title: 'One shelf', area: 'Right rack', kind: 'shelf', crateId: null,
  phase: 'complete', beforePhoto: '/api/photos/before.jpg', afterPhoto: '/api/photos/after.jpg', plannedMinutes: 10,
  elapsedSeconds: 100, runningSince: null, createdAt: 1000, completedAt: 2000, kept: 0, bagged: 0, donated: 0,
  ask: 0, summary: 'Grouped the shelf contents.', parkingClear: true, ...patch })
const workspace = (missions = [mission()]) => ({ ...emptyWorkspace(), missions, rewards: defaultRewards(1000) })
const assigned = (data = workspace()) => assignMission(data, data.missions[0].id, 'griff')
const validBoth = data => { assert.equal(validateWorkspace(data), true); assert.equal(serverValidWorkspace(data), true) }

test('legacy snapshots retain absent rewards; configured rewards survive sanitation and both validators', () => {
  const old = emptyWorkspace()
  assert.deepEqual(sanitizeWorkspace(old), old)
  assert.equal(Object.hasOwn(sanitizeWorkspace(old), 'rewards'), false)
  assert.equal(rewardSummary(old).points, 0)
  const data = assigned()
  validBoth(data)
  assert.deepEqual(sanitizeWorkspace(data), data)
  assert.notEqual(sanitizeWorkspace(data).rewards, data.rewards)
  assert.equal(defaultRewards(1000).players[0].name, 'Griff')
})

test('completed mission attribution gives 100 points once and duplicate actions are idempotent', () => {
  const original = workspace()
  const data = assigned(original)
  assert.equal(original.rewards.entries.length, 0)
  assert.equal(assignMission(data, 'm1', 'griff'), data)
  assert.equal(rewardSummary(data).points, 100)
  assert.equal(rewardSummary(data).potentialCents, 1000)
  const approved = approveMission(data, 'm1', 3000)
  assert.equal(approveMission(approved, 'm1', 4000), approved)
  assert.equal(rewardSummary(approved).approvedCents, 1000)
  assert.equal(rewardSummary(approved).potentialCents, 0)
  const paid = markMissionPaid(approved, 'm1', 4000)
  assert.equal(markMissionPaid(paid, 'm1', 5000), paid)
  assert.equal(rewardSummary(paid).paidCents, 1000)
  assert.equal(rewardSummary(paid).unpaidCents, 0)
  validBoth(paid)
})

test('atomic mission creation and assignment supports independent players and unfinished missions', () => {
  let data = addRewardPlayer(workspace([]), { id: 'friend', name: 'Friend' }, 1000)
  const first = mission('open-1', { phase: 'before', beforePhoto: null, afterPhoto: null, elapsedSeconds: 0, completedAt: null, summary: '', parkingClear: false })
  data = assignMission({ ...data, missions: [...data.missions, first] }, first.id, 'griff')
  const second = { ...first, id: 'open-2' }
  data = assignMission({ ...data, missions: [...data.missions, second] }, second.id, 'friend')
  assert.equal(data.rewards.entries.length, 2)
  assert.equal(rewardSummary(data).points, 0)
  assert.equal(approveMission(data, first.id, 3000), data)
  assert.equal(markMissionPaid(data, first.id, 4000), data)
  validBoth(data)
})

test('attribution is explicit and changeable until approval, with no automatic plan or retroactive owner', () => {
  const old = { ...emptyWorkspace(), missions: [mission()] }
  assert.equal(assignMission(old, 'm1', 'griff'), old)
  assert.equal(rewardSummary(old).points, 0)
  let data = addRewardPlayer(assigned(), { id: 'friend', name: 'Friend' }, 1000)
  data = assignMission(data, 'm1', 'friend')
  assert.equal(rewardSummary(data).players.find(p => p.id === 'friend').points, 100)
  data = approveMission(data, 'm1', 3000)
  assert.equal(assignMission(data, 'm1', 'griff'), data)
})

test('10 and 20 mission plans cap cash at $100 per player without capping points', () => {
  for (const count of [10, 20]) {
    let data = workspace(Array.from({ length: count + 1 }, (_, i) => mission(`m${String(i).padStart(2, '0')}`)))
    data = updateRewardSettings(data, { missionsForGoal: count, budgetMode: 'per-player' })
    for (const m of data.missions) data = assignMission(data, m.id, 'griff')
    assert.equal(rewardSummary(data).potentialCents, 10000)
    for (const [index, m] of data.missions.entries()) data = approveMission(data, m.id, 3000 + index)
    const summary = rewardSummary(data)
    assert.equal(summary.approvedCents, 10000)
    assert.equal(summary.points, (count + 1) * 100)
    const last = summary.entries.at(-1)
    assert.equal(last.allocatedCents, 0)
    assert.equal(markMissionPaid(data, last.missionId, 5000), data)
    validBoth(data)
  }
})

test('shared budget allocates one $100 pool; equal timestamps use mission ID independent of entry order', () => {
  let data = workspace(Array.from({ length: 12 }, (_, i) => mission(`m${String(i).padStart(2, '0')}`)))
  data = addRewardPlayer(data, { id: 'friend', name: 'Friend' }, 1000)
  data = updateRewardSettings(data, { missionsForGoal: 10, budgetMode: 'shared' })
  data = { ...data, rewards: { ...data.rewards, entries: data.missions.map((m, i) => ({ missionId: m.id, playerId: i % 2 ? 'friend' : 'griff', approvedAt: 3000, paidAt: null })).reverse() } }
  validBoth(data)
  assert.equal(rewardSummary(data).approvedCents, 10000)
  assert.deepEqual(rewardSummary(data).players.map(p => p.approvedCents), [5000, 5000])
  assert.equal(rewardSummary(data).entries.find(e => e.missionId === 'm10').allocatedCents, 0)
  assert.equal(rewardSummary(data).entries.find(e => e.missionId === 'm00').allocatedCents, 1000)
})

test('settings lock, approved history and evidence cannot be erased or rewritten', () => {
  const data = approveMission(assigned(), 'm1', 3000)
  assert.equal(updateRewardSettings(data, { missionsForGoal: 20, budgetMode: 'shared' }), data)
  assert.match(rewardsTransitionError(data, { ...data, rewards: undefined }), /remove/)
  assert.match(rewardsTransitionError(data, { ...data, rewards: { ...data.rewards, entries: [] } }), /removed/)
  assert.match(rewardsTransitionError(data, { ...data, missions: [mission('m1', { summary: 'Changed after approval.' })] }), /evidence/)
  const reordered = { ...data, missions: [Object.fromEntries(Object.entries(data.missions[0]).reverse())] }
  assert.equal(rewardsTransitionError(data, reordered), null)
  const paid = markMissionPaid(data, 'm1', 4000)
  assert.match(rewardsTransitionError(paid, data), /payment/)
})

test('a backdated approval cannot displace previously allocated cash', () => {
  let data = workspace(Array.from({ length: 11 }, (_, i) => mission(`m${i}`)))
  for (const m of data.missions) data = assignMission(data, m.id, 'griff')
  for (let i = 0; i < 10; i++) data = approveMission(data, `m${i}`, 4000 + i)
  assert.equal(approveMission(data, 'm10', 3000), data)
  assert.equal(rewardSummary(approveMission(data, 'm10', 5000)).approvedCents, 10000)
})

test('protected reward history allows unrelated crate, mission, spatial and note changes', () => {
  const paid = markMissionPaid(approveMission(assigned(), 'm1', 3000), 'm1', 4000)
  const next = { ...paid, notes: 'Updated from the laptop',
    crates: [{ id: 'crate-new', code: 'C-new', name: 'New crate', location: 'Right shelf', owner: '', capacityLiters: 60, baselineFill: 50, currentFill: 50, status: 'unopened', photo: null, notes: '', createdAt: 5000 }],
    missions: [...paid.missions.map(value => Object.fromEntries(Object.entries(value).reverse())), mission('m2')],
    spatialItems: [{ id: 'spatial-new', name: 'New crate', parentId: 'rack-r4', crateId: 'crate-new', photoId: 'IMG_1928', region: { x: .1, y: .1, w: .2, h: .2 }, x: 21, y: .2, z: .5, w: .6, d: .5, h: .4, dimensionBasis: 'estimated', notes: '', createdAt: 5000 }],
  }
  validBoth(next)
  assert.equal(rewardsTransitionError(paid, next), null)
  assert.equal(rewardSummary(next).paidCents, 1000)
})

test('malformed settings, duplicate references, extra keys and invalid approvals or payments reject identically', () => {
  const data = assigned()
  const mutations = [
    book => { book.extra = true }, book => { book.goalCents = 10000.1 }, book => { book.goalCents = Infinity },
    book => { book.missionsForGoal = 0 }, book => { book.budgetMode = 'anything' },
    book => { book.players.push({ ...book.players[0] }) }, book => { book.players[0].extra = true },
    book => { book.players[0].createdAt = NaN }, book => { book.entries.push({ ...book.entries[0] }) },
    book => { book.entries[0].missionId = 'missing' }, book => { book.entries[0].playerId = 'missing' },
    book => { book.entries[0].extra = true }, book => { book.entries[0].approvedAt = 1999 },
    book => { book.entries[0].paidAt = 4000 }, book => { book.entries[0].approvedAt = 3000; book.entries[0].paidAt = 2999 },
  ]
  for (const mutate of mutations) {
    const next = structuredClone(data); mutate(next.rewards)
    assert.equal(validateWorkspace(next), false)
    assert.equal(serverValidWorkspace(next), false)
  }
  assert.equal(validateRewardBook({ ...data.rewards, entries: [{ ...data.rewards.entries[0], approvedAt: 3000 }] }, [mission('m1', { phase: 'review' })]), false)
})
