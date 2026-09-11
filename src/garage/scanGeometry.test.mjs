import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await fs.readFile(new URL('./scanGeometry.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { scanShell } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const near = (actual, expected, tolerance = 0.000001) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`)

function contains([x, y]) {
  let inside = false
  const points = scanShell.outline
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

test('interior follows the scanned steps instead of filling the bounding rectangle', () => {
  assert.equal(contains([20, 6]), true, 'rear floor exists beyond the step')
  assert.equal(contains([15.3, 5]), true, 'floor above the rear notch remains')
  assert.equal(contains([15.3, 6]), false, 'rear notch is not usable floor')
  assert.equal(contains([10, 6]), false, 'middle missing area is not usable floor')
  assert.equal(contains([1, 5.6]), false, 'front section has its own shallower width')
  assert.equal(contains([0, 2]), false, 'floor starts at the inside wall face')
})

test('interior area and bounds agree with the rounded Polycam CSV estimates', () => {
  const p = scanShell.outline
  const area = Math.abs(p.reduce((sum, [x, y], i) => {
    const [nx, ny] = p[(i + 1) % p.length]
    return sum + x * ny - nx * y
  }, 0)) / 2
  near(area, 145.4, 0.05)
  const length = Math.max(...p.map(([x]) => x)) - Math.min(...p.map(([x]) => x))
  const width = Math.max(...p.map(([, y]) => y)) - Math.min(...p.map(([, y]) => y))
  near(length, scanShell.interiorBounds.length)
  near(width, scanShell.interiorBounds.width)
  assert.equal(length.toFixed(1), '25.1')
  assert.equal(width.toFixed(1), '7.3')
  assert.equal(scanShell.height, 3.2)
})

test('five scanned doors stay open and wall duplicates are removed', () => {
  const doors = scanShell.openings.filter(o => o.kind === 'door')
  assert.equal(doors.length, 5)
  assert.equal(scanShell.openings.filter(o => o.kind === 'window').length, 1)
  near(Math.abs(doors[0].a[1] - doors[0].b[1]), 5.11332)
  const seen = new Set()
  for (const wall of scanShell.walls) {
    const horizontal = wall.a[1] === wall.b[1]
    assert.ok(horizontal || wall.a[0] === wall.b[0])
    assert.notDeepEqual(wall.a, wall.b)
    const key = [wall.a.join(','), wall.b.join(',')].sort().join('|')
    assert.equal(seen.has(key), false, 'duplicate wall would be drawn twice')
    seen.add(key)
    const axis = horizontal ? 0 : 1, fixed = 1 - axis
    for (const door of doors) {
      if (door.a[fixed] !== wall.a[fixed] || door.b[fixed] !== wall.a[fixed]) continue
      const overlap = Math.min(Math.max(...[wall.a[axis], wall.b[axis]]), Math.max(...[door.a[axis], door.b[axis]]))
        - Math.max(Math.min(...[wall.a[axis], wall.b[axis]]), Math.min(...[door.a[axis], door.b[axis]]))
      assert.ok(overlap <= 0.000001, `${door.id} must not be blocked by a wall`)
    }
  }
  assert.equal(scanShell.walls.length, 18)
})
