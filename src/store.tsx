import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Task, Item, TaskStatus, Decision, PersonId, ZoneId } from './types'
import { seedTasks } from './data'
import {
  xp,
  level,
  achievements,
  dailyMission,
  rankIndex,
  MISSION_BONUS,
  weekKey,
  WEEKLY_GOAL,
  COMBO_WINDOW,
  COMBO_MAX,
  COMBO_BONUS,
} from './game'
import { sound } from './sound'

interface State {
  tasks: Task[]
  items: Item[]
  streak: number
  lastDay: string | null
  bonusXp: number
  missionDay: string | null
  weekTag: string | null
  weekDone: number
  combo: number
  lastDoneAt: number | null
}

interface Store extends State {
  setTaskStatus: (id: string, status: TaskStatus) => void
  toggleStep: (id: string, index: number) => void
  addItem: (input: { name: string; owner: PersonId | null; zone: ZoneId | null; decision: Decision }) => void
  setItemDecision: (id: string, decision: Decision) => void
  deleteItem: (id: string) => void
  resetAll: () => void
}

const KEY = 'garage-reset-v1'
const StoreCtx = createContext<Store | null>(null)

const dayStr = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

/** Roll the daily streak forward when a task is completed. */
function bumpStreak(streak: number, lastDay: string | null): { streak: number; lastDay: string } {
  const today = dayStr(new Date())
  if (lastDay === today) return { streak: streak || 1, lastDay: today }
  const yesterday = dayStr(new Date(Date.now() - 86400000))
  return { streak: lastDay === yesterday ? streak + 1 : 1, lastDay: today }
}

/** Fire the celebration sounds for completing task `id` (level/rank/mission/combo/weekly). */
function playCompletionSfx(s: State, id: string) {
  const today = dayStr(new Date())
  const prev = s.tasks.find((t) => t.id === id)
  const projected = s.tasks.map((t) => (t.id === id ? { ...t, status: 'done' as TaskStatus } : t))
  const claimsMission = dailyMission(s.tasks, today)?.id === id && s.missionDay !== today
  const bonusAfter = s.bonusXp + (claimsMission ? MISSION_BONUS : 0)
  const newStreak = bumpStreak(s.streak, s.lastDay).streak
  const before = level(xp(s.tasks) + s.bonusXp)
  const after = level(xp(projected) + bonusAfter)
  const achBefore = achievements(s.tasks, s.items, s.streak).filter((a) => a.unlocked).length
  const achAfter = achievements(projected, s.items, newStreak).filter((a) => a.unlocked).length
  const wk = weekKey()
  const weekDoneAfter = (s.weekTag === wk ? s.weekDone : 0) + 1
  const comboActive = s.lastDoneAt != null && Date.now() - s.lastDoneAt < COMBO_WINDOW
  const combo = comboActive ? Math.min(s.combo + 1, COMBO_MAX) : 1
  sound.done(prev?.weight ?? 1)
  if (combo >= 2) sound.combo(combo)
  if (rankIndex(after.lvl) > rankIndex(before.lvl)) sound.rankUp()
  else if (after.lvl > before.lvl) sound.levelUp()
  else if (claimsMission) sound.mission()
  else if (achAfter > achBefore) sound.unlock()
  if (weekDoneAfter === WEEKLY_GOAL) sound.weeklyClear()
}

/** Mark task `id` done and roll forward streak / mission / combo / weekly state. */
function applyCompletion(s: State, id: string): State {
  const today = dayStr(new Date())
  const wk = weekKey()
  const now = Date.now()
  const streakState = bumpStreak(s.streak, s.lastDay)
  const claimsMission = dailyMission(s.tasks, today)?.id === id && s.missionDay !== today
  const weekDone = (s.weekTag === wk ? s.weekDone : 0) + 1
  const comboActive = s.lastDoneAt != null && now - s.lastDoneAt < COMBO_WINDOW
  const combo = comboActive ? Math.min(s.combo + 1, COMBO_MAX) : 1
  const comboBonus = (combo - 1) * COMBO_BONUS
  return {
    ...s,
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: 'done' } : t)),
    ...streakState,
    bonusXp: s.bonusXp + (claimsMission ? MISSION_BONUS : 0) + comboBonus,
    missionDay: claimsMission ? today : s.missionDay,
    weekTag: wk,
    weekDone,
    combo,
    lastDoneAt: now,
  }
}

function initialState(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>
      // steps are a static definition: re-attach from seed by id so existing
      // saves pick up newly added sub-steps without losing status/stepDone.
      // A task already done before it gained steps shows them all cleared.
      const stepsById = new Map(seedTasks().map((t) => [t.id, t.steps]))
      const tasks = (parsed.tasks ?? seedTasks()).map((t) => {
        const steps = stepsById.get(t.id) ?? t.steps
        if (!steps) return { ...t, steps }
        return { ...t, steps, stepDone: t.status === 'done' ? steps.map(() => true) : t.stepDone }
      })
      return {
        tasks,
        items: parsed.items ?? [],
        streak: parsed.streak ?? 0,
        lastDay: parsed.lastDay ?? null,
        bonusXp: parsed.bonusXp ?? 0,
        missionDay: parsed.missionDay ?? null,
        weekTag: parsed.weekTag ?? null,
        weekDone: parsed.weekDone ?? 0,
        combo: parsed.combo ?? 0,
        lastDoneAt: parsed.lastDoneAt ?? null,
      }
    }
  } catch {
    /* fall through to seed */
  }
  return {
    tasks: seedTasks(),
    items: [],
    streak: 0,
    lastDay: null,
    bonusXp: 0,
    missionDay: null,
    weekTag: null,
    weekDone: 0,
    combo: 0,
    lastDoneAt: null,
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* storage may be full or unavailable; ignore */
    }
  }, [state])

  const value: Store = {
    ...state,
    setTaskStatus: (id, status) => {
      const prev = state.tasks.find((t) => t.id === id)
      if (status === 'done' && prev?.status !== 'done') playCompletionSfx(state, id)
      setState((s) => {
        const p = s.tasks.find((t) => t.id === id)
        if (status === 'done' && p?.status !== 'done') return applyCompletion(s, id)
        return { ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)) }
      })
    },
    toggleStep: (id, index) => {
      const task = state.tasks.find((t) => t.id === id)
      if (!task?.steps) return
      const current = task.stepDone ?? task.steps.map(() => false)
      const next = current.map((v, i) => (i === index ? !v : v))
      const completing = next.every(Boolean) && task.status !== 'done'
      if (completing) playCompletionSfx(state, id)
      else if (next[index]) sound.subTick()
      setState((s) => {
        const t0 = s.tasks.find((t) => t.id === id)
        if (!t0?.steps) return s
        const cur = t0.stepDone ?? t0.steps.map(() => false)
        const stepDone = cur.map((v, i) => (i === index ? !v : v))
        if (stepDone.every(Boolean) && t0.status !== 'done') {
          return applyCompletion({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, stepDone } : t)) }, id)
        }
        const status: TaskStatus = stepDone.some(Boolean) ? 'in-progress' : 'not-started'
        return { ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, stepDone, status } : t)) }
      })
    },
    addItem: (input) =>
      setState((s) => ({
        ...s,
        items: [{ id: crypto.randomUUID(), createdAt: Date.now(), ...input }, ...s.items],
      })),
    setItemDecision: (id, decision) =>
      setState((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, decision } : i)) })),
    deleteItem: (id) => setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) })),
    resetAll: () =>
      setState({
        tasks: seedTasks(),
        items: [],
        streak: 0,
        lastDay: null,
        bonusXp: 0,
        missionDay: null,
        weekTag: null,
        weekDone: 0,
        combo: 0,
        lastDoneAt: null,
      }),
  }

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
