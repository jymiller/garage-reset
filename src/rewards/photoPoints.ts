import { validatePhotoAward, validateWorkspace } from '../crates/model'
import type { PhotoAward, Workspace } from '../crates/model'

export const USEFUL_PHOTO_POINTS = 25 as const

function eligibleAwards(workspace: Workspace): PhotoAward[] {
  const players = new Set(workspace.rewards?.players.map(player => player.id) ?? [])
  const photos = new Map((workspace.observations ?? []).map(photo => [photo.id, photo]))
  const credited = new Set<string>()
  return (workspace.photoAwards ?? []).filter(award => {
    const photo = photos.get(award.observationId)
    if (!validatePhotoAward(award) || !photo || !players.has(award.helperId)
      || award.reviewedAt < photo.createdAt || credited.has(award.observationId)) return false
    credited.add(award.observationId)
    return true
  })
}

export function photoPointsForPlayer(workspace: Workspace, helperId: string | null | undefined) {
  const count = helperId ? eligibleAwards(workspace).filter(award => award.helperId === helperId).length : 0
  return { count, points: count * USEFUL_PHOTO_POINTS }
}

export function totalPhotoPoints(workspace: Workspace): number {
  return eligibleAwards(workspace).length * USEFUL_PHOTO_POINTS
}

/** One explicit review credits one photo; mission cash and all source records stay unchanged. */
export function approveUsefulPhoto(workspace: Workspace, observationId: string, helperId: string, reviewedAt = Date.now()): Workspace {
  const observation = workspace.observations?.find(photo => photo.id === observationId)
  if (!observation || !workspace.rewards?.players.some(player => player.id === helperId)
    || (workspace.photoAwards ?? []).some(award => award.observationId === observationId)
    || !Number.isFinite(reviewedAt) || reviewedAt < observation.createdAt || reviewedAt > 8.64e15) return workspace
  const award: PhotoAward = { observationId, helperId, points: USEFUL_PHOTO_POINTS, reviewedAt }
  if (!validatePhotoAward(award)) return workspace
  const next: Workspace = { ...workspace, photoAwards: [...(workspace.photoAwards ?? []), award] }
  return validateWorkspace(next) ? next : workspace
}
