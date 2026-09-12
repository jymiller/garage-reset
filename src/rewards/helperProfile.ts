import type { Workspace } from '../crates/model'
import { validateWorkspace } from '../crates/model'
import { addRewardPlayer, defaultRewards } from './model'

export const normalizeHelperName = (value: string) => value.trim().replace(/\s+/g, ' ')

/** Joining chooses or adds a name; existing work never acquires attribution. */
export function joinHelper(workspace: Workspace, name: string, id: string, now = Date.now()): { data: Workspace; playerId: string | null } {
  const cleanName = normalizeHelperName(name)
  if (!cleanName || cleanName.length > 80 || !id.trim() || id !== id.trim() || id.length > 120
    || !Number.isFinite(now) || now < 0 || now > 8.64e15) return { data: workspace, playerId: null }
  const initialized = workspace.rewards ? workspace : { ...workspace, rewards: defaultRewards(now) }
  const existing = initialized.rewards!.players.find(player => normalizeHelperName(player.name).toLowerCase() === cleanName.toLowerCase())
  const data = existing ? initialized : addRewardPlayer(initialized, { id, name: cleanName }, now)
  if (!existing && data === initialized || !validateWorkspace(data)) return { data: workspace, playerId: null }
  return { data, playerId: existing?.id ?? id }
}
