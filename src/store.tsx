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

function initialState(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>
      return {
        tasks: parsed.tasks ?? seedTasks(),
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
      if (status === 'done' && prev?.status !== 'done') {
        const today = dayStr(new Date())
        const projected = state.tasks.map((t) => (t.id === id ? { ...t, status: 'done' as TaskStatus } : t))
        const claimsMission = dailyMission(state.tasks, today)?.id === id && state.missionDay !== today
        const bonusAfter = state.bonusXp + (claimsMission ? MISSION_BONUS : 0)
        const newStreak = bumpStreak(state.streak, state.lastDay).streak
        const before = level(xp(state.tasks) + state.bonusXp)
        const after = level(xp(projected) + bonusAfter)
        const achBefore = achievements(state.tasks, state.items, state.streak).filter((a) => a.unlocked).length
        const achAfter = achievements(projected, state.items, newStreak).filter((a) => a.unlocked).length
        const wk = weekKey()
        const weekDoneAfter = (state.weekTag === wk ? state.weekDone : 0) + 1
        const now = Date.now()
        const comboActive = state.lastDoneAt != null && now - state.lastDoneAt < COMBO_WINDOW
        const combo = comboActive ? Math.min(state.combo + 1, COMBO_MAX) : 1
        sound.done(prev?.weight ?? 1)
        if (combo >= 2) sound.combo(combo)
        if (rankIndex(after.lvl) > rankIndex(before.lvl)) sound.rankUp()
        else if (after.lvl > before.lvl) sound.levelUp()
        else if (claimsMission) sound.mission()
        else if (achAfter > achBefore) sound.unlock()
        if (weekDoneAfter === WEEKLY_GOAL) sound.weeklyClear()
      }
      setState((s) => {
        const p = s.tasks.find((t) => t.id === id)
        const justCompleted = status === 'done' && p?.status !== 'done'
        const today = dayStr(new Date())
        const wk = weekKey()
        const now = Date.now()
        const streakState = justCompleted ? bumpStreak(s.streak, s.lastDay) : { streak: s.streak, lastDay: s.lastDay }
        const claimsMission = justCompleted && dailyMission(s.tasks, today)?.id === id && s.missionDay !== today
        const weekDone = justCompleted ? (s.weekTag === wk ? s.weekDone : 0) + 1 : s.weekDone
        const comboActive = s.lastDoneAt != null && now - s.lastDoneAt < COMBO_WINDOW
        const combo = justCompleted ? (comboActive ? Math.min(s.combo + 1, COMBO_MAX) : 1) : s.combo
        const comboBonus = justCompleted ? (combo - 1) * COMBO_BONUS : 0
        return {
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
          ...streakState,
          bonusXp: s.bonusXp + (claimsMission ? MISSION_BONUS : 0) + comboBonus,
          missionDay: claimsMission ? today : s.missionDay,
          weekTag: justCompleted ? wk : s.weekTag,
          weekDone,
          combo,
          lastDoneAt: justCompleted ? now : s.lastDoneAt,
        }
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
