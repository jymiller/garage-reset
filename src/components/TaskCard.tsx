import type { Task, TaskStatus } from '../types'
import { useStore } from '../store'
import { zoneName } from '../data'
import { CheckIcon } from './icons'

const STATUS_LABEL: Record<TaskStatus, string> = {
  'not-started': 'NOT STARTED',
  'in-progress': 'IN PROGRESS',
  done: 'DONE',
  blocked: 'BLOCKED',
}

export function TaskCard({ task, showZone = true }: { task: Task; showZone?: boolean }) {
  const { setTaskStatus } = useStore()
  const done = task.status === 'done'

  const toggle = (status: TaskStatus) =>
    setTaskStatus(task.id, task.status === status ? 'not-started' : status)

  return (
    <div className={`arc-panel flex items-start gap-3 p-3 ${done ? 'opacity-50' : ''}`}>
      <button
        onClick={() => setTaskStatus(task.id, done ? 'not-started' : 'done')}
        aria-label={done ? 'Mark not done' : 'Mark done'}
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border-2 transition active:scale-90 ${
          done ? 'border-[#2bd14a] bg-[#2bd14a] text-[#04210d]' : 'border-[#2bd14a] text-transparent'
        }`}
      >
        <CheckIcon />
      </button>

      <div className="min-w-0 flex-1">
        <p className={`arc-vt text-[#e8e8f5] ${done ? 'text-[#6cf08a] line-through' : ''}`}>{task.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {showZone && (
            <span className="font-pixel bg-[#ffd23f] px-1.5 py-1 text-[7px] text-[#4a3a00]">
              {zoneName(task.zone).toUpperCase()}
            </span>
          )}
          {(['in-progress', 'blocked'] as TaskStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => toggle(s)}
              className={`font-pixel border px-1.5 py-1 text-[7px] transition ${
                task.status === s
                  ? s === 'blocked'
                    ? 'border-[#ff3ca6] bg-[#ff3ca6] text-[#3a0020]'
                    : 'border-[#36e0e0] bg-[#36e0e0] text-[#06343a]'
                  : 'border-[#33334a] text-[#6a6a82]'
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {done && <span className="font-pixel mt-1 shrink-0 text-[8px] text-[#ffd23f]">+50</span>}
    </div>
  )
}
