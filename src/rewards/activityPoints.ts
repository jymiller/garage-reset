import { validateWorkspace } from '../crates/model'
import type { ActivityCredit, Crate, Workspace } from '../crates/model'

const POINTS = 25 as const
const codeOf = (code: string) => code.trim().toUpperCase()
const knownHelper = (data: Workspace, helperId: string) => data.rewards?.players.some(player => player.id === helperId)
const validTime = (time: number) => Number.isFinite(time) && time >= 0 && time <= 8.64e15

function append(data: Workspace, credit: ActivityCredit): Workspace {
  if ((data.activityCredits ?? []).some(existing => existing.id === credit.id)) return data
  const next = { ...data, activityCredits: [...(data.activityCredits ?? []), credit] }
  return validateWorkspace(next) ? next : data
}

export function stickerCredit(data: Workspace, code: string, surface: 'front' | 'lid', helperId: string, time = Date.now()): Workspace {
  const labelCode = codeOf(code)
  if (!knownHelper(data, helperId) || !validTime(time) || !/^C-(?!000)\d{3}$/.test(labelCode)
    || !['front', 'lid'].includes(surface) || (data.activityCredits ?? []).some(credit =>
      credit.kind === 'sticker' && credit.labelCode === labelCode && credit.surface === surface)) return data
  return append(data, { id: 'sticker:' + labelCode + ':' + surface, kind: 'sticker', helperId, points: POINTS, createdAt: time, labelCode, surface })
}

/** Call with the actual newly added IDs and the workspace containing those records. */
export function inventoryCredit(data: Workspace, crate: Pick<Crate, 'id' | 'code'>, addedItemIds: readonly string[], helperId: string, time = Date.now(), id = crypto.randomUUID()): Workspace {
  const currentCrate = data.crates.find(item => item.id === crate.id)
  const labelCode = currentCrate?.code.trim() ?? ''
  const itemIds = [...addedItemIds]
  if (!knownHelper(data, helperId) || !validTime(time) || !currentCrate || codeOf(currentCrate.code) !== codeOf(crate.code)
    || !itemIds.length || new Set(itemIds).size !== itemIds.length || !id || id !== id.trim()
    || itemIds.some(itemId => !data.items.some(item => item.id === itemId && item.crateId === currentCrate.id
      && Number.isSafeInteger(item.quantity) && item.quantity > 0))
    || (data.activityCredits ?? []).some(credit => credit.kind === 'inventory' && credit.itemIds?.some(itemId => itemIds.includes(itemId)))) return data
  return append(data, { id, kind: 'inventory', helperId, points: POINTS, createdAt: time, labelCode, itemIds })
}

export function activityPointsForPlayer(data: Workspace, helperId: string | null | undefined) {
  const seen = new Set<string>()
  const credits = (data.activityCredits ?? []).filter(credit => {
    if (!helperId || !knownHelper(data, helperId) || credit.helperId !== helperId || credit.points !== POINTS || seen.has(credit.id)) return false
    seen.add(credit.id); return true
  })
  const stickerCount = credits.filter(credit => credit.kind === 'sticker').length
  const inventoryCount = credits.filter(credit => credit.kind === 'inventory').length
  return { stickerCount, stickerPoints: stickerCount * POINTS, inventoryCount, inventoryPoints: inventoryCount * POINTS, points: (stickerCount + inventoryCount) * POINTS }
}

export function totalActivityPoints(data: Workspace): number {
  return (data.rewards?.players ?? []).reduce((sum, helper) => sum + activityPointsForPlayer(data, helper.id).points, 0)
}
