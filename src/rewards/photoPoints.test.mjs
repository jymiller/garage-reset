import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'
import { defaultRewards, rewardSummary } from './contract.mjs'
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`
const modelSource = (await readFile(new URL('../crates/model.ts', import.meta.url), 'utf8')).replaceAll("'../rewards/contract.mjs'", JSON.stringify(new URL('./contract.mjs', import.meta.url).href))
const modelURL = compile(modelSource)
const { emptyWorkspace, validateWorkspace, volumeStats } = await import(modelURL)
const source = (await readFile(new URL('./photoPoints.ts', import.meta.url), 'utf8')).replaceAll("'../crates/model'", JSON.stringify(modelURL))
const { approveUsefulPhoto, photoPointsForPlayer, totalPhotoPoints } = await import(compile(source))
const photo = (id, patch = {}) => ({ id, kind: 'crate', photo: `/api/photos/${id}.jpg`, notes: 'Useful context', location: 'Shelf', crateId: null, measurement: null, createdAt: 1000, ...patch })
const workspace = () => ({ ...emptyWorkspace(), notes: 'Keep this workspace note', rewards: defaultRewards(1), observations: [photo('outside', { labelCode: 'C-001', photoRole: 'outside' }), photo('contents', { labelCode: 'C-001', photoRole: 'contents' })] })

test('review adds exactly25 photo points and leaves cash, source photos and volume unchanged', () => {
  const before = workspace()
  const after = approveUsefulPhoto(before, 'outside', 'griff', 2000)
  assert.notEqual(after, before)
  assert.equal(validateWorkspace(after), true)
  assert.deepEqual(after.photoAwards, [{ observationId: 'outside', helperId: 'griff', points: 25, reviewedAt: 2000 }])
  assert.deepEqual(photoPointsForPlayer(after, 'griff'), { count: 1, points: 25 })
  assert.equal(totalPhotoPoints(after), 25)
  assert.deepEqual(rewardSummary(after), rewardSummary(before))
  assert.deepEqual(volumeStats(after), volumeStats(before))
  assert.equal(after.observations, before.observations)
  assert.equal(after.rewards, before.rewards)
  assert.equal(after.crates, before.crates)
  assert.equal(after.items, before.items)
  assert.equal(after.notes, before.notes)
})
test('the same photo cannot receive duplicate or reassigned credit', () => {
  const first = approveUsefulPhoto(workspace(), 'outside', 'griff', 2000)
  assert.equal(approveUsefulPhoto(first, 'outside', 'griff', 3000), first)
  const secondPlayer = { ...first, rewards: { ...first.rewards, players: [...first.rewards.players, { id: 'friend', name: 'Friend', createdAt: 1 }] } }
  assert.equal(approveUsefulPhoto(secondPlayer, 'outside', 'friend', 3000), secondPlayer)
  assert.equal(totalPhotoPoints(secondPlayer), 25)
})
test('outside and contents observations may each receive a separate review', () => {
  const first = approveUsefulPhoto(workspace(), 'outside', 'griff', 2000)
  const second = approveUsefulPhoto(first, 'contents', 'griff', 3000)
  assert.deepEqual(photoPointsForPlayer(second, 'griff'), { count: 2, points: 50 })
})
test('unknown photos/helpers and invalid or premature timestamps do nothing', () => {
  const before = workspace()
  for (const args of [['missing', 'griff', 2000], ['outside', 'missing', 2000], ['outside', '', 2000], ['outside', 'griff', -1], ['outside', 'griff', 999], ['outside', 'griff', Infinity], ['outside', 'griff', NaN], ['outside', 'griff', 8.64e15 + 1]]) assert.equal(approveUsefulPhoto(before, ...args), before)
  assert.equal(approveUsefulPhoto({ ...before, rewards: undefined }, 'outside', 'griff', 2000).photoAwards, undefined)
})
test('anonymous source photos can be credited without rewriting capture attribution', () => {
  const before = workspace()
  const after = approveUsefulPhoto(before, 'outside', 'griff', 2000)
  assert.equal(after.observations[0].helperId, undefined)
  assert.equal(after.photoAwards[0].helperId, 'griff')
})
test('score helpers do not count malformed, negative, duplicate, or unknown credit', () => {
  const base = workspace()
  const award = { observationId: 'outside', helperId: 'griff', points: 25, reviewedAt: 2000 }
  const malformed = { ...base, photoAwards: [award, award, { ...award, observationId: 'contents', points: -25 }, { ...award, observationId: 'absent' }] }
  assert.deepEqual(photoPointsForPlayer(malformed, 'griff'), { count: 1, points: 25 })
  assert.equal(totalPhotoPoints(malformed), 25)
  assert.deepEqual(photoPointsForPlayer(malformed, 'unknown'), { count: 0, points: 0 })
  assert.deepEqual(photoPointsForPlayer(base, null), { count: 0, points: 0 })
})
