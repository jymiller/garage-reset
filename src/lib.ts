import type { Task, PersonId } from './types'

const activeRank = (status: Task['status']) => (status === 'in-progress' ? 0 : 1)

/** The next actionable tasks: not done, not blocked, in-progress first. */
export function nextTasks(tasks: Task[], n: number, person?: PersonId): Task[] {
  return tasks
    .filter((t) => t.status !== 'done' && t.status !== 'blocked')
    .filter((t) => !person || t.person === person)
    .sort((a, b) => activeRank(a.status) - activeRank(b.status) || a.order - b.order)
    .slice(0, n)
}

export function progress(tasks: Task[], person?: PersonId) {
  const scope = person ? tasks.filter((t) => t.person === person) : tasks
  const total = scope.length
  const done = scope.filter((t) => t.status === 'done').length
  const pct = total ? Math.round((done / total) * 100) : 0
  return { done, total, pct }
}

export function cheer(pct: number): string {
  if (pct >= 100) return 'Done. The garage is reset.'
  if (pct === 0) return "Let's get the first win on the board."
  if (pct < 34) return 'Momentum is building. One thing at a time.'
  if (pct < 67) return 'Look at that progress. Keep rolling.'
  return 'Almost there — the finish line is close.'
}
