import { useEffect } from 'react'
import type { Tab } from '../App'
import { useStore } from '../store'
import { allCleared, leaderboard } from '../game'
import { progress } from '../lib'
import { sound } from '../sound'
import { GarageIcon } from '../components/GarageIcons'
import { ProgressBar } from '../components/ProgressBar'
import { ToolPage } from '../components/ToolPage'
import { ResetTaskList } from '../components/ResetTaskList'
import './progress.css'

export function FinalStandings({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { tasks, resetAll } = useStore()
  const board = leaderboard(tasks)
  const cleared = allCleared(tasks)
  const overall = progress(tasks)

  useEffect(() => {
    if (!cleared) return
    sound.winner()
    const timer = setTimeout(() => sound.loser(), 1700)
    return () => clearTimeout(timer)
  }, [cleared])

  return <ToolPage title="Team standings" icon="trophy" localData description="See each person’s contribution to the task list on this device.">
    <div className="tool-stack task-progress-page">
      <section className="tool-card task-standings-summary">
        <GarageIcon name={cleared ? 'trophy' : 'crew'} />
        <div><h2>{cleared ? 'Every listed task is complete.' : 'The task list is still in progress.'}</h2><p>{overall.done} of {overall.total} tasks marked complete.</p><p className="tool-muted">These standings use local task XP. Shared photo-mission XP and container volume are tracked separately. Completing the list does not confirm the garage is physically clear.</p></div>
      </section>

      <section className="tool-stack" aria-label="Team task standings">
        {board.map(person => {
          const place = 1 + board.filter(other => other.points > person.points).length
          const tied = board.filter(other => other.points === person.points).length > 1
          const leading = place === 1 && person.points > 0
          return <article key={person.id} className={'tool-card task-standing' + (leading ? ' is-leading' : '')}>
            <div className="task-standing-person"><span className="task-person-initial" aria-hidden="true">{person.name.slice(0, 1)}</span><div><span className="tool-muted">{person.points === 0 ? 'Ready to begin' : (tied ? 'Tied for ' : 'Place ') + place}</span><h2>{person.name}</h2></div></div>
            <div className="task-standing-score"><strong>{person.points}</strong><span>task XP</span></div>
            <div className="task-standing-progress"><p>{person.done} of {person.total} assigned tasks complete</p><ProgressBar pct={person.total ? Math.round(person.done / person.total * 100) : 0} color={leading ? '#b68d3f' : '#6f8d64'} /></div>
          </article>
        })}
      </section>

      <section className="tool-card task-standings-next">
        <h2 className="tool-section-heading">Keep the next step small.</h2>
        <p>Review the next task, photograph one small sorting session, or check what is still in your containers.</p>
        <div className="tool-row"><button className="tool-button" onClick={() => onNavigate('dashboard')}>Back to task progress</button><button className="tool-button secondary" onClick={() => onNavigate('play')}>Start a photo mission</button><button className="tool-button secondary" onClick={() => onNavigate('crates')}>View containers</button></div>
      </section>

      <footer className="tool-card task-progress-footer">
        <div><h2 className="tool-section-heading">Start the local list again</h2><p className="tool-muted">This restores the original tasks and removes this device’s local item records, task XP, and streaks.</p></div>
        <ResetTaskList onReset={() => {
          sound.start()
          resetAll()
          onNavigate('dashboard')
        }} />
      </footer>
    </div>
  </ToolPage>
}
