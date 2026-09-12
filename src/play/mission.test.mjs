// Run with: node src/play/mission.test.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const compile = source => ts.transpileModule(source.replaceAll("'../rewards/contract.mjs'", JSON.stringify(new URL('../rewards/contract.mjs', import.meta.url).href)), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const modelURL = asModule(compile(await readFile(new URL('../crates/model.ts', import.meta.url), 'utf8')))
const missionSource = compile(await readFile(new URL('./mission.ts', import.meta.url), 'utf8'))
const { emptyWorkspace, validateWorkspace, sanitizeWorkspace, validateCleanupMission, volumeStats } = await import(modelURL)
const { createMission, missionElapsedSeconds, startMission, pauseMission, resumeMission, reviewMission, completeMission, missionProgress } =
  await import(asModule(missionSource.replaceAll("'../crates/model'", JSON.stringify(modelURL)).replaceAll('"../crates/model"', JSON.stringify(modelURL))))

const beforePhoto = '/api/photos/before.jpg'
const afterPhoto = '/api/photos/after.jpg'
const fresh = (patch = {}) => ({ ...createMission({ id: 'round-1', title: 'Clear this shelf', area: 'Left rack', kind: 'shelf', plannedMinutes: 10 }, 1000), ...patch })
const reviewing = (patch = {}) => ({ ...reviewMission(startMission(fresh({ beforePhoto }), 2000), 12000), ...patch })
const completed = (patch = {}) => completeMission(reviewing({ afterPhoto, summary: 'Grouped the tools and cleared the floor.', parkingClear: true, ...patch }), 14000)

test('legacy workspace snapshots remain valid and preserve their absent optional field', () => {
  const legacy = { ...emptyWorkspace(), notes: 'Existing inventory' }
  assert.equal(validateWorkspace(legacy), true)
  assert.deepEqual(sanitizeWorkspace(legacy), legacy)
  assert.equal(Object.hasOwn(sanitizeWorkspace(legacy), 'missions'), false)
  assert.equal(validateWorkspace({ ...legacy, missions: [] }), true)
  assert.deepEqual(sanitizeWorkspace({ ...legacy, missions: [] }).missions, [])
  for (const missions of [null, undefined, {}, 'rounds']) {
    assert.equal(validateWorkspace({ ...legacy, missions }), false)
  }
})

test('a round requires a real before photo to start and never completes on timer expiry', () => {
  const mission = fresh()
  assert.equal(validateCleanupMission(mission), true)
  assert.equal(startMission(mission, 2000), mission)
  const active = startMission({ ...mission, beforePhoto }, 2000)
  assert.equal(active.phase, 'active')
  assert.equal(missionElapsedSeconds(active, 902000), 900)
  assert.equal(missionProgress([active]).points, 0)
  assert.equal(completeMission(active, 902000), active)
})

test('pause, resume and reload count only running time and do not duplicate accumulated seconds', () => {
  const active = startMission(fresh({ beforePhoto }), 2000)
  const reloaded = JSON.parse(JSON.stringify(active))
  assert.equal(missionElapsedSeconds(reloaded, 7000), 5)
  const paused = pauseMission(reloaded, 12000)
  assert.equal(paused.elapsedSeconds, 10)
  assert.equal(paused.runningSince, null)
  assert.equal(missionElapsedSeconds(paused, 99000), 10)
  assert.equal(pauseMission(paused, 99000), paused)
  const resumed = resumeMission(JSON.parse(JSON.stringify(paused)), 102000)
  assert.equal(resumeMission(resumed, 103000), resumed)
  assert.equal(missionElapsedSeconds(resumed, 107000), 15)
  const review = reviewMission(resumed, 112000)
  assert.equal(review.elapsedSeconds, 20)
  assert.equal(review.runningSince, null)
  assert.equal(missionElapsedSeconds(review, 212000), 20)
  assert.equal(missionElapsedSeconds(active, 1000), 0)
})

test('completion needs both photos, a summary and parking confirmation, while zero counts are valid', () => {
  const ready = reviewing({ afterPhoto, summary: 'Repacked only.', parkingClear: true })
  for (const patch of [{ beforePhoto: null }, { afterPhoto: null }, { summary: '' }, { summary: '   ' }, { parkingClear: false }]) {
    const invalid = { ...ready, ...patch }
    assert.equal(completeMission(invalid, 14000), invalid)
  }
  const done = completeMission(ready, 14000)
  assert.equal(done.phase, 'complete')
  assert.equal(done.completedAt, 14000)
  assert.equal(done.kept + done.bagged + done.donated + done.ask, 0)
  assert.equal(validateCleanupMission(done), true)
})

test('finish is idempotent and each unique valid completed round earns exactly 100 points', () => {
  const done = completed()
  assert.equal(completeMission(done, 999000), done)
  assert.equal(missionProgress([done, done, { ...done }]).points, 100)
  assert.equal(missionProgress([done, { ...done, id: 'invalid', afterPhoto: null }]).completedCount, 1)
  const rounds = [done, completed({ id: 'round-2', kind: 'floor' }), completed({ id: 'round-3', kind: 'crate' })]
  const progress = missionProgress(rounds)
  assert.equal(progress.points, 300)
  assert.equal(progress.level, 2)
  assert.equal(progress.roundsToNextLevel, 3)
  assert.deepEqual(progress.badges, ['First round', 'Three rounds', 'Floor reset', 'Shelf reset', 'Crate sorted'])
  assert.equal(missionProgress(rounds.slice(0, 2)).level, 1)
  assert.equal(missionProgress(rounds.slice(0, 2)).roundsToNextLevel, 1)
})

test('mission validation rejects impossible phase, timer and completion combinations', () => {
  const done = completed()
  for (const patch of [
    { phase: 'before', elapsedSeconds: 1, completedAt: null },
    { phase: 'review', runningSince: 2000, completedAt: null },
    { phase: 'active', completedAt: 14000 },
    { phase: 'active', completedAt: null, runningSince: 999 },
    { completedAt: 999 }, { completedAt: null }, { beforePhoto: null }, { afterPhoto: null },
    { beforePhoto: 'https://example.com/before.jpg' }, { plannedMinutes: 20 }, { elapsedSeconds: -1 },
    { elapsedSeconds: 1.5 }, { elapsedSeconds: 31536001 }, { elapsedSeconds: Infinity },
    { kept: -1 }, { bagged: 1.5 }, { donated: 100001 }, { ask: NaN }, { parkingClear: 'true' },
  ]) {
    assert.equal(validateCleanupMission({ ...done, ...patch }), false, JSON.stringify(patch))
  }
  assert.throws(() => createMission({ id: '', title: '', area: '', kind: 'floor', plannedMinutes: 10 }, 1000))
})

test('workspace missions require unique IDs and references to registered crates', () => {
  assert.equal(validateWorkspace({ ...emptyWorkspace(), missions: [fresh()] }), true)
  assert.equal(validateWorkspace({ ...emptyWorkspace(), missions: [fresh(), fresh()] }), false)
  assert.equal(validateWorkspace({ ...emptyWorkspace(), missions: [fresh({ crateId: 'missing' })] }), false)
  const crate = { id: 'crate-1', code: 'C-001', name: 'Tools', location: '', owner: '', capacityLiters: 60,
    baselineFill: 100, currentFill: 100, status: 'unopened', photo: null, notes: '', createdAt: 0 }
  assert.equal(validateWorkspace({ ...emptyWorkspace(), crates: [crate], missions: [fresh({ crateId: crate.id, kind: 'crate' })] }), true)
})

test('recovery preserves valid missions but returns corrupt completion records to review without awards', () => {
  const valid = { ...emptyWorkspace(), missions: [completed()] }
  assert.deepEqual(sanitizeWorkspace(valid), valid)
  for (const patch of [{ summary: '' }, { parkingClear: false }, { completedAt: null }, { kept: -1 }, { title: ' Untrimmed ' }]) {
    const recovered = sanitizeWorkspace({ ...emptyWorkspace(), missions: [{ ...completed(), ...patch }] })
    assert.equal(recovered.missions.length, 1)
    assert.equal(recovered.missions[0].phase, 'review')
    assert.equal(recovered.missions[0].completedAt, null)
    assert.equal(missionProgress(recovered.missions).points, 0)
    assert.equal(validateWorkspace(recovered), true)
  }
  const noPhoto = sanitizeWorkspace({ ...emptyWorkspace(), missions: [{ ...completed(), beforePhoto: null }] })
  assert.equal(noPhoto.missions[0].phase, 'before')
  assert.equal(noPhoto.missions[0].elapsedSeconds, 0)
  const invalidLinks = sanitizeWorkspace({ ...emptyWorkspace(), missions: [fresh(), fresh(), fresh({ id: 'orphan', crateId: 'missing' })] })
  assert.equal(invalidLinks.missions.length, 1)
})

test('session points and item tallies never become fabricated measured volume', () => {
  const legacy = emptyWorkspace()
  const withMission = { ...legacy, missions: [completed({ kept: 10, bagged: 15, donated: 20, ask: 2 })] }
  assert.equal(missionProgress(withMission.missions).points, 100)
  assert.deepEqual(volumeStats(withMission), volumeStats(legacy))
  assert.equal(volumeStats(withMission).freedLiters, 0)
})
