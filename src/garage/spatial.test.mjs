// Run with: node src/garage/spatial.test.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'
import { validWorkspace as serverValidWorkspace } from '../../server/app.mjs'

const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const modelURL = asModule(compile(await readFile(new URL('../crates/model.ts', import.meta.url), 'utf8')))
const objectsURL = asModule(compile(await readFile(new URL('./currentObjects.ts', import.meta.url), 'utf8')))
const spatialSource = compile(await readFile(new URL('./spatial.ts', import.meta.url), 'utf8'))
  .replaceAll("'../crates/model'", JSON.stringify(modelURL)).replaceAll('"../crates/model"', JSON.stringify(modelURL))
  .replaceAll("'./currentObjects'", JSON.stringify(objectsURL)).replaceAll('"./currentObjects"', JSON.stringify(objectsURL))
const { emptyWorkspace, validateWorkspace, sanitizeWorkspace, volumeStats, SPATIAL_PARENT_IDS, SPATIAL_PHOTO_IDS } = await import(modelURL)
const { currentObjects } = await import(objectsURL)
const { validSpatialItem, createSpatialItem, boxVolumeLiters, normalizedRegionFromDrag } = await import(asModule(spatialSource))

const region = { x: 0.1, y: 0.2, w: 0.25, h: 0.3 }
const spatial = (patch = {}) => ({
  ...createSpatialItem({ id: 'spatial-1', name: 'Blue tote', parentId: 'rack-r1', photoId: 'IMG_1931', region }, 1000), ...patch,
})
const crate = { id: 'crate-1', code: 'C-001', name: 'Blue tote', location: '', owner: '', capacityLiters: 60,
  baselineFill: 80, currentFill: 80, status: 'unopened', photo: null, notes: '', createdAt: 0 }
const contents = { id: 'contents-1', crateId: 'crate-1', name: 'Mugs', quantity: 3, decision: 'undecided', destination: '', departed: false, notes: '' }
const mission = { id: 'mission-1', title: 'Sort the shelf', area: 'Left rack', kind: 'shelf', crateId: null,
  phase: 'before', beforePhoto: null, afterPhoto: null, plannedMinutes: 10, elapsedSeconds: 0, runningSince: null,
  createdAt: 1000, completedAt: null, kept: 0, bagged: 0, donated: 0, ask: 0, summary: '', parkingClear: false }
const workspace = patch => ({ ...emptyWorkspace(), crates: [crate], items: [contents], missions: [mission], ...patch })

test('legacy snapshots stay unchanged and absent spatial inventory stays absent', () => {
  const legacy = workspace({})
  assert.equal(validateWorkspace(legacy), true)
  assert.deepEqual(sanitizeWorkspace(legacy), legacy)
  assert.equal(Object.hasOwn(sanitizeWorkspace(legacy), 'spatialItems'), false)
  assert.equal(validateWorkspace(workspace({ spatialItems: [] })), true)
  for (const spatialItems of [undefined, null, {}, 'boxes']) {
    assert.equal(validateWorkspace(workspace({ spatialItems })), false)
  }
})

test('fixed group and photograph allowlists match the current survey sources', async () => {
  const survey = await import(asModule(compile(await readFile(new URL('../pickup/surveyData.ts', import.meta.url), 'utf8'))))
  assert.deepEqual([...SPATIAL_PARENT_IDS].sort(), currentObjects.map(object => object.id).sort())
  assert.deepEqual([...SPATIAL_PHOTO_IDS].sort(), [...survey.photoSurvey, ...survey.latestPhotoSurvey].map(photo => photo.id).sort())
})

test('manual creation defaults to an estimated floor box contained by its selected parent envelope', () => {
  for (const parent of currentObjects) {
    const item = createSpatialItem({ id: `spatial-${parent.id}`, name: 'Manual item', parentId: parent.id, photoId: parent.photoIds[0], region }, 1000)
    assert.equal(validSpatialItem(item), true)
    assert.equal(item.dimensionBasis, 'estimated')
    assert.equal(item.z, 0)
    assert.ok(item.x >= parent.x && item.y >= parent.y)
    assert.ok(item.x + item.w <= parent.x + parent.w + 1e-10)
    assert.ok(item.y + item.d <= parent.y + parent.d + 1e-10)
    assert.ok(item.h <= parent.h)
  }
  const notMeasured = createSpatialItem({ id: 'spatial-default', name: 'Tote', parentId: 'rack-r1', photoId: 'IMG_1931', region, dimensionBasis: 'measured' }, 1000)
  assert.equal(notMeasured.dimensionBasis, 'estimated')
})

test('chosen shelf heights and entered dimensions preserve their explicit basis', () => {
  const item = createSpatialItem({ id: 'spatial-shelf', name: ' Measured box ', parentId: 'rack-r2', photoId: 'IMG_1930', region,
    z: 1.1, dimensions: { w: 0.6, d: 0.4, h: 0.3 }, dimensionBasis: 'measured', notes: ' Tape measurement ' }, 1000)
  assert.equal(item.z, 1.1)
  assert.equal(item.dimensionBasis, 'measured')
  assert.equal(item.name, 'Measured box')
  assert.equal(item.notes, 'Tape measurement')
  assert.throws(() => createSpatialItem({ id: 'bad-parent', name: 'Box', parentId: 'unknown', photoId: 'IMG_1930', region }, 1000))
  assert.throws(() => createSpatialItem({ id: 'bad-shelf', name: 'Box', parentId: 'rack-r1', photoId: 'IMG_1930', region, z: 3.2 }, 1000))
})

test('pixel regions handle reverse drags, image edges and clipped drags without inventing an area', () => {
  const forward = normalizedRegionFromDrag({ x: 20, y: 30 }, { x: 80, y: 90 }, { width: 100, height: 120 })
  assert.deepEqual(forward, { x: 0.2, y: 0.25, w: 0.6000000000000001, h: 0.5 })
  assert.deepEqual(normalizedRegionFromDrag({ x: 80, y: 90 }, { x: 20, y: 30 }, { width: 100, height: 120 }), forward)
  assert.deepEqual(normalizedRegionFromDrag({ x: -20, y: -30 }, { x: 180, y: 190 }, { width: 100, height: 120 }), { x: 0, y: 0, w: 1, h: 1 })
  assert.equal(normalizedRegionFromDrag({ x: 20, y: 30 }, { x: 20, y: 90 }, { width: 100, height: 120 }), null)
  assert.equal(normalizedRegionFromDrag({ x: -20, y: 30 }, { x: -10, y: 90 }, { width: 100, height: 120 }), null)
  assert.equal(normalizedRegionFromDrag({ x: NaN, y: 0 }, { x: 10, y: 10 }, { width: 100, height: 100 }), null)
  assert.equal(normalizedRegionFromDrag({ x: 0, y: 0 }, { x: 10, y: 10 }, { width: 0, height: 100 }), null)
})

test('normalized region validation requires a contained positive area', () => {
  assert.equal(validSpatialItem(spatial({ region: { x: 0, y: 0, w: 1, h: 1 } })), true)
  assert.equal(validSpatialItem(spatial({ region: { x: 0.999, y: 0.999, w: 0.001, h: 0.001 } })), true)
  for (const region of [{ x: -0.1, y: 0, w: 0.2, h: 0.2 }, { x: 0, y: 0, w: 0, h: 0.2 },
    { x: 0.9, y: 0, w: 0.2, h: 0.2 }, { x: 0, y: 0.9, w: 0.2, h: 0.2 },
    { x: NaN, y: 0, w: 0.2, h: 0.2 }, { x: 0, y: 0, w: 0.2, h: Infinity }]) {
    assert.equal(validSpatialItem(spatial({ region })), false)
  }
})

test('3D boxes require positive finite dimensions and fit fully within inclusive garage bounds', () => {
  assert.equal(validSpatialItem(spatial({ x: 25.2, y: 7.37, z: 3.19, w: 0.01, d: 0.01, h: 0.01 })), true)
  for (const patch of [{ x: -0.01 }, { y: -0.01 }, { z: -0.01 }, { w: 0.009 }, { d: 0 }, { h: -1 },
    { x: 25, w: 0.22 }, { y: 7, d: 0.39 }, { z: 3, h: 0.21 }, { x: NaN }, { w: Infinity }, { z: '1' }]) {
    assert.equal(validSpatialItem(spatial(patch)), false)
  }
})

test('spatial records reject invalid names, basis, references and timestamps', () => {
  for (const patch of [{ name: '' }, { name: ' Untrimmed ' }, { name: 'x'.repeat(161) }, { id: 'x'.repeat(121) },
    { parentId: 'invented-rack' }, { photoId: 'IMG_9999' }, { dimensionBasis: 'detected' },
    { notes: 'x'.repeat(4001) }, { createdAt: -1 }, { createdAt: Infinity }]) {
    assert.equal(validSpatialItem(spatial(patch)), false)
  }
})

test('spatial item and region fields match the exact server schema', () => {
  const valid = workspace({ spatialItems: [spatial()] })
  assert.equal(validateWorkspace(valid), true)
  assert.equal(serverValidWorkspace(valid), true)
  const missingName = spatial()
  delete missingName.name
  const missingRegionHeight = { ...region }
  delete missingRegionHeight.h
  for (const item of [spatial({ extra: true }), spatial({ region: { ...region, extra: true } }),
    missingName, spatial({ region: missingRegionHeight })]) {
    const candidate = workspace({ spatialItems: [item] })
    assert.equal(validSpatialItem(item), false)
    assert.equal(validateWorkspace(candidate), false)
    assert.equal(serverValidWorkspace(candidate), false)
  }
})

test('IDs cannot collide with fixed groups or legacy entities, and each crate links once', () => {
  assert.equal(validateWorkspace(workspace({ spatialItems: [spatial({ crateId: crate.id })] })), true)
  for (const id of [crate.id, contents.id, mission.id, 'rack-r1']) {
    assert.equal(validateWorkspace(workspace({ spatialItems: [spatial({ id })] })), false)
  }
  assert.equal(validateWorkspace(workspace({ spatialItems: [spatial(), spatial()] })), false)
  assert.equal(validateWorkspace(workspace({ spatialItems: [spatial({ crateId: 'missing' })] })), false)
  assert.equal(validateWorkspace(workspace({ spatialItems: [spatial({ crateId: crate.id }), spatial({ id: 'spatial-2', crateId: crate.id })] })), false)
  assert.equal(validateWorkspace(workspace({ spatialItems: [spatial(), spatial({ id: 'spatial-2' })] })), true)
})

test('recovery preserves valid geometry exactly and drops corrupt, duplicate or orphan annotations', () => {
  const valid = workspace({ spatialItems: [spatial({ crateId: crate.id, dimensionBasis: 'measured' })] })
  assert.deepEqual(sanitizeWorkspace(valid), valid)
  const damaged = workspace({ spatialItems: [
    spatial({ crateId: crate.id }), spatial(), spatial({ id: 'duplicate-crate-link', crateId: crate.id }),
    spatial({ id: 'orphan', crateId: 'missing' }), spatial({ id: contents.id }),
    spatial({ id: 'bad-size', w: -1 }), spatial({ id: 'missing-basis', dimensionBasis: undefined }),
    spatial({ id: 'unknown-photo', photoId: 'new-photo' }),
  ] })
  const recovered = sanitizeWorkspace(damaged)
  assert.equal(recovered.spatialItems.length, 1)
  assert.deepEqual(recovered.spatialItems[0], damaged.spatialItems[0])
  assert.equal(validateWorkspace(recovered), true)
  recovered.spatialItems[0].region.x = 0.4
  assert.equal(damaged.spatialItems[0].region.x, 0.1)
})

test('outer bounding-box liters stay separate from occupied contents and goal progress', () => {
  assert.equal(boxVolumeLiters({ w: 0.6, d: 0.4, h: 0.3 }), 72)
  assert.equal(boxVolumeLiters({ w: 1, d: 1, h: 1 }), 1000)
  for (const box of [{ w: -1, d: 1, h: 1 }, { w: NaN, d: 1, h: 1 }, { w: Infinity, d: 1, h: 1 }]) {
    assert.equal(boxVolumeLiters(box), 0)
  }
  const baseline = workspace({})
  const linked = { ...baseline, spatialItems: [spatial({ crateId: crate.id, w: 0.6, d: 0.4, h: 0.3 })] }
  assert.deepEqual(volumeStats(linked), volumeStats(baseline))
  assert.equal(volumeStats(linked).baselineLiters, 48)
  assert.equal(volumeStats(linked).freedLiters, 0)
})
