import type { Task, TaskStatus } from '../types'
import { useStore } from '../store'
import { zoneName } from '../data'
import { taskXp } from '../game'
import { CheckIcon } from './icons'
import '../screens/tasks.css'

const STATUS_LABEL: Record<TaskStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  done: 'Complete',
  blocked: 'Blocked',
}

export function TaskCard({ task, showZone = true }: { task: Task; showZone?: boolean }) {
  const { setTaskStatus } = useStore()
  const done = task.status === 'done'
  const effort = task.weight ?? 1

  const toggle = (status: TaskStatus) =>
    setTaskStatus(task.id, task.status === status ? 'not-started' : status)

  return <article className={`task-card status-${task.status}`}>
    <div className="task-card-heading">
      <button
        type="button"
        onClick={() => setTaskStatus(task.id, done ? 'not-started' : 'done')}
        aria-label={`Mark “${task.title}” ${done ? 'not started' : 'complete'}`}
        aria-pressed={done}
        className="task-complete-toggle"
      ><span aria-hidden="true">{done ? <CheckIcon className="task-check-icon" /> : <span className="task-unchecked" />}</span></button>
      <div className="task-card-title">
        <h3>{task.title}</h3>
        <span className="task-current-status">{STATUS_LABEL[task.status]}</span>
      </div>
    </div>

    <div className="task-card-details">
      <span className="task-effort"><span aria-hidden="true" className="task-effort-dots">{Array.from({ length: effort }).map((_, index) => <i key={index} />)}</span>Effort: {effort}</span>
      {showZone && <span className="task-zone-name">{zoneName(task.zone)}</span>}
      {done && <span className="task-earned-points">{taskXp(task)} task XP</span>}
    </div>

    <div className="task-status-controls" role="group" aria-label={`Update status for ${task.title}`}>
      {(['in-progress', 'blocked'] as const).map(status => <button
        type="button"
        key={status}
        onClick={() => toggle(status)}
        aria-pressed={task.status === status}
        aria-label={`Mark “${task.title}” ${task.status === status ? 'not started' : STATUS_LABEL[status].toLowerCase()}`}
        className={`task-status-button${task.status === status ? ' is-selected' : ''}`}
      >{STATUS_LABEL[status]}</button>)}
    </div>
  </article>
}
