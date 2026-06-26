import type { Task, Item, PersonId } from './types'
import { people, zones } from './data'

export const XP_PER_TASK = 50
const PER_LEVEL = 150 // 3 tasks per level-up

const doneCount = (tasks: Task[], person?: PersonId) =>
  tasks.filter((t) => t.status === 'done' && (!person || t.person === person)).length

export const xp = (tasks: Task[], person?: PersonId) => doneCount(tasks, person) * XP_PER_TASK

export function level(totalXp: number) {
  const lvl = Math.floor(totalXp / PER_LEVEL) + 1
  const into = totalXp % PER_LEVEL
  return { lvl, into, per: PER_LEVEL, pct: Math.round((into / PER_LEVEL) * 100) }
}

export function leaderboard(tasks: Task[]) {
  return people
    .map((p) => ({
      id: p.id,
      name: p.name,
      points: xp(tasks, p.id),
      done: doneCount(tasks, p.id),
      total: tasks.filter((t) => t.person === p.id).length,
    }))
    .sort((a, b) => b.points - a.points)
}

export interface Achievement {
  id: string
  name: string
  desc: string
  unlocked: boolean
}

export function achievements(tasks: Task[], items: Item[], streak: number): Achievement[] {
  const total = tasks.length
  const done = doneCount(tasks)
  const pct = total ? done / total : 0
  const zoneCleared = zones.some((z) => {
    const zt = tasks.filter((t) => t.zone === z.id)
    return zt.length > 0 && zt.every((t) => t.status === 'done')
  })
  return [
    { id: 'first', name: 'First Blood', desc: 'Finish your first task', unlocked: done >= 1 },
    { id: 'streak', name: 'On Fire', desc: 'Hit a 3-day streak', unlocked: streak >= 3 },
    { id: 'quarter', name: 'Warming Up', desc: 'Clear 25%', unlocked: pct >= 0.25 },
    { id: 'half', name: 'Halfway Hero', desc: 'Clear 50%', unlocked: pct >= 0.5 },
    { id: 'zone', name: 'Zone Wipe', desc: 'Finish a whole zone', unlocked: zoneCleared },
    { id: 'quarterm', name: 'Quartermaster', desc: 'Capture 5 items', unlocked: items.length >= 5 },
    { id: 'boss', name: 'Boss Defeated', desc: 'Clear 100%', unlocked: total > 0 && pct >= 1 },
  ]
}
