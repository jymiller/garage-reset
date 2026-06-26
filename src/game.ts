import type { Task, Item, PersonId } from './types'
import { people, zones } from './data'

export const XP_PER_TASK = 50
const PER_LEVEL = 150 // 3 tasks per level-up

const doneTasks = (tasks: Task[], person?: PersonId) =>
  tasks.filter((t) => t.status === 'done' && (!person || t.person === person))

const doneCount = (tasks: Task[], person?: PersonId) => doneTasks(tasks, person).length

/** A task's XP = effort weight (1-3) × 50. */
export const taskXp = (t: Task) => (t.weight ?? 1) * XP_PER_TASK

export const xp = (tasks: Task[], person?: PersonId) =>
  doneTasks(tasks, person).reduce((sum, t) => sum + taskXp(t), 0)

export const allCleared = (tasks: Task[]) => tasks.length > 0 && tasks.every((t) => t.status === 'done')

export const WEEKLY_GOAL = 5

export const COMBO_WINDOW = 180000 // 3 min — back-to-back completions keep the combo
export const COMBO_MAX = 3
export const COMBO_BONUS = 25 // bonus XP per combo step above x1

/** Streak → growing campfire tier. */
export function flameTier(streak: number) {
  if (streak >= 10) return { name: 'INFERNO', color: '#ff5a5a' }
  if (streak >= 6) return { name: 'BONFIRE', color: '#ff8c1a' }
  if (streak >= 3) return { name: 'FLAME', color: '#ffd23f' }
  if (streak >= 1) return { name: 'SPARK', color: '#ffd23f' }
  return { name: 'NO STREAK', color: '#8a8aa6' }
}

/** Year + week number, resets weekly. */
export const weekKey = (date = new Date()) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

export function level(totalXp: number) {
  const lvl = Math.floor(totalXp / PER_LEVEL) + 1
  const into = totalXp % PER_LEVEL
  return { lvl, into, per: PER_LEVEL, pct: Math.round((into / PER_LEVEL) * 100) }
}

const RANKS = ['ROOKIE', 'GREASE MONKEY', 'SHELF JOCKEY', 'CREW CHIEF', 'MASTER ORGANIZER']

/** Which rank band a level falls in (0-4). New band = a rank-up moment. */
export function rankIndex(lvl: number): number {
  if (lvl < 3) return 0
  if (lvl < 5) return 1
  if (lvl < 7) return 2
  if (lvl < 10) return 3
  return 4
}

export const rankTitle = (lvl: number) => RANKS[rankIndex(lvl)]

export const MISSION_BONUS = 25

export const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

const hash = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** Deterministically feature one quest as today's mission (stable for the whole day). */
export function dailyMission(tasks: Task[], dayKey: string): Task | null {
  if (tasks.length === 0) return null
  return tasks.slice().sort((a, b) => a.order - b.order)[hash(dayKey) % tasks.length]
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
