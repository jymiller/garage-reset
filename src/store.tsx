import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Task, Item, TaskStatus, Decision, PersonId, ZoneId } from './types'
import { seedTasks } from './data'
import { xp, level, achievements } from './game'
import { sound } from './sound'

interface State {
  tasks: Task[]
  items: Item[]
  streak: number
  lastDay: string | null
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
      }
    }
  } catch {
    /* fall through to seed */
  }
  return { tasks: seedTasks(), items: [], streak: 0, lastDay: null }
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
        const projected = state.tasks.map((t) => (t.id === id ? { ...t, status: 'done' as TaskStatus } : t))
        const newStreak = bumpStreak(state.streak, state.lastDay).streak
        const leveledUp = level(xp(projected)).lvl > level(xp(state.tasks)).lvl
        const before = achievements(state.tasks, state.items, state.streak).filter((a) => a.unlocked).length
        const after = achievements(projected, state.items, newStreak).filter((a) => a.unlocked).length
        sound.done()
        if (leveledUp) sound.levelUp()
        else if (after > before) sound.unlock()
      }
      setState((s) => {
        const p = s.tasks.find((t) => t.id === id)
        const justCompleted = status === 'done' && p?.status !== 'done'
        const streakState = justCompleted ? bumpStreak(s.streak, s.lastDay) : { streak: s.streak, lastDay: s.lastDay }
        return {
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
          ...streakState,
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
    resetAll: () => setState({ tasks: seedTasks(), items: [], streak: 0, lastDay: null }),
  }

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
