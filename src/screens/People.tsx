import { useState } from 'react'
import type { PersonId } from '../types'
import { useStore } from '../store'
import { people, personName } from '../data'
import { progress } from '../lib'
import { xp, level, rankTitle } from '../game'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCard } from '../components/TaskCard'
import { ToolPage } from '../components/ToolPage'
import './tasks.css'

export function People() {
  const { tasks } = useStore()
  const [active, setActive] = useState<PersonId>('john')
  const theirs = tasks.filter(task => task.person === active).sort((a, b) => a.order - b.order)
  const pr = progress(tasks, active)
  const points = xp(tasks, active)
  const currentLevel = level(points)
  const rank = rankTitle(currentLevel.lvl).toLowerCase()
  const name = personName(active)

  return <ToolPage title="The crew" description="Choose a person to see their tasks and update their progress." icon="crew" localData>
    <div className="task-people" role="group" aria-label="Choose a crew member">
      {people.map(person => <button
        key={person.id}
        type="button"
        className={`task-person${person.id === active ? ' is-selected' : ''}`}
        aria-pressed={person.id === active}
        onClick={() => setActive(person.id)}
      >{person.name}</button>)}
    </div>

    <section className="tool-card tool-stack" aria-labelledby="crew-progress-heading">
      <div className="tool-row task-summary-heading">
        <h2 id="crew-progress-heading" className="tool-section-heading task-page-heading">{name}’s progress</h2>
        <span className="tool-chip task-rank">{rank}</span>
      </div>
      <div className="tool-stats">
        <div className="tool-stat"><span>Tasks complete</span><strong>{pr.done} / {pr.total}</strong></div>
        <div className="tool-stat"><span>Task level</span><strong>{currentLevel.lvl}</strong></div>
        <div className="tool-stat"><span>Task points</span><strong>{points} XP</strong></div>
      </div>
      <ProgressBar pct={pr.pct} color="#41644d" />
      <p className="tool-muted task-body-note">{pr.pct}% of {name}’s tasks complete. Task points are separate from photo mission XP.</p>
    </section>

    <section className="tool-stack" aria-labelledby="crew-tasks-heading">
      <h2 id="crew-tasks-heading" className="tool-section-heading task-page-heading">{name}’s tasks</h2>
      {theirs.map(task => <TaskCard key={task.id} task={task} />)}
      {theirs.length === 0 && <p className="tool-card tool-muted task-body-note">No tasks are assigned to {name} yet.</p>}
    </section>
  </ToolPage>
}
