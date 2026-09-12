// Run with: node src/play/missionArea.test.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const loadUrl = async (path, replacements = {}) => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  for (const [specifier, replacement] of Object.entries(replacements)) compiled = compiled.replaceAll(`'${specifier}'`, `'${replacement}'`)
  return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
}
const objectsUrl = await loadUrl('../garage/currentObjects.ts')
const { currentObjects } = await import(objectsUrl)
const { missionAreaForObject } = await import(await loadUrl('./missionArea.ts', { '../garage/currentObjects': objectsUrl }))
const object = id => currentObjects.find(value => value.id === id)
const item = (parentId, crateId = null, name = 'Camping box') => ({ parentId, crateId, name })
const crate = (id = 'crate-1', code = 'C-001', location = 'R1 · lower shelf') => ({ id, code, location })

test('a photographed rack suggests one shelf without inventing a crate or dimensions', () => {
  const rack = object('rack-r1')
  assert.deepEqual(missionAreaForObject(rack), { kind: 'shelf', area: `${rack.label} · one shelf`, crateId: null })
  assert.deepEqual(Object.keys(missionAreaForObject(rack)).sort(), ['area', 'crateId', 'kind'])
})

test('an identified registered crate uses its stable ID, code and current location', () => {
  const crates = [crate()]
  assert.deepEqual(missionAreaForObject(object('rack-r1'), item('rack-r1', 'crate-1'), crates), {
    kind: 'crate', area: 'C-001 · R1 · lower shelf', crateId: 'crate-1',
  })
  assert.equal(missionAreaForObject(object('rear-cart'), item('rear-cart', 'crate-1'), crates).kind, 'crate')
  const customCodes = [crate('one', 'Blue tote'), crate('two', 'Blue  tote')]
  assert.equal(missionAreaForObject(object('rack-r1'), item('rack-r1', 'two'), customCodes).area, 'Blue  tote · R1 · lower shelf')
})

test('a registered crate without a written location uses its photographed parent label', () => {
  const parent = object('rack-r2')
  assert.deepEqual(missionAreaForObject(parent, item(parent.id, 'crate-1'), [crate('crate-1', 'Blue tote', '')]), {
    kind: 'crate', area: `Blue tote · ${parent.label}`, crateId: 'crate-1',
  })
})

test('unlinked identified items use the named shelf or nearby floor area without becoming crates', () => {
  const rack = object('rack-r3')
  assert.deepEqual(missionAreaForObject(rack, item(rack.id, null, 'Fishing case')), {
    kind: 'shelf', area: `${rack.label} · Fishing case`, crateId: null,
  })
  const cart = object('rear-cart')
  assert.deepEqual(missionAreaForObject(cart, item(cart.id, null, 'Loose cables')), {
    kind: 'floor', area: `Area by Loose cables · ${cart.label}`, crateId: null,
  })
})

test('storage furniture, loose groups and bins suggest an area by the object', () => {
  for (const id of ['rear-tool-chest', 'folded-tables', 'fabric-wardrobe-reference', 'side-bins-reference', 'rack-floor-cords']) {
    const parent = object(id)
    assert.deepEqual(missionAreaForObject(parent), { kind: 'floor', area: `Area by ${parent.label}`, crateId: null })
  }
})

test('vehicles, bicycle, utilities and collection sack remain view-only even with linked children', () => {
  for (const id of ['suv-latest', 'bicycle-reference', 'water-heater-reference', 'utility-cabinet-reference', 'yellow-sack-morning-reference']) {
    const parent = object(id)
    assert.equal(missionAreaForObject(parent), null, id)
    assert.equal(missionAreaForObject(parent, item(id, 'crate-1'), [crate()]), null, id)
  }
})

test('unknown or mismatched photo parents do not produce mission suggestions', () => {
  assert.equal(missionAreaForObject(null), null)
  assert.equal(missionAreaForObject(undefined), null)
  assert.equal(missionAreaForObject({ id: 'invented-rack', kind: 'rack', label: 'New rack' }), null)
  assert.equal(missionAreaForObject({ ...object('suv-latest'), kind: 'rack' }), null)
  assert.equal(missionAreaForObject(object('rack-r1'), item('rack-r2')), null)
  assert.equal(missionAreaForObject(object('rack-r1'), item('rack-r1', null, '  ')), null)
})

test('stale or ambiguous crate links do not silently choose another cleanup target', () => {
  const rack = object('rack-r1')
  const linked = item(rack.id, 'crate-1')
  for (const crates of [[], [crate('different-id')], [crate(), crate()], [crate(), crate('two', 'c-001')], [crate('crate-1', '')]]) {
    assert.equal(missionAreaForObject(rack, linked, crates), null)
  }
})

test('long area labels stay trimmed, within the mission limit, and keep the crate code', () => {
  const result = missionAreaForObject(object('rack-r1'), item('rack-r1', 'crate-1'), [crate('crate-1', 'Custom crate', ' 🧰'.repeat(90))])
  assert.equal(result.area.length <= 160, true)
  assert.equal(result.area, result.area.trim())
  assert.ok(result.area.startsWith('Custom crate · '))
  assert.ok(result.area.endsWith('…'))
  assert.equal(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(result.area), false)
})

test('selection only derives fields and never changes photo, crate or layout data', () => {
  const parent = Object.freeze({ ...object('rack-r4') })
  const identified = Object.freeze(item(parent.id, 'crate-1'))
  const crates = Object.freeze([Object.freeze(crate())])
  const before = JSON.stringify({ parent, identified, crates })
  missionAreaForObject(parent, identified, crates)
  assert.equal(JSON.stringify({ parent, identified, crates }), before)
  const differentlyDrawn = { ...parent, x: -100, y: 900, w: 500, d: 0, h: NaN }
  assert.deepEqual(missionAreaForObject(differentlyDrawn, identified, crates), missionAreaForObject(parent, identified, crates))
})
