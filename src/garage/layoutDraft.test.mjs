import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

async function moduleUrl(name) {
  const source = await fs.readFile(new URL(name, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
}
const scanUrl = await moduleUrl('./scanGeometry.ts')
const { scanShell } = await import(scanUrl)
const source = await fs.readFile(new URL('./layoutDraft.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace(/(['"])\.\/scanGeometry\1/g, JSON.stringify(scanUrl))
const { validGeometry, footprintOverlaps } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const { currentObjects } = await import(await moduleUrl('./currentObjects.ts'))
const correction = (changes = {}) => ({ x: 20, y: 1, w: 1, d: 1, h: 1, note: '', ...changes })

test('current schematic objects fit the scanned interior', () => {
  assert.ok(currentObjects.length > 0)
  for (const object of currentObjects) assert.equal(validGeometry({ ...object, note: '' }), true, object.id)
})

test('a rectangle cannot straddle a notch even with all four corners inside', () => {
  const box = correction({ x: 13.5, y: 5, w: 4, d: 2 })
  for (const [x, y] of [[13.5, 5], [17.5, 5], [17.5, 7], [13.5, 7]]) {
    assert.equal(validGeometry(correction({ x, y, w: 0.05, d: 0.05 })), true)
  }
  assert.equal(validGeometry(box), false)
  assert.equal(validGeometry(correction({ x: 10, y: 4, w: 1, d: 1 })), false, 'one edge extends into the middle missing area')
})

test('internal wall thickness is excluded while exact face contact is permitted', () => {
  assert.equal(validGeometry(correction({ x: 6.1, y: 3.5, w: 0.5, d: 0.5 })), false)
  assert.equal(validGeometry(correction({ x: 6.2, y: 3.5, w: 0.1, d: 0.5 })), false, 'overlaps the left half without reaching the centerline')
  assert.equal(validGeometry(correction({ x: 6.34, y: 3.5, w: 0.1, d: 0.5 })), false, 'overlaps the right half without crossing the centerline')
  assert.equal(validGeometry(correction({ x: 6, y: 3.5, w: 0.272743, d: 0.5 })), true, 'touches the left wall face at x=6.272743')
  assert.equal(validGeometry(correction({ x: 6.372743, y: 3.5, w: 0.5, d: 0.5 })), true, 'touches the right wall face')
  assert.equal(validGeometry(correction({ x: 6.1, y: 3, w: 0.5, d: 0.211995 })), true, 'touches the end face')
  assert.equal(validGeometry(correction({ x: 0.05, y: 0.05, w: 2, d: 1 })), true)
  assert.equal(validGeometry(correction({ x: 0.04, y: 1 })), false, 'outside the inner wall face')
})

test('corrections require finite dimensions, a bounded note and a height inside the scan', () => {
  for (const key of ['x', 'y', 'w', 'd', 'h']) {
    for (const value of [NaN, Infinity, -Infinity, '1', null]) {
      assert.equal(validGeometry(correction({ [key]: value })), false, `${key}: ${value}`)
    }
  }
  for (const invalid of [null, [], {}, correction({ x: -0.01 }), correction({ y: -0.01 }),
    correction({ w: 0.049 }), correction({ d: 0.049 }), correction({ h: 0.049 }),
    correction({ h: scanShell.height + 0.001 }), correction({ note: 'x'.repeat(1001) }),
    correction({ note: null }), correction({ x: Number.MAX_VALUE, w: Number.MAX_VALUE })]) {
    assert.equal(validGeometry(invalid), false)
  }
  assert.equal(validGeometry(correction({ w: 0.05, d: 0.05, h: 0.05, note: 'x'.repeat(1000) })), true)
  assert.equal(validGeometry(correction({ h: scanShell.height })), true)
})

test('overlap reports other labels, excluding the edited object and touching edges', () => {
  const box = correction({ x: 2, y: 2, w: 2, d: 2 })
  const others = [
    { ...box, id: 'self', label: 'Edited object' },
    { ...box, x: 3, y: 3, id: 'crossing', label: 'Crossing rack' },
    { ...box, x: 2.5, y: 2.5, w: 0.1, d: 0.1, id: 'inside', label: 'Small box inside' },
    { ...box, x: 4, id: 'edge-x', label: 'Touches right edge' },
    { ...box, y: 4, id: 'edge-y', label: 'Touches lower edge' },
    { ...box, x: 4, y: 4, id: 'corner', label: 'Touches corner' },
    { ...box, x: 8, id: 'apart', label: 'Separate object' },
  ]
  assert.deepEqual(footprintOverlaps(box, others, 'self'), ['Crossing rack', 'Small box inside'])
  assert.deepEqual(footprintOverlaps(box, [{ ...box, x: 4 - 1e-9, id: 'tiny', label: 'Positive overlap' }], ''), ['Positive overlap'])
})
