const GOAL_CENTS = 10000
const MAX_TIME = 8.64e15
const PHOTO = /^\/api\/photos\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.(jpg|png|webp)$/
const own = (value, key) => Object.hasOwn(value, key)
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => own(value, key))
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && value === value.trim()
const time = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_TIME
const compareId = (a, b) => a < b ? -1 : a > b ? 1 : 0
const sameMission = (a, b) => object(a) && object(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => own(b, key) && a[key] === b[key])
const completed = mission => object(mission) && mission.phase === 'complete' && time(mission.createdAt)
  && time(mission.completedAt) && mission.completedAt >= mission.createdAt
  && typeof mission.beforePhoto === 'string' && PHOTO.test(mission.beforePhoto)
  && typeof mission.afterPhoto === 'string' && PHOTO.test(mission.afterPhoto)
  && typeof mission.summary === 'string' && mission.summary.trim().length > 0 && mission.parkingClear === true

export function defaultRewards(now = Date.now()) {
  if (!time(now)) throw new Error('Invalid reward plan timestamp.')
  return { version: 1, goalCents: GOAL_CENTS, missionsForGoal: 10, budgetMode: 'per-player', players: [{ id: 'griff', name: 'Griff', createdAt: now }], entries: [] }
}

function allocate(book, missions) {
  const missionMap = new Map(missions.map(mission => [mission.id, mission]))
  const available = new Map()
  const rate = GOAL_CENTS / book.missionsForGoal
  const take = entry => {
    const key = book.budgetMode === 'shared' ? 'shared' : entry.playerId
    const remaining = available.has(key) ? available.get(key) : GOAL_CENTS
    const amount = Math.min(rate, remaining)
    available.set(key, remaining - amount)
    return amount
  }
  const approved = new Map()
  const pending = new Map()
  const entries = book.entries.filter(entry => completed(missionMap.get(entry.missionId)))
  for (const entry of entries.filter(entry => entry.approvedAt !== null).sort((a, b) => a.approvedAt - b.approvedAt || compareId(a.missionId, b.missionId))) approved.set(entry.missionId, take(entry))
  for (const entry of entries.filter(entry => entry.approvedAt === null).sort((a, b) => missionMap.get(a.missionId).completedAt - missionMap.get(b.missionId).completedAt || compareId(a.missionId, b.missionId))) pending.set(entry.missionId, take(entry))
  return { approved, pending, missionMap }
}

/** One shared contract for browser checks and both server storage adapters. */
export function validateRewardBook(book, missions = []) {
  if (!exact(book, ['version', 'goalCents', 'missionsForGoal', 'budgetMode', 'players', 'entries'])
    || book.version !== 1 || book.goalCents !== GOAL_CENTS || !Number.isSafeInteger(book.goalCents)
    || ![10, 20].includes(book.missionsForGoal) || !['per-player', 'shared'].includes(book.budgetMode)
    || !Array.isArray(book.players) || book.players.length === 0 || !Array.isArray(book.entries) || !Array.isArray(missions)) return false
  const players = new Map(), names = new Set(), missionMap = new Map(), entryIds = new Set()
  for (const player of book.players) {
    if (!exact(player, ['id', 'name', 'createdAt']) || !text(player.id, 120) || !text(player.name, 80)
      || !time(player.createdAt) || players.has(player.id) || names.has(player.name.toLowerCase())) return false
    players.set(player.id, player); names.add(player.name.toLowerCase())
  }
  for (const mission of missions) {
    if (!object(mission) || !text(mission.id, 120) || missionMap.has(mission.id)) return false
    missionMap.set(mission.id, mission)
  }
  for (const entry of book.entries) {
    if (!exact(entry, ['missionId', 'playerId', 'approvedAt', 'paidAt']) || !text(entry.missionId, 120)
      || !text(entry.playerId, 120) || entryIds.has(entry.missionId) || !players.has(entry.playerId) || !missionMap.has(entry.missionId)
      || !(entry.approvedAt === null || time(entry.approvedAt)) || !(entry.paidAt === null || time(entry.paidAt))) return false
    const mission = missionMap.get(entry.missionId)
    if (entry.approvedAt !== null && (!completed(mission) || entry.approvedAt < mission.completedAt || entry.approvedAt < players.get(entry.playerId).createdAt)) return false
    if (entry.paidAt !== null && (entry.approvedAt === null || entry.paidAt < entry.approvedAt)) return false
    entryIds.add(entry.missionId)
  }
  const { approved } = allocate(book, missions)
  return book.entries.every(entry => entry.paidAt === null || (approved.get(entry.missionId) ?? 0) > 0)
}

const emptyTotals = () => ({ completedCount: 0, points: 0, potentialCents: 0, approvedCents: 0, paidCents: 0, unpaidCents: 0 })

export function rewardSummary(workspace) {
  const book = workspace.rewards
  const missions = workspace.missions ?? []
  const totals = emptyTotals()
  if (!book || !validateRewardBook(book, missions)) return { ...totals, players: [], entries: [], settingsLocked: false }
  const { approved, pending, missionMap } = allocate(book, missions)
  const players = book.players.map(player => ({ ...player, ...emptyTotals() }))
  const byPlayer = new Map(players.map(player => [player.id, player]))
  const entries = book.entries.map(entry => {
    const done = completed(missionMap.get(entry.missionId))
    const allocatedCents = approved.get(entry.missionId) ?? 0
    const potentialCents = pending.get(entry.missionId) ?? 0
    const value = { ...entry, completed: done, points: done ? 100 : 0, potentialCents, allocatedCents,
      status: !done ? 'in-progress' : entry.paidAt !== null ? 'paid' : entry.approvedAt !== null
        ? allocatedCents > 0 ? 'approved' : 'over-cap' : potentialCents > 0 ? 'pending' : 'over-cap' }
    for (const target of [totals, byPlayer.get(entry.playerId)]) {
      target.completedCount += done ? 1 : 0
      target.points += value.points
      target.potentialCents += potentialCents
      target.approvedCents += allocatedCents
      target.paidCents += entry.paidAt !== null ? allocatedCents : 0
      target.unpaidCents += entry.paidAt === null ? allocatedCents : 0
    }
    return value
  })
  return { ...totals, players, entries, settingsLocked: book.entries.some(entry => entry.approvedAt !== null) }
}

/** CAS protects concurrency; these checks protect accepted ledger history. */
export function rewardsTransitionError(current, next) {
  if (current.rewards === undefined) return null
  if (next.rewards === undefined) return 'This save would remove the shared rewards ledger. Reload the latest app before saving.'
  const oldBook = current.rewards, newBook = next.rewards
  if (!validateRewardBook(oldBook, current.missions ?? []) || !validateRewardBook(newBook, next.missions ?? [])) return 'The rewards ledger is invalid.'
  const oldSummary = rewardSummary(current), newSummary = rewardSummary(next)
  if (oldSummary.settingsLocked && (oldBook.missionsForGoal !== newBook.missionsForGoal || oldBook.budgetMode !== newBook.budgetMode || oldBook.goalCents !== newBook.goalCents)) return 'Reward settings are locked after the first approval.'
  const nextEntries = new Map(newBook.entries.map(entry => [entry.missionId, entry]))
  const nextAmounts = new Map(newSummary.entries.map(entry => [entry.missionId, entry.allocatedCents]))
  const oldMissions = new Map((current.missions ?? []).map(mission => [mission.id, mission]))
  const newMissions = new Map((next.missions ?? []).map(mission => [mission.id, mission]))
  for (const entry of oldBook.entries) {
    if (entry.approvedAt === null) continue
    const replacement = nextEntries.get(entry.missionId)
    if (!replacement || replacement.playerId !== entry.playerId || replacement.approvedAt !== entry.approvedAt
      || entry.paidAt !== null && replacement.paidAt !== entry.paidAt) return 'Approved rewards and payment records cannot be removed or reassigned.'
    const oldAmount = oldSummary.entries.find(value => value.missionId === entry.missionId).allocatedCents
    if (nextAmounts.get(entry.missionId) !== oldAmount) return 'This change would reallocate an already approved reward.'
    if (!sameMission(oldMissions.get(entry.missionId), newMissions.get(entry.missionId))) return 'An approved mission must retain its reviewed evidence.'
  }
  return null
}

function accept(workspace, book) {
  const next = { ...workspace, rewards: book }
  return validateRewardBook(book, next.missions ?? []) && rewardsTransitionError(workspace, next) === null ? next : workspace
}

export function assignMission(workspace, missionId, playerId) {
  const book = workspace.rewards
  if (!book || !validateRewardBook(book, workspace.missions ?? []) || !(workspace.missions ?? []).some(mission => mission.id === missionId) || !book.players.some(player => player.id === playerId)) return workspace
  const existing = book.entries.find(entry => entry.missionId === missionId)
  if (existing?.playerId === playerId || existing?.approvedAt != null) return workspace
  const entry = { missionId, playerId, approvedAt: null, paidAt: null }
  return accept(workspace, { ...book, entries: existing ? book.entries.map(value => value.missionId === missionId ? entry : value) : [...book.entries, entry] })
}

export function approveMission(workspace, missionId, now = Date.now()) {
  const book = workspace.rewards
  const entry = book?.entries.find(value => value.missionId === missionId)
  if (!book || !entry || entry.approvedAt !== null || !time(now)) return workspace
  return accept(workspace, { ...book, entries: book.entries.map(value => value.missionId === missionId ? { ...value, approvedAt: now } : value) })
}

export function markMissionPaid(workspace, missionId, now = Date.now()) {
  const book = workspace.rewards
  const entry = book?.entries.find(value => value.missionId === missionId)
  if (!book || !entry || entry.approvedAt === null || entry.paidAt !== null || !time(now)) return workspace
  return accept(workspace, { ...book, entries: book.entries.map(value => value.missionId === missionId ? { ...value, paidAt: now } : value) })
}

export function updateRewardSettings(workspace, settings) {
  const book = workspace.rewards
  if (!book || !object(settings) || !exact(settings, ['missionsForGoal', 'budgetMode'])
    || settings.missionsForGoal === book.missionsForGoal && settings.budgetMode === book.budgetMode) return workspace
  return accept(workspace, { ...book, ...settings })
}

export function addRewardPlayer(workspace, player, now = Date.now()) {
  const book = workspace.rewards
  if (!book || !exact(player, ['id', 'name']) || !text(player.id, 120) || !text(player.name, 80) || !time(now)) return workspace
  return accept(workspace, { ...book, players: [...book.players, { ...player, createdAt: now }] })
}
