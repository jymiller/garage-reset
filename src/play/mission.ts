import { validateCleanupMission } from '../crates/model'
import type { CleanupMission } from '../crates/model'

type NewMission = Pick<CleanupMission, 'id' | 'title' | 'area' | 'kind' | 'plannedMinutes'>
  & { crateId?: string | null }

function validTime(now: number, mission?: CleanupMission): boolean {
  return Number.isFinite(now) && now >= (mission?.createdAt ?? 0) && now <= 8.64e15
}

export function createMission(input: NewMission, now = Date.now()): CleanupMission {
  const mission: CleanupMission = {
    id: input.id.trim(), title: input.title.trim(), area: input.area.trim(), kind: input.kind,
    crateId: input.crateId?.trim() || null,
    plannedMinutes: input.plannedMinutes,
    phase: 'before', beforePhoto: null, afterPhoto: null,
    elapsedSeconds: 0, runningSince: null, createdAt: now, completedAt: null,
    kept: 0, bagged: 0, donated: 0, ask: 0, summary: '', parkingClear: false,
  }
  if (!validateCleanupMission(mission)) throw new Error('Choose a title, area and a 5, 10 or 15 minute round.')
  return mission
}

/** Wall-clock timestamps survive reloads; reaching the planned time earns nothing. */
export function missionElapsedSeconds(mission: CleanupMission, now = Date.now()): number {
  const extra = mission.phase === 'active' && mission.runningSince !== null && Number.isFinite(now)
    ? Math.max(0, Math.floor((now - mission.runningSince) / 1000)) : 0
  return Math.min(31536000, mission.elapsedSeconds + extra)
}

export function startMission(mission: CleanupMission, now = Date.now()): CleanupMission {
  if (mission.phase !== 'before' || !mission.beforePhoto || !validateCleanupMission(mission) || !validTime(now, mission)) return mission
  return { ...mission, phase: 'active', runningSince: now }
}

export function pauseMission(mission: CleanupMission, now = Date.now()): CleanupMission {
  if (mission.phase !== 'active' || mission.runningSince === null || !validTime(now, mission)) return mission
  return { ...mission, elapsedSeconds: missionElapsedSeconds(mission, now), runningSince: null }
}

export function resumeMission(mission: CleanupMission, now = Date.now()): CleanupMission {
  if (mission.phase !== 'active' || mission.runningSince !== null || !validateCleanupMission(mission) || !validTime(now, mission)) return mission
  return { ...mission, runningSince: now }
}

export function reviewMission(mission: CleanupMission, now = Date.now()): CleanupMission {
  if (mission.phase !== 'active' || !validateCleanupMission(mission) || !validTime(now, mission)) return mission
  return { ...mission, phase: 'review', elapsedSeconds: missionElapsedSeconds(mission, now), runningSince: null }
}

/** Repeated finish clicks return the original completed round, with no new award. */
export function completeMission(mission: CleanupMission, now = Date.now()): CleanupMission {
  if (mission.phase !== 'review' || !validTime(now, mission)) return mission
  const completed: CleanupMission = { ...mission, phase: 'complete', runningSince: null, completedAt: now }
  return validateCleanupMission(completed) ? completed : mission
}

export function missionProgress(missions: CleanupMission[] = []) {
  const unique = new Map<string, CleanupMission>()
  for (const mission of missions) {
    if (mission.phase === 'complete' && validateCleanupMission(mission)) unique.set(mission.id, mission)
  }
  const completed = [...unique.values()]
  const completedCount = completed.length
  const badges: string[] = []
  if (completedCount >= 1) badges.push('First round')
  if (completedCount >= 3) badges.push('Three rounds')
  if (completedCount >= 10) badges.push('Ten rounds')
  if (completed.some(mission => mission.kind === 'floor')) badges.push('Floor reset')
  if (completed.some(mission => mission.kind === 'shelf')) badges.push('Shelf reset')
  if (completed.some(mission => mission.kind === 'crate')) badges.push('Crate sorted')
  return {
    completedCount,
    points: completedCount * 100,
    level: 1 + Math.floor(completedCount / 3),
    roundsToNextLevel: 3 - completedCount % 3,
    badges,
  }
}
