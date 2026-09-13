// Run with: node src/crates/model.test.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'
import { defaultRewards, rewardSummary } from '../rewards/contract.mjs'

const source = (await readFile(new URL('./model.ts', import.meta.url), 'utf8')).replaceAll("'../rewards/contract.mjs'", JSON.stringify(new URL('../rewards/contract.mjs', import.meta.url).href))
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const { emptyWorkspace, validateWorkspace, sanitizeWorkspace, validateObservation, validatePhotoAward, validateActivityCredit, volumeStats, observationLabelCodes, observationHasLabel } =
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
const observation = (patch = {}) => ({
  id: 'observation-one', kind: 'crate', photo: '/api/photos/one.jpg', notes: '', location: '',
  crateId: null, measurement: null, createdAt: 1000, ...patch,
})
const measurement = (patch = {}) => ({ value: 84.5, unit: 'in', label: 'Between the parking lines', basis: 'user-measured', ...patch })
const photoAward = (patch = {}) => ({ observationId: 'observation-one', helperId: 'griff', points: 25, reviewedAt: 2000, ...patch })
const stickerCredit = (patch = {}) => ({ id: 'sticker:C-001:front', kind: 'sticker', helperId: 'griff', points: 25, createdAt: 2000, labelCode: 'C-001', surface: 'front', ...patch })
const inventoryCredit = (patch = {}) => ({ id: 'inventory-one', kind: 'inventory', helperId: 'griff', points: 25, createdAt: 2000, labelCode: 'A01', itemIds: ['item-a'], ...patch })

test('one shelf photo can identify several labeled crates without inventory or volume changes', () => {
  const before = emptyWorkspace()
  const photo = observation({ labelCodes: ['C-001', 'C-002', 'C-003', 'C-004'], photoRole: 'outside' })
  const after = { ...before, observations: [photo] }
  assert.equal(validateWorkspace(after), true)
  assert.deepEqual(sanitizeWorkspace(after), after)
  assert.notEqual(sanitizeWorkspace(after).observations[0].labelCodes, photo.labelCodes)
  assert.deepEqual(volumeStats(after), volumeStats(before))
  assert.deepEqual(after.crates, [])
  assert.deepEqual(after.items, [])
  assert.equal(after.rewards, undefined)
  for (const code of photo.labelCodes) {
    assert.equal(observationHasLabel(photo, code), true)
    assert.equal([photo].filter(entry => observationHasLabel(entry, code) && entry.photoRole === 'contents').length, 0)
  }
  assert.equal(observationHasLabel(photo, 'C-005'), false)
})

test('photo matching combines explicit labels, deduplicates the primary label, and preserves legacy fallback', () => {
  const crates = [crate({ code: 'c-009' })]
  assert.deepEqual(observationLabelCodes(observation()), [])
  assert.deepEqual(observationLabelCodes(observation({ crateId: 'crate-a' }), crates), ['C-009'])
  assert.equal(observationHasLabel(observation({ crateId: 'crate-a' }), ' c-009 ', crates), true)
  assert.deepEqual(observationLabelCodes(observation({ crateId: 'missing' }), crates), [])
  const explicit = observation({ labelCode: 'C-001', labelCodes: ['C-001', 'C-002'], crateId: 'crate-a' })
  assert.deepEqual(observationLabelCodes(explicit, crates), ['C-001', 'C-002'])
  assert.equal(observationHasLabel(explicit, 'C-009', crates), false)
  assert.deepEqual(observationLabelCodes(observation({ labelCode: 'C-001', crateId: 'crate-a' }), crates), ['C-001'])
  assert.deepEqual(observationLabelCodes(observation({ labelCodes: ['C-002'], crateId: 'crate-a' }), crates), ['C-002'])
})

test('multiple photo labels are optional, canonical, unique and bounded', () => {
  assert.equal(validateObservation(observation()), true)
  assert.equal(Object.hasOwn(sanitizeWorkspace({ ...emptyWorkspace(), observations: [observation()] }).observations[0], 'labelCodes'), false)
  for (const labelCodes of [[], ['C-001'], ['C-999'], Array.from({ length: 32 }, (_, i) => `C-${String(i + 1).padStart(3, '0')}`)]) {
    assert.equal(validateObservation(observation({ labelCodes })), true)
  }
  for (const labelCodes of [null, undefined, 'C-001', {}, ['C-001', 'C-001'], ['C-000'], ['c-001'], [' C-001'], ['C-001 '], ['C-1'], ['C-1000'], [1], [''], Array.from({ length: 33 }, (_, i) => `C-${String(i + 1).padStart(3, '0')}`)]) {
    assert.equal(validateObservation(observation({ labelCodes })), false, JSON.stringify(labelCodes))
    assert.equal(validateWorkspace({ ...emptyWorkspace(), observations: [observation({ labelCodes })] }), false)
  }
})

test('activity credit receipts preserve legacy data and earn no cleanup cash or volume', () => {
  assert.equal(Object.hasOwn(sanitizeWorkspace(emptyWorkspace()), 'activityCredits'), false)
  assert.equal(validateWorkspace({ ...emptyWorkspace(), activityCredits: [] }), true)
  const data = workspace({ items: [item()], rewards: defaultRewards(1000), activityCredits: [stickerCredit(), inventoryCredit()] })
  assert.equal(validateWorkspace(data), true)
  assert.deepEqual(sanitizeWorkspace(data), data)
  const cash = rewardSummary(data)
  for (const key of ['points', 'potentialCents', 'approvedCents', 'paidCents', 'unpaidCents']) assert.equal(cash[key], 0, key)
  assert.equal(volumeStats(data).freedLiters, 0)
  assert.deepEqual(data.rewards.entries, [])
  const moved = { ...data, crates: [...data.crates, crate({ id: 'crate-b', code: 'B02' })], items: [item({ crateId: 'crate-b', destination: 'Another shelf', decision: 'keep' })] }
  assert.equal(validateWorkspace(moved), true)
  assert.deepEqual(sanitizeWorkspace(moved), moved)
})

test('activity credits require exact variant fields, bounded IDs and deterministic sticker surfaces', () => {
  for (const make of [stickerCredit, inventoryCredit]) {
    for (const patch of [{ id: '' }, { id: ' id ' }, { id: 'x'.repeat(121) }, { helperId: '' },
      { helperId: 'x'.repeat(121) }, { points: 50 }, { points: '25' }, { createdAt: -1 }, { createdAt: NaN },
      { createdAt: Infinity }, { createdAt: 8.64e15 + 1 }, { labelCode: '' }, { labelCode: ' A01' },
      { labelCode: 'x'.repeat(33) }, { kind: 'photo' }, { extra: true }]) {
      assert.equal(validateActivityCredit(make(patch)), false, JSON.stringify(patch))
    }
    for (const key of Object.keys(make())) {
      const incomplete = make(); delete incomplete[key]
      assert.equal(validateActivityCredit(incomplete), false, key)
    }
  }
  for (const patch of [{ id: 'random-id' }, { labelCode: 'C-000' }, { labelCode: 'c-001' }, { labelCode: 'C-1000' },
    { surface: 'bottom' }, { surface: 'lid' }, { itemIds: [] }]) assert.equal(validateActivityCredit(stickerCredit(patch)), false)
  assert.equal(validateActivityCredit(stickerCredit({ id: 'sticker:C-999:lid', labelCode: 'C-999', surface: 'lid' })), true)
  for (const patch of [{ surface: 'front' }, { itemIds: [] }, { itemIds: ['item-a', 'item-a'] },
    { itemIds: [''] }, { itemIds: [' item '] }, { itemIds: ['x'.repeat(121)] },
    { itemIds: Array.from({ length: 101 }, (_, i) => `item-${i}`) }]) assert.equal(validateActivityCredit(inventoryCredit(patch)), false)
  assert.equal(validateActivityCredit(inventoryCredit({ itemIds: Array.from({ length: 100 }, (_, i) => `item-${i}`) })), true)
  assert.equal(validateActivityCredit(inventoryCredit({ labelCode: 'Camping / A01' })), true)
})

test('activity links award each sticker surface and inventory item once across helpers', () => {
  const rewards = defaultRewards(1000)
  rewards.players.push({ id: 'alex', name: 'Alex', createdAt: 1000 })
  const base = workspace({ items: [item()], rewards })
  for (const activityCredits of [null, {}, [stickerCredit(), stickerCredit({ helperId: 'alex' })],
    [stickerCredit({ helperId: 'missing' })], [inventoryCredit({ itemIds: ['missing'] })],
    [inventoryCredit(), inventoryCredit({ id: 'another', helperId: 'alex' })]]) {
    assert.equal(validateWorkspace({ ...base, activityCredits }), false)
  }
  assert.equal(validateWorkspace({ ...emptyWorkspace(), activityCredits: [stickerCredit()] }), false)
  assert.equal(validateWorkspace({ ...base, activityCredits: [stickerCredit(), stickerCredit({ id: 'sticker:C-001:lid', surface: 'lid', helperId: 'alex' }), inventoryCredit()] }), true)
  const original = inventoryCredit()
  const sanitized = sanitizeWorkspace({ ...base, activityCredits: [original, inventoryCredit({ id: 'duplicate-item' }),
    stickerCredit({ helperId: 'missing' }), stickerCredit({ points: 100 }), stickerCredit()] })
  assert.deepEqual(sanitized.activityCredits, [original, stickerCredit()])
  assert.notEqual(sanitized.activityCredits[0].itemIds, original.itemIds)
  assert.equal(validateWorkspace(sanitized), true)
})

test('reviewed photo points preserve legacy snapshots and never produce cleanup cash or volume credit', () => {
  assert.equal(Object.hasOwn(sanitizeWorkspace(emptyWorkspace()), 'photoAwards'), false)
  const data = { ...emptyWorkspace(), rewards: defaultRewards(1000), observations: [observation({ kind: 'placement', notes: 'Bin moved beside the rack.' })], photoAwards: [photoAward()] }
  assert.equal(validateWorkspace(data), true)
  assert.deepEqual(sanitizeWorkspace(data), data)
  assert.equal(Object.hasOwn(data.observations[0], 'helperId'), false)
  assert.equal(Object.hasOwn(data, 'missions'), false)
  const cash = rewardSummary(data)
  for (const key of ['points', 'potentialCents', 'approvedCents', 'paidCents', 'unpaidCents']) assert.equal(cash[key], 0, key)
  assert.equal(volumeStats(data).freedLiters, 0)
  assert.deepEqual(data.rewards.entries, [])
})

test('photo awards require one valid 25-point review per existing photo and helper', () => {
  const base = { ...emptyWorkspace(), rewards: defaultRewards(1000), observations: [observation()] }
  for (const patch of [{ observationId: '' }, { observationId: ' id ' }, { observationId: 'x'.repeat(121) },
    { helperId: '' }, { helperId: 'x'.repeat(121) }, { helperId: null }, { points: 100 }, { points: '25' },
    { points: 25.1 }, { reviewedAt: -1 }, { reviewedAt: NaN }, { reviewedAt: Infinity },
    { reviewedAt: '2000' }, { reviewedAt: 8.64e15 + 1 }, { extra: true }]) {
    assert.equal(validatePhotoAward(photoAward(patch)), false, JSON.stringify(patch))
  }
  for (const field of Object.keys(photoAward())) {
    const incomplete = photoAward(); delete incomplete[field]
    assert.equal(validatePhotoAward(incomplete), false, field)
  }
  for (const awards of [null, {}, [photoAward(), photoAward()], [photoAward({ helperId: 'missing' })],
    [photoAward({ observationId: 'missing' })], [photoAward({ reviewedAt: 999 })]]) {
    assert.equal(validateWorkspace({ ...base, photoAwards: awards }), false)
  }
  assert.equal(validateWorkspace({ ...base, photoAwards: [photoAward({ reviewedAt: 1000 })] }), true)
  assert.equal(validateWorkspace({ ...emptyWorkspace(), photoAwards: [] }), true)
  assert.equal(validateWorkspace({ ...emptyWorkspace(), photoAwards: [photoAward()] }), false)
})

test('photo award recovery keeps valid immutable values without repairing a missing review or reference', () => {
  const good = photoAward()
  const base = { ...emptyWorkspace(), rewards: defaultRewards(1000), observations: [observation()] }
  const result = sanitizeWorkspace({ ...base, photoAwards: [good, good, photoAward({ reviewedAt: 999 }),
    photoAward({ observationId: 'missing' }), photoAward({ helperId: 'missing' }), photoAward({ points: 50 })] })
  assert.deepEqual(result.photoAwards, [good])
  assert.notEqual(result.photoAwards[0], good)
  assert.equal(validateWorkspace(result), true)
})

test('quick photos need no inventory, player, mission or measurement and preserve legacy absence', () => {
  assert.equal(Object.hasOwn(sanitizeWorkspace(emptyWorkspace()), 'observations'), false)
  for (const kind of ['general', 'crate', 'parking', 'measurement', 'placement']) {
    const data = { ...emptyWorkspace(), observations: [observation({ kind })] }
    assert.equal(validateWorkspace(data), true)
    assert.deepEqual(sanitizeWorkspace(data), data)
    assert.equal(volumeStats(data).baselineLiters, 0)
    assert.equal(volumeStats(data).freedLiters, 0)
    assert.equal(Object.hasOwn(data, 'missions'), false)
    assert.equal(Object.hasOwn(data, 'rewards'), false)
  }
})

test('general photos preserve optional-free capture and reject unknown kinds during recovery', () => {
  const photo = observation({ kind: 'general' })
  assert.equal(validateObservation(photo), true)
  for (const field of ['labelCode', 'photoRole', 'helperId']) assert.equal(Object.hasOwn(photo, field), false)
  assert.equal(photo.crateId, null)
  assert.equal(photo.measurement, null)
  const data = { ...emptyWorkspace(), observations: [photo] }
  assert.equal(validateWorkspace(data), true)
  assert.deepEqual(sanitizeWorkspace(data), data)
  const unknown = observation({ id: 'unknown', kind: 'anything' })
  assert.equal(validateObservation(unknown), false)
  assert.equal(validateWorkspace({ ...data, observations: [photo, unknown] }), false)
  assert.deepEqual(sanitizeWorkspace({ ...data, observations: [photo, unknown] }), data)
})

test('quick photo measurements preserve explicit units and cannot change a linked crate capacity', () => {
  for (const kind of ['crate', 'parking', 'measurement']) {
    for (const unit of ['cm', 'm', 'in', 'ft']) {
      const data = workspace({ observations: [observation({ kind, crateId: 'crate-a', measurement: measurement({ unit }) })] })
      assert.equal(validateWorkspace(data), true)
      const restored = sanitizeWorkspace(data)
      assert.deepEqual(restored, data)
      assert.notEqual(restored.observations[0].measurement, data.observations[0].measurement)
      assert.equal(restored.crates[0].capacityLiters, 100)
      assert.deepEqual(volumeStats(restored), volumeStats(workspace()))
    }
  }
})

test('quick photo validator rejects unsafe URLs, malformed fields, duplicate IDs and orphan links', () => {
  for (const patch of [
    { id: '' }, { id: ' duplicate ' }, { id: 'x'.repeat(121) }, { kind: 'floor' }, { notes: ' untrimmed' },
    { notes: 'x'.repeat(4001) }, { location: 'x'.repeat(161) }, { createdAt: -1 }, { createdAt: Infinity },
    { createdAt: NaN }, { createdAt: '1000' }, { createdAt: 8.64e15 + 1 }, { crateId: '' },
    { photo: null }, { photo: 'https://example.com/photo.jpg' }, { photo: '/api/photos/../one.jpg' },
    { photo: '/api/photos/one.jpg?key=private' }, { photo: 'data:image/jpeg;base64,abc' }, { photo: '/evidence/one.jpg' },
    { surprise: true },
  ]) assert.equal(validateObservation(observation(patch)), false, JSON.stringify(patch))
  for (const field of Object.keys(observation())) {
    const incomplete = observation(); delete incomplete[field]
    assert.equal(validateObservation(incomplete), false, field)
  }
  for (const observations of [null, {}, [observation(), observation()], [observation({ crateId: 'missing' })]]) {
    assert.equal(validateWorkspace(workspace({ observations })), false)
  }
})

test('quick measurements require an explicit positive finite user reading and named endpoints', () => {
  for (const patch of [
    { value: 0 }, { value: -1 }, { value: NaN }, { value: Infinity }, { value: 1e6 + 1 }, { value: '84' },
    { unit: 'feet' }, { basis: 'estimated' }, { basis: 'photo-inferred' }, { label: '' },
    { label: ' space ' }, { label: 'x'.repeat(161) }, { extra: true },
  ]) assert.equal(validateObservation(observation({ measurement: measurement(patch) })), false, JSON.stringify(patch))
  for (const field of Object.keys(measurement())) {
    const incomplete = measurement(); delete incomplete[field]
    assert.equal(validateObservation(observation({ measurement: incomplete })), false, field)
  }
  for (const value of [Number.MIN_VALUE, 1e6]) {
    assert.equal(validateObservation(observation({ measurement: measurement({ value }) })), true)
  }
})

test('recovery retains valid quick photos exactly and does not manufacture missing readings', () => {
  const valid = observation({ measurement: measurement() })
  const pending = observation({ id: 'pending-reading', kind: 'measurement' })
  const data = workspace({ observations: [valid, pending, valid,
    observation({ id: 'bad-reading', measurement: measurement({ value: -5 }) }),
    observation({ id: 'orphan', crateId: 'missing' }), observation({ id: 'bad-photo', photo: null })] })
  const recovered = sanitizeWorkspace(data)
  assert.deepEqual(recovered.observations, [valid, pending])
  assert.equal(validateWorkspace(recovered), true)
  assert.equal(recovered.observations[1].measurement, null)
})

test('printed labels pair outside and contents photos without registration or reward credit', () => {
  const photos = [observation({ labelCode: 'C-001', photoRole: 'outside', helperId: null }),
    observation({ id: 'contents', labelCode: 'C-001', photoRole: 'contents' })]
  const data = { ...emptyWorkspace(), observations: photos }
  assert.equal(validateWorkspace(data), true)
  assert.deepEqual(sanitizeWorkspace(data), data)
  assert.equal(data.crates.length, 0)
  assert.equal(rewardSummary(data).points, 0)
  assert.deepEqual(sanitizeWorkspace({ ...emptyWorkspace(), observations: [observation()] }).observations, [observation()])
  for (const labelCode of ['C-001', 'C-032', 'C-100', 'C-999']) {
    assert.equal(validateObservation(observation({ labelCode })), true)
  }
})

test('printed observation metadata validates canonical IDs, roles and existing optional helpers', () => {
  for (const labelCode of ['C-000', 'C-1', 'c-001', ' C-001 ', 'C-1000', '', null, 1, undefined, 'x'.repeat(33)]) {
    assert.equal(validateObservation(observation({ labelCode })), false, String(labelCode))
  }
  for (const photoRole of ['before', 'after', '', null, undefined]) {
    assert.equal(validateObservation(observation({ photoRole })), false)
  }
  for (const helperId of ['', ' griff ', 1, undefined, 'x'.repeat(121)]) {
    assert.equal(validateObservation(observation({ helperId })), false)
  }
  assert.equal(validateWorkspace({ ...emptyWorkspace(), observations: [observation({ helperId: 'griff' })] }), false)
  const rewards = defaultRewards(1000)
  const data = { ...emptyWorkspace(), rewards, observations: [observation({ labelCode: 'C-002', photoRole: 'contents', helperId: 'griff' })] }
  assert.equal(validateWorkspace(data), true)
  assert.deepEqual(sanitizeWorkspace(data), data)
  assert.equal(rewardSummary(data).points, 0)
  assert.deepEqual(rewards.entries, [])
  assert.equal(validateWorkspace({ ...data, observations: [observation({ helperId: 'missing' })] }), false)
  assert.deepEqual(sanitizeWorkspace({ ...data, observations: [observation({ helperId: 'missing' })] }).observations, [])
})

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
