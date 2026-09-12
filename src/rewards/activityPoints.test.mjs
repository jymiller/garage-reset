import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'
import { defaultRewards, rewardSummary } from './contract.mjs'
const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')
const modelSource = (await readFile(new URL('../crates/model.ts', import.meta.url), 'utf8')).replaceAll("'../rewards/contract.mjs'", JSON.stringify(new URL('./contract.mjs', import.meta.url).href))
const modelURL = compile(modelSource)
const { emptyWorkspace, validateWorkspace, volumeStats } = await import(modelURL)
const source = (await readFile(new URL('./activityPoints.ts', import.meta.url), 'utf8')).replaceAll("'../crates/model'", JSON.stringify(modelURL))
const { stickerCredit, inventoryCredit, activityPointsForPlayer, totalActivityPoints } = await import(compile(source))
const crate = { id: 'crate-one', code: 'C-001', name: 'Kitchen box', location: 'Middle shelf', owner: '', capacityLiters: 60, baselineFill: 50, currentFill: 50, status: 'sorting', photo: null, notes: '', createdAt: 1000 }
const item = id => ({ id, crateId: crate.id, name: id, quantity: 2, decision: 'undecided', destination: '', departed: false, notes: '' })
const workspace = () => ({ ...emptyWorkspace(), notes: 'Keep the original notes', rewards: defaultRewards(1), crates: [crate], items: [item('mugs'), item('kettle'), item('pan')], observations: [{ id: 'photo-one', kind: 'crate', photo: '/api/photos/one.jpg', notes: '', location: '', crateId: null, measurement: null, createdAt: 1 }], photoAwards: [{ observationId: 'photo-one', helperId: 'griff', points: 25, reviewedAt: 2 }] })

test('front and lid each earn25 once with canonical deterministic IDs', () => {
  const before = workspace()
  const front = stickerCredit(before, ' c-001 ', 'front', 'griff', 2000)
  assert.equal(validateWorkspace(front), true)
  assert.equal(front.activityCredits[0].id, 'sticker:C-001:front')
  assert.equal(stickerCredit(front, 'C-001', 'front', 'griff', 3000), front)
  const both = stickerCredit(front, 'C-001', 'lid', 'griff', 3000)
  assert.deepEqual(activityPointsForPlayer(both, 'griff'), { stickerCount: 2, stickerPoints: 50, inventoryCount: 0, inventoryPoints: 0, points: 50 })
  assert.equal(totalActivityPoints(both), 50)
})
test('one actual inventory batch gets25, regardless of the number of item records', () => {
  const before = workspace()
  const after = inventoryCredit(before, crate, ['mugs', 'kettle'], 'griff', 2000, 'batch-one')
  assert.equal(validateWorkspace(after), true)
  assert.deepEqual(after.activityCredits, [{ id: 'batch-one', kind: 'inventory', helperId: 'griff', points: 25, createdAt: 2000, labelCode: 'C-001', itemIds: ['mugs', 'kettle'] }])
  assert.deepEqual(activityPointsForPlayer(after, 'griff'), { stickerCount: 0, stickerPoints: 0, inventoryCount: 1, inventoryPoints: 25, points: 25 })
})
test('credited items cannot earn again, including overlapping batches and different IDs', () => {
  const once = inventoryCredit(workspace(), crate, ['mugs', 'kettle'], 'griff', 2000, 'batch-one')
  assert.equal(inventoryCredit(once, crate, ['mugs', 'kettle'], 'griff', 3000, 'batch-two'), once)
  assert.equal(inventoryCredit(once, crate, ['kettle', 'pan'], 'griff', 3000, 'batch-two'), once)
  assert.equal(inventoryCredit(once, crate, ['pan'], 'griff', 3000, 'batch-one'), once)
  assert.equal(inventoryCredit(once, crate, ['pan'], 'griff', 3000, 'batch-two').activityCredits.length, 2)
})
test('sticker credit cannot be reassigned to another helper', () => {
  const first = stickerCredit(workspace(), 'C-001', 'front', 'griff', 2000)
  const withFriend = { ...first, rewards: { ...first.rewards, players: [...first.rewards.players, { id: 'friend', name: 'Friend', createdAt: 1 }] } }
  assert.equal(stickerCredit(withFriend, 'C-001', 'front', 'friend', 3000), withFriend)
  assert.equal(activityPointsForPlayer(withFriend, 'friend').points, 0)
})
test('missing helpers, invalid surfaces/codes/times, and empty or invalid batches do nothing', () => {
  const before = workspace()
  for (const args of [['C-000', 'front', 'griff', 2000], ['wrong', 'front', 'griff', 2000], ['C-001', 'side', 'griff', 2000], ['C-001', 'front', 'missing', 2000], ['C-001', 'front', 'griff', -1], ['C-001', 'front', 'griff', Infinity]]) assert.equal(stickerCredit(before, ...args), before)
  for (const ids of [[], ['mugs', 'mugs'], ['missing']]) assert.equal(inventoryCredit(before, crate, ids, 'griff', 2000, 'batch-one'), before)
  assert.equal(inventoryCredit(before, { ...crate, code: 'C-002' }, ['mugs'], 'griff', 2000, 'batch-one'), before)
  assert.equal(inventoryCredit(before, crate, ['mugs'], 'missing', 2000, 'batch-one'), before)
  assert.equal(inventoryCredit(before, crate, ['mugs'], 'griff', NaN, 'batch-one'), before)
  const zeroQuantity = { ...before, items: [{ ...item('mugs'), quantity: 0 }] }
  assert.equal(inventoryCredit(zeroQuantity, crate, ['mugs'], 'griff', 2000, 'batch-one'), zeroQuantity)
})
test('activity credit preserves cash, photo awards, inventory, and all other source fields', () => {
  const before = workspace()
  const after = inventoryCredit(stickerCredit(before, 'C-001', 'front', 'griff', 2000), crate, ['mugs'], 'griff', 3000, 'batch-one')
  for (const key of ['crates', 'items', 'observations', 'photoAwards', 'rewards', 'notes']) assert.equal(after[key], before[key])
  assert.deepEqual(rewardSummary(after), rewardSummary(before))
  assert.deepEqual(volumeStats(after), volumeStats(before))
  assert.deepEqual(activityPointsForPlayer(after, null), { stickerCount: 0, stickerPoints: 0, inventoryCount: 0, inventoryPoints: 0, points: 0 })
})
test('custom crate spelling is preserved and later item moves keep earned credit', () => {
  const custom = { ...crate, code: 'CampingA' }
  const data = { ...workspace(), crates: [custom] }
  const credited = inventoryCredit(data, custom, ['mugs'], 'griff', 2000, 'batch-custom')
  assert.equal(credited.activityCredits[0].labelCode, 'CampingA')
  const other = { ...crate, id: 'crate-two', code: 'C-002' }
  const moved = { ...credited, crates: [custom, other], items: credited.items.map(item => item.id === 'mugs' ? { ...item, crateId: other.id } : item) }
  assert.equal(validateWorkspace(moved), true)
  assert.equal(activityPointsForPlayer(moved, 'griff').inventoryPoints, 25)
  assert.equal(inventoryCredit(moved, other, ['mugs'], 'griff', 3000, 'batch-repeated'), moved)
  assert.equal(inventoryCredit(data, custom, ['mugs'], 'griff', 2000, 'x'.repeat(121)), data)
})
