// Run with: node src/pickup/placement.test.mjs
// Compile in memory so the app needs no test framework or generated source files.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('./placement.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const { BAGS, DEFAULT_SITE, DEFAULT_PLACEMENT, footprint, evaluatePlacement, suggestPlacement, sanitizeSettings } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('default suggestion fits, stays in reach, and leaves the central walking lane clear', () => {
  assert.deepEqual(evaluatePlacement(DEFAULT_SITE, DEFAULT_PLACEMENT, 'large'), {
    inside: true,
    roadDistance: 9.25,
    withinReach: true,
    roadWideEnough: true,
    walkwayClear: true,
    sidewalkClear: true,
  })
})

test('whole bag must fit, while contact with apron edges is allowed', () => {
  const bag = footprint('large', false)
  const edges = { x: DEFAULT_SITE.width - bag.width, y: DEFAULT_SITE.depth - bag.depth, rotated: false }
  assert.equal(evaluatePlacement(DEFAULT_SITE, edges, 'large').inside, true)
  assert.equal(evaluatePlacement(DEFAULT_SITE, { ...edges, x: edges.x + 0.01 }, 'large').inside, false)
  assert.equal(evaluatePlacement(DEFAULT_SITE, { ...edges, y: edges.y + 0.01 }, 'large').inside, false)
  assert.equal(evaluatePlacement(DEFAULT_SITE, { ...edges, x: -0.01 }, 'large').inside, false)
  assert.equal(evaluatePlacement(DEFAULT_SITE, { ...edges, y: -0.01 }, 'large').inside, false)
})

test('central walking lane uses rectangle overlap and allows edge contact', () => {
  const bag = footprint('large', false)
  const touching = { x: DEFAULT_SITE.width / 2 - 2 - bag.width, y: 3, rotated: false }
  assert.equal(evaluatePlacement(DEFAULT_SITE, touching, 'large').walkwayClear, true)
  assert.equal(evaluatePlacement(DEFAULT_SITE, { ...touching, x: touching.x + 0.01 }, 'large').walkwayClear, false)
  assert.equal(evaluatePlacement(DEFAULT_SITE, { x: 11, y: 3, rotated: false }, 'large').walkwayClear, false)
  assert.equal(evaluatePlacement(DEFAULT_SITE, { x: 11, y: DEFAULT_SITE.depth, rotated: false }, 'large').walkwayClear, true)
})

test('rotation swaps extents and changes reach and fit', () => {
  assert.deepEqual(footprint('large', true), { width: BAGS.large.depth, depth: BAGS.large.width })
  assert.deepEqual(footprint('medium', false), footprint('medium', true))
  const narrowSite = { width: 5, depth: 10, roadWidth: 14, sidewalkDepth: 0 }
  assert.equal(evaluatePlacement(narrowSite, { x: 1, y: 1, rotated: false }, 'large').inside, false)
  assert.equal(evaluatePlacement(narrowSite, { x: 1, y: 1, rotated: true }, 'large').inside, true)
  assert.equal(evaluatePlacement(DEFAULT_SITE, { ...DEFAULT_PLACEMENT, rotated: true }, 'large').roadDistance, 6 + 79 / 12)
})

test('reach measures the farthest corner and strictly excludes exactly 20 feet', () => {
  const site = { ...DEFAULT_SITE, depth: 40 }
  const atLimit = { x: 1, y: 20 - BAGS.large.depth, rotated: false }
  assert.equal(evaluatePlacement(site, atLimit, 'large').roadDistance, 20)
  assert.equal(evaluatePlacement(site, atLimit, 'large').withinReach, false)
  assert.equal(evaluatePlacement(site, { ...atLimit, y: atLimit.y - 0.01 }, 'large').withinReach, true)
  assert.equal(evaluatePlacement(site, { ...atLimit, y: -21 }, 'large').roadDistance, 21)
  assert.equal(evaluatePlacement(site, { ...atLimit, y: -21 }, 'large').withinReach, false)
})

test('14-foot road threshold is inclusive', () => {
  assert.equal(evaluatePlacement({ ...DEFAULT_SITE, roadWidth: 14 }, DEFAULT_PLACEMENT, 'large').roadWideEnough, true)
  assert.equal(evaluatePlacement({ ...DEFAULT_SITE, roadWidth: 13.99 }, DEFAULT_PLACEMENT, 'large').roadWideEnough, false)
})

test('left and right suggestions retain setback and never certify undersized aprons', () => {
  assert.deepEqual(suggestPlacement(DEFAULT_SITE, 'large', 'left'), { x: 1, y: 6, rotated: false })
  assert.deepEqual(suggestPlacement(DEFAULT_SITE, 'large', 'right'), {
    x: 16.25, y: 6, rotated: false,
  })
  const smallSite = { width: 4, depth: 4, roadWidth: 14, sidewalkDepth: 5 }
  for (const side of ['left', 'right']) {
    const suggestion = suggestPlacement(smallSite, 'large', side)
    assert.ok(suggestion.x >= 0 && suggestion.y >= 0)
    assert.equal(evaluatePlacement(smallSite, suggestion, 'large').inside, false)
  }
})

test('right suggestions use three-inch increments and retain at least a foot at the side', () => {
  for (const size of ['large', 'medium']) {
    for (const width of [12, 20.3, 24, 79.9]) {
      const site = { ...DEFAULT_SITE, width }
      const suggestion = suggestPlacement(site, size, 'right')
      assert.equal(suggestion.x * 4, Math.trunc(suggestion.x * 4))
      assert.ok(width - suggestion.x - BAGS[size].width >= 1)
      assert.ok(width - suggestion.x - BAGS[size].width < 1.25)
    }
  }
  for (const width of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
    const suggestion = suggestPlacement({ ...DEFAULT_SITE, width }, 'large', 'right')
    assert.ok(Number.isFinite(suggestion.x))
  }
})

test('sidewalk blocks the whole road-edge strip; touching its rear boundary is allowed', () => {
  const onSidewalk = evaluatePlacement(DEFAULT_SITE, { x: 1, y: 1, rotated: false }, 'large')
  assert.equal(onSidewalk.inside, true)
  assert.equal(onSidewalk.sidewalkClear, false)
  const touching = { x: 1, y: DEFAULT_SITE.sidewalkDepth, rotated: false }
  assert.equal(evaluatePlacement(DEFAULT_SITE, touching, 'large').sidewalkClear, true)
  assert.equal(evaluatePlacement(DEFAULT_SITE, { ...touching, y: touching.y - 0.01 }, 'large').sidewalkClear, false)
  const noSidewalk = { ...DEFAULT_SITE, sidewalkDepth: 0 }
  assert.equal(evaluatePlacement(noSidewalk, { x: 1, y: 0, rotated: false }, 'large').sidewalkClear, true)
  assert.equal(suggestPlacement({ ...DEFAULT_SITE, sidewalkDepth: 7 }, 'large', 'right').y, 8)
})

test('sidewalk plus bag depth must fit before the roof; suggestions cannot manufacture room', () => {
  const shallowSite = { ...DEFAULT_SITE, depth: 7, sidewalkDepth: 5 }
  for (const size of ['large', 'medium']) {
    for (const side of ['left', 'right']) {
      const result = evaluatePlacement(shallowSite, suggestPlacement(shallowSite, size, side), size)
      assert.equal(result.sidewalkClear, true)
      assert.equal(result.inside, false)
    }
  }
  const noApron = { ...DEFAULT_SITE, sidewalkDepth: DEFAULT_SITE.depth }
  assert.equal(evaluatePlacement(noApron, suggestPlacement(noApron, 'large', 'right'), 'large').inside, false)
})

test('settings sanitize null, arrays, primitive data, and malformed nested fields', () => {
  const defaults = sanitizeSettings(undefined)
  for (const raw of [null, [], true, 123, 'corrupt', { site: [], placement: null, checks: 'yes' }]) {
    assert.deepEqual(sanitizeSettings(raw), defaults)
  }
  assert.deepEqual(sanitizeSettings({
    site: { width: '24', depth: Infinity, roadWidth: 61, sidewalkDepth: -1 },
    placement: { x: NaN, y: -21, rotated: 'false' },
    size: 'extra-large',
    checks: { measured: 'false', openSky: 1, privateGround: [], truckAccess: {}, handles: null },
    fill: 101,
  }), defaults)
})

test('valid fields survive independently; boolean confirmations require literal true', () => {
  const raw = {
    site: { width: 4, depth: 80, roadWidth: 60, sidewalkDepth: 20 },
    placement: { x: -20, y: 100, rotated: true },
    size: 'medium',
    checks: { measured: true, openSky: false, privateGround: true, truckAccess: false, handles: true },
    fill: 100,
  }
  assert.deepEqual(sanitizeSettings(raw), raw)
  assert.deepEqual(sanitizeSettings({ ...raw, site: { ...raw.site, depth: 81 }, fill: -1 }), {
    ...raw, site: { ...raw.site, depth: DEFAULT_SITE.depth }, fill: 0,
    checks: { measured: false, openSky: false, privateGround: false, truckAccess: false, handles: false },
  })
  const settings = sanitizeSettings(undefined)
  settings.site.width = 50
  settings.placement.x = 99
  assert.equal(sanitizeSettings(undefined).site.width, 24)
  assert.equal(sanitizeSettings(undefined).placement.x, DEFAULT_PLACEMENT.x)
})

test('missing or corrupt site fields clear every saved confirmation', () => {
  const confirmed = {
    site: { ...DEFAULT_SITE }, placement: { ...DEFAULT_PLACEMENT }, size: 'large', fill: 20,
    checks: { measured: true, openSky: true, privateGround: true, truckAccess: true, handles: true },
  }
  const unconfirmed = { measured: false, openSky: false, privateGround: false, truckAccess: false, handles: false }
  assert.deepEqual(sanitizeSettings(confirmed), confirmed)
  for (const field of ['width', 'depth', 'roadWidth', 'sidewalkDepth']) {
    const missing = { ...confirmed.site }
    delete missing[field]
    assert.deepEqual(sanitizeSettings({ ...confirmed, site: missing }).checks, unconfirmed)
    for (const invalid of [null, '5', false, NaN, Infinity, -1, 1000]) {
      assert.deepEqual(sanitizeSettings({ ...confirmed, site: { ...confirmed.site, [field]: invalid } }).checks, unconfirmed)
    }
  }
  for (const site of [undefined, null, [], 'legacy']) {
    assert.deepEqual(sanitizeSettings({ ...confirmed, site }).checks, unconfirmed)
  }
})

test('missing or corrupt placement and bag size clear spatial checks while retaining valid measurement', () => {
  const confirmed = {
    site: { ...DEFAULT_SITE }, placement: { ...DEFAULT_PLACEMENT }, size: 'large', fill: 20,
    checks: { measured: true, openSky: true, privateGround: true, truckAccess: true, handles: true },
  }
  const measuredOnly = { measured: true, openSky: false, privateGround: false, truckAccess: false, handles: false }
  for (const field of ['x', 'y', 'rotated']) {
    const missing = { ...confirmed.placement }
    delete missing[field]
    assert.deepEqual(sanitizeSettings({ ...confirmed, placement: missing }).checks, measuredOnly)
    assert.deepEqual(sanitizeSettings({ ...confirmed, placement: { ...confirmed.placement, [field]: 'false' } }).checks, measuredOnly)
  }
  for (const field of ['x', 'y']) {
    for (const invalid of [-21, 101, NaN, Infinity]) {
      assert.deepEqual(sanitizeSettings({ ...confirmed, placement: { ...confirmed.placement, [field]: invalid } }).checks, measuredOnly)
    }
  }
  for (const size of [undefined, null, '', 'extra-large', true, 0]) {
    assert.deepEqual(sanitizeSettings({ ...confirmed, size }).checks, measuredOnly)
  }
  for (const placement of [undefined, null, [], 'legacy']) {
    assert.deepEqual(sanitizeSettings({ ...confirmed, placement }).checks, measuredOnly)
  }
  assert.deepEqual(sanitizeSettings({ ...confirmed, fill: 'bad' }).checks, confirmed.checks)
})

test('sidewalk settings accept zero and twenty, and default corrupt or missing values', () => {
  for (const sidewalkDepth of [0, 20]) {
    assert.equal(sanitizeSettings({ site: { sidewalkDepth } }).site.sidewalkDepth, sidewalkDepth)
  }
  for (const sidewalkDepth of [undefined, null, '5', true, NaN, Infinity, -0.01, 20.01]) {
    assert.equal(sanitizeSettings({ site: { sidewalkDepth } }).site.sidewalkDepth, 5)
  }
  // Legacy stored coordinates remain visible and are flagged against the new sidewalk.
  const legacy = sanitizeSettings({ site: { width: 24, depth: 16, roadWidth: 14 }, placement: { x: 1, y: 3 } })
  assert.equal(legacy.placement.y, 3)
  assert.equal(evaluatePlacement(legacy.site, legacy.placement, legacy.size).sidewalkClear, false)
})

test('nonfinite geometry fails closed', () => {
  const result = evaluatePlacement(DEFAULT_SITE, { ...DEFAULT_PLACEMENT, y: NaN }, 'large')
  assert.equal(result.inside, false)
  assert.equal(result.withinReach, false)
  assert.equal(result.walkwayClear, false)
  assert.equal(result.sidewalkClear, false)
  assert.equal(result.roadDistance, Infinity)
})
