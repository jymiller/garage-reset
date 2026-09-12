// Run with: node src/crates/model.test.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = (await readFile(new URL('./model.ts', import.meta.url), 'utf8')).replaceAll("'../rewards/contract.mjs'", JSON.stringify(new URL('../rewards/contract.mjs', import.meta.url).href))
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const { emptyWorkspace, validateWorkspace, sanitizeWorkspace, volumeStats } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const crate = (patch = {}) => ({
  id: 'crate-a', code: 'A01', name: 'Test crate', location: 'Left shelf', owner: '',
  capacityLiters: 100, baselineFill: 80, currentFill: 80, status: 'unopened',
  photo: null, notes: '', createdAt: 1000, ...patch,
})
const item = (patch = {}) => ({
  id: 'item-a', crateId: 'crate-a', name: 'Test contents', quantity: 1, decision: 'undecided',
  destination: '', departed: false, notes: '', ...patch,
})
const workspace = (patch = {}) => ({ ...emptyWorkspace(), crates: [crate()], ...patch })

test('empty workspace has no seeded inventory and no fictitious progress', () => {
  assert.deepEqual(emptyWorkspace(), { schemaVersion: 1, crates: [], items: [], baselineLocked: false, notes: '' })
  assert.equal(validateWorkspace(emptyWorkspace()), true)
  assert.deepEqual(volumeStats(emptyWorkspace()), {
    baselineLiters: 0, currentLiters: 0, freedLiters: 0, freedPercent: 0, targetLiters: 0,
    remainingToTarget: 0, unopenedCount: 0, undecidedCount: 0, pendingDepartureCount: 0,
  })
  const first = emptyWorkspace()
  first.crates.push(crate())
  assert.equal(emptyWorkspace().crates.length, 0)
})

test('decisions and departure tracking cannot award occupied-volume reductions', () => {
  for (const decision of ['undecided', 'keep', 'donate', 'sell', 'recycle', 'trash']) {
    for (const departed of [true, false]) {
      const stats = volumeStats(workspace({ items: [item({ quantity: 25, decision, departed })] }))
      assert.equal(stats.currentLiters, 80)
      assert.equal(stats.freedLiters, 0)
      assert.equal(stats.freedPercent, 0)
    }
  }
})

test('unopened and sorting crates retain baseline volume until repacking is confirmed', () => {
  for (const status of ['unopened', 'sorting']) {
    const stats = volumeStats(workspace({ crates: [crate({ status, currentFill: 0 })] }))
    assert.equal(stats.currentLiters, 80)
    assert.equal(stats.freedLiters, 0)
    assert.equal(stats.unopenedCount, status === 'unopened' ? 1 : 0)
  }
  const stats = volumeStats(workspace({ crates: [crate({ status: 'repacked', currentFill: 30 })] }))
  assert.equal(stats.currentLiters, 30)
  assert.equal(stats.freedLiters, 50)
  assert.equal(stats.freedPercent, 62.5)
  assert.equal(stats.targetLiters, 40)
  assert.equal(stats.remainingToTarget, 0)
})

test('reconsolidation sums measured occupied volume including crates that become fuller', () => {
  const crates = [
    crate({ capacityLiters: 120, baselineFill: 50, currentFill: 0, status: 'repacked' }),
    crate({ id: 'crate-b', code: 'B01', capacityLiters: 80, baselineFill: 25, currentFill: 75, status: 'repacked' }),
  ]
  const stats = volumeStats(workspace({ crates, baselineLocked: true }))
  assert.equal(stats.baselineLiters, 80)
  assert.equal(stats.currentLiters, 60)
  assert.equal(stats.freedLiters, 20)
  assert.equal(stats.freedPercent, 25)
  assert.equal(stats.remainingToTarget, 20)
  assert.equal(volumeStats(workspace({ crates, baselineLocked: false })).currentLiters, 60)
})

test('increased occupied volume has zero freed credit but increases work remaining', () => {
  const stats = volumeStats(workspace({ crates: [crate({ baselineFill: 20, currentFill: 90, status: 'repacked' })] }))
  assert.equal(stats.baselineLiters, 20)
  assert.equal(stats.currentLiters, 90)
  assert.equal(stats.freedLiters, 0)
  assert.equal(stats.freedPercent, 0)
  assert.equal(stats.remainingToTarget, 80)
})

test('decision counts count records and pending departure only includes outgoing decisions', () => {
  const decisions = ['undecided', 'keep', 'donate', 'sell', 'recycle', 'trash']
  const items = decisions.flatMap((decision, index) => [
    item({ id: `pending-${index}`, decision, quantity: 10 }),
    item({ id: `departed-${index}`, decision, departed: true }),
  ])
  const stats = volumeStats(workspace({ items }))
  assert.equal(stats.undecidedCount, 2)
  assert.equal(stats.pendingDepartureCount, 4)
})

test('validator accepts a complete normalized workspace and rejects invalid links or duplicate identities', () => {
  assert.equal(validateWorkspace(workspace({ items: [item()] })), true)
  assert.equal(validateWorkspace(workspace({ items: [item({ crateId: 'missing' })] })), false)
  assert.equal(validateWorkspace(workspace({ items: [item(), item()] })), false)
  assert.equal(validateWorkspace(workspace({ crates: [crate(), crate({ code: 'B01' })] })), false)
  assert.equal(validateWorkspace(workspace({ crates: [crate(), crate({ id: 'crate-b', code: 'a01' })] })), false)
})

test('validator requires finite capacity, fill, timestamps, and positive integral quantities', () => {
  for (const capacityLiters of [0, -1, 2000.01, NaN, Infinity, '100', null]) {
    assert.equal(validateWorkspace(workspace({ crates: [crate({ capacityLiters })] })), false)
  }
  assert.equal(validateWorkspace(workspace({ crates: [crate({ capacityLiters: 2000, baselineFill: 0, currentFill: 100 })] })), true)
  for (const field of ['baselineFill', 'currentFill']) {
    for (const invalid of [-0.01, 100.01, NaN, Infinity, '80']) {
      assert.equal(validateWorkspace(workspace({ crates: [crate({ [field]: invalid })] })), false)
    }
  }
  for (const createdAt of [-1, NaN, Infinity, 8.64e15 + 1, '1000']) {
    assert.equal(validateWorkspace(workspace({ crates: [crate({ createdAt })] })), false)
  }
  for (const quantity of [0, -1, 1.5, 100001, NaN, Infinity, '2']) {
    assert.equal(validateWorkspace(workspace({ items: [item({ quantity })] })), false)
  }
})

test('validator enforces normalized bounded text and literal enum and boolean fields', () => {
  for (const patch of [{ id: '' }, { code: ' A01 ' }, { name: 'x'.repeat(161) }, { owner: 'x'.repeat(81) },
    { location: 'x'.repeat(161) }, { notes: 'x'.repeat(4001) }, { status: 'done' }]) {
    assert.equal(validateWorkspace(workspace({ crates: [crate(patch)] })), false)
  }
  for (const patch of [{ name: '' }, { departed: 'false' }, { decision: 'discard' }, { destination: 'x'.repeat(241) }]) {
    assert.equal(validateWorkspace(workspace({ items: [item(patch)] })), false)
  }
  for (const invalid of [null, [], 'data', {}, { ...emptyWorkspace(), schemaVersion: 2 },
    { ...emptyWorkspace(), baselineLocked: 'false' }, { ...emptyWorkspace(), notes: ' space ' }]) {
    assert.equal(validateWorkspace(invalid), false)
  }
})

test('photos accept only safe local uploaded paths and never remote URLs or path traversal', () => {
  for (const photo of [null, '/api/photos/upload_123-abc.jpg', '/api/photos/A.png', '/api/photos/42.webp']) {
    assert.equal(validateWorkspace(workspace({ crates: [crate({ photo })] })), true)
  }
  for (const photo of ['https://example.com/a.jpg', '//example.com/a.jpg', 'data:image/png;base64,x',
    '/api/photos/../a.jpg', '/api/photos/%2e%2e.jpg', '/api/photos/a.jpg?token=x', '/api/photos/a.svg', '/api/photos/a/b.jpg']) {
    const data = workspace({ crates: [crate({ photo })] })
    assert.equal(validateWorkspace(data), false)
    assert.equal(sanitizeWorkspace(data).crates[0].photo, null)
  }
})

test('sanitizer keeps valid data, normalizes text, and drops duplicates, bad measurements, and orphans', () => {
  const valid = workspace({ items: [item()], baselineLocked: true, notes: 'Inventory' })
  assert.deepEqual(sanitizeWorkspace(valid), valid)
  const sanitized = sanitizeWorkspace(workspace({
    crates: [crate({ name: ' Test crate ', owner: 'x'.repeat(100), notes: ' Notes ' }),
      crate({ id: 'duplicate-code', code: 'a01' }), crate({ code: 'duplicate-id' }),
      crate({ id: 'bad-capacity', code: 'bad', capacityLiters: -1 }),
      crate({ id: 'bad-baseline', code: 'bad2', baselineFill: NaN })],
    items: [item({ name: ' Test contents ' }), item(), item({ id: 'orphan', crateId: 'missing' }),
      item({ id: 'zero', quantity: 0 })],
    notes: ' Notes ',
  }))
  assert.equal(sanitized.crates.length, 1)
  assert.equal(sanitized.items.length, 1)
  assert.equal(sanitized.crates[0].name, 'Test crate')
  assert.equal(sanitized.crates[0].owner.length, 80)
  assert.equal(sanitized.notes, 'Notes')
  assert.equal(validateWorkspace(sanitized), true)
})

test('corrupt current measurements and statuses cannot manufacture freed volume', () => {
  for (const currentFill of [undefined, NaN, -1, 101, '0']) {
    const recovered = sanitizeWorkspace(workspace({ crates: [crate({ currentFill, status: 'repacked' })] }))
    assert.equal(volumeStats(recovered).freedLiters, 0)
  }
  const recovered = sanitizeWorkspace(workspace({ crates: [crate({ status: 'done', currentFill: 0 })],
    items: [item({ decision: 'discard', departed: 'false' })], baselineLocked: 'true' }))
  assert.equal(recovered.crates[0].status, 'unopened')
  assert.equal(recovered.items[0].decision, 'undecided')
  assert.equal(recovered.items[0].departed, false)
  assert.equal(recovered.baselineLocked, false)
  assert.equal(volumeStats(recovered).freedLiters, 0)
})

test('unknown schema and non-object storage recover to fresh empty data', () => {
  for (const raw of [undefined, null, [], 'corrupt', true, {}, { schemaVersion: 2, crates: [crate()] }]) {
    assert.deepEqual(sanitizeWorkspace(raw), emptyWorkspace())
  }
})
