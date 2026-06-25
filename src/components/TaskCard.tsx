import type { Task, TaskStatus } from '../types'
import { useStore } from '../store'
import { zoneName } from '../data'
import { statusMeta } from '../theme'
import { CheckIcon } from './icons'

export function TaskCard({ task, showZone = true }: { task: Task; showZone?: boolean }) {
  const { setTaskStatus } = useStore()
  const done = task.status === 'done'

  const toggle = (status: TaskStatus) =>
    setTaskStatus(task.id, task.status === status ? 'not-started' : status)

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition ${
        done ? 'opacity-60' : ''
      }`}
    >
      <button
        onClick={() => setTaskStatus(task.id, done ? 'not-started' : 'done')}
        aria-label={done ? 'Mark not done' : 'Mark done'}
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
          done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent'
        }`}
      >
        <CheckIcon />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`text-[15px] font-medium leading-snug ${
            done ? 'text-slate-400 line-through' : 'text-slate-800'
          }`}
        >
          {task.title}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {showZone && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {zoneName(task.zone)}
            </span>
          )}
          {(['in-progress', 'blocked'] as TaskStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => toggle(s)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                task.status === s ? statusMeta[s].chip : 'bg-slate-100 text-slate-400'
              }`}
            >
              {statusMeta[s].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
