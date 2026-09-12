import type { CleanupMission, Workspace } from '../crates/model'
import { validateWorkspace } from '../crates/model'
import { assignMission } from '../rewards/model'
import { createMission } from './mission'

export type MissionSetup = {
  id: string
  editing: boolean
  kind: CleanupMission['kind']
  area: string
  crateId: string | null
  plannedMinutes: CleanupMission['plannedMinutes']
  playerId: string | null
  title: string
  defaultArea: string
}

export function openMissionsForPlayer(workspace: Workspace, playerId: string | null): CleanupMission[] {
  const open = (workspace.missions ?? []).filter(mission => mission.phase !== 'complete')
  if (!workspace.rewards) return open
  if (!workspace.rewards.players.some(player => player.id === playerId)) return []
  const assigned = new Set(workspace.rewards.entries.filter(entry => entry.playerId === playerId).map(entry => entry.missionId))
  return open.filter(mission => assigned.has(mission.id))
}

/** Create/edit the mission and its attribution as one candidate shared snapshot. */
export function savePlayerMissionSetup(workspace: Workspace, setup: MissionSetup, now = Date.now()): { data: Workspace; missionId: string | null; error: string | null } {
  const fail = (error: string) => ({ data: workspace, missionId: null, error })
  const missions = workspace.missions ?? []
  const existing = missions.find(mission => mission.id === setup.id)
  if (setup.editing ? !existing || existing.phase !== 'before' : existing) return fail('This mission changed. Open it again before editing.')
  const player = workspace.rewards?.players.find(candidate => candidate.id === setup.playerId)
  const existingEntry = workspace.rewards?.entries.find(entry => entry.missionId === setup.id)
  if (workspace.rewards && !player && (!setup.editing || existingEntry || setup.playerId)) return fail('Choose a registered player before starting this mission.')
  if (openMissionsForPlayer(workspace, player?.id ?? null).some(mission => mission.id !== setup.id)) {
    return fail(player ? `${player.name} already has an unfinished mission. Continue it first.` : 'Continue the unfinished mission before starting another.')
  }
  const crate = setup.kind === 'crate' ? workspace.crates.find(candidate => candidate.id === setup.crateId) : undefined
  if (setup.kind === 'crate' && setup.crateId && !crate) return fail('Choose a crate that is still registered.')
  const area = setup.area.trim() || crate?.location || setup.defaultArea
  const crateId = crate?.id ?? null
  try {
    const mission: CleanupMission = existing ? {
      ...existing, kind: setup.kind, area, crateId, plannedMinutes: setup.plannedMinutes,
      title: existing.kind !== setup.kind || existing.crateId !== crateId ? crate ? `Sort ${crate.code}` : setup.title : existing.title,
      // Keep the photo when only attribution/timing changes; a new area needs new evidence.
      beforePhoto: existing.kind === setup.kind && existing.area === area && existing.crateId === crateId ? existing.beforePhoto : null,
    } : createMission({ id: setup.id, title: crate ? `Sort ${crate.code}` : setup.title, area, kind: setup.kind, crateId, plannedMinutes: setup.plannedMinutes }, now)
    let data: Workspace = { ...workspace, missions: existing ? missions.map(value => value.id === setup.id ? mission : value) : [...missions, mission] }
    if (player) {
      data = assignMission(data, setup.id, player.id)
      if (data.rewards?.entries.find(entry => entry.missionId === setup.id)?.playerId !== player.id) return fail('This player assignment cannot be changed. Review it in Score.')
    }
    if (!validateWorkspace(data)) return fail('Check the mission fields and try again.')
    return { data, missionId: setup.id, error: null }
  } catch {
    return fail('Check the mission fields and try again.')
  }
}
