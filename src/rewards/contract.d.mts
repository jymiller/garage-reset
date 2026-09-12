export type RewardPlayer = { id: string; name: string; createdAt: number }
export type RewardEntry = { missionId: string; playerId: string; approvedAt: number | null; paidAt: number | null }
export type RewardBook = { version: 1; goalCents: 10000; missionsForGoal: 10 | 20; budgetMode: 'per-player' | 'shared'; players: RewardPlayer[]; entries: RewardEntry[] }
export type RewardWorkspace = { missions?: { id: string; phase: string; completedAt: number | null }[]; rewards?: RewardBook }
export type RewardTotals = { completedCount: number; points: number; potentialCents: number; approvedCents: number; paidCents: number; unpaidCents: number }
export type RewardPlayerSummary = RewardPlayer & RewardTotals
export type RewardEntrySummary = RewardEntry & { completed: boolean; points: number; potentialCents: number; allocatedCents: number; status: 'in-progress' | 'pending' | 'approved' | 'paid' | 'over-cap' }
export type RewardSummary = RewardTotals & { players: RewardPlayerSummary[]; entries: RewardEntrySummary[]; settingsLocked: boolean }
export function defaultRewards(now?: number): RewardBook
export function validateRewardBook(book: unknown, missions?: readonly unknown[]): book is RewardBook
export function rewardSummary(workspace: RewardWorkspace): RewardSummary
export function rewardsTransitionError(current: RewardWorkspace, next: RewardWorkspace): string | null
export function assignMission<T extends RewardWorkspace>(workspace: T, missionId: string, playerId: string): T
export function approveMission<T extends RewardWorkspace>(workspace: T, missionId: string, now?: number): T
export function markMissionPaid<T extends RewardWorkspace>(workspace: T, missionId: string, now?: number): T
export function updateRewardSettings<T extends RewardWorkspace>(workspace: T, settings: Pick<RewardBook, 'missionsForGoal' | 'budgetMode'>): T
export function addRewardPlayer<T extends RewardWorkspace>(workspace: T, player: Pick<RewardPlayer, 'id' | 'name'>, now?: number): T
