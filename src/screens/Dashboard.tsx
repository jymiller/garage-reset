import { useState } from 'react'
import type { Tab } from '../App'
import { useStore } from '../store'
import { sound } from '../sound'
import { nextTasks, progress } from '../lib'
import { xp, level, leaderboard, achievements, rankIndex, dailyMission, todayKey, MISSION_BONUS, WEEKLY_GOAL, weekKey, allCleared } from '../game'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCard } from '../components/TaskCard'
import { GarageIcon } from '../components/GarageIcons'
import { ToolPage } from '../components/ToolPage'
import { ResetTaskList } from '../components/ResetTaskList'
import './progress.css'

const LEVEL_NAMES = ['Getting started', 'Finding a rhythm', 'Making room', 'Keeping things organized', 'Experienced organizer']
const MILESTONES: Record<string, { name: string; description: string }> = {
  first: { name: 'First task finished', description: 'Complete one task.' },
  streak: { name: 'Three days of progress', description: 'Complete tasks on three consecutive days.' },
  quarter: { name: 'A quarter of the list', description: 'Complete 25% of the task list.' },
  half: { name: 'Halfway through the list', description: 'Complete 50% of the task list.' },
  zone: { name: 'One area’s tasks finished', description: 'Complete every task assigned to one area.' },
  quarterm: { name: 'Five items recorded', description: 'Add five items to the local item list.' },
  boss: { name: 'Every task finished', description: 'Complete 100% of the task list.' },
}

export function Dashboard({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { tasks, items, streak, bonusXp, weekDone, weekTag, combo, resetAll } = useStore()
  const [muted, setMuted] = useState(sound.isMuted())
  const thisWeekDone = weekTag === weekKey() ? weekDone : 0
  const weekPct = Math.min(100, Math.round((thisWeekDone / WEEKLY_GOAL) * 100))
  const cleared = allCleared(tasks)
  const overall = progress(tasks)
  const totalXp = xp(tasks) + bonusXp
  const lv = level(totalXp)
  const board = leaderboard(tasks)
  const trophies = achievements(tasks, items, streak)
  const upNext = nextTasks(tasks, 3)
  const mission = dailyMission(tasks, todayKey())

  return <ToolPage title="Task progress" icon="board" localData description="A clear view of your task list, small wins, and the next thing to do." actions={<>
    <button className="tool-button" onClick={() => onNavigate('score')}>Photo points & cash →</button>
    <button className="tool-button secondary" aria-pressed={!muted} onClick={() => { sound.toggle(); setMuted(sound.isMuted()) }}>
      <GarageIcon name="sound" />Sound {muted ? 'off' : 'on'}
    </button>
  </>}>
    <div className="tool-stack task-progress-page">
      <section className="tool-card task-progress-overview" aria-labelledby="task-list-heading">
        <div className="tool-row task-progress-heading"><div><p className="tool-muted">Your local task list</p><h2 id="task-list-heading">{cleared ? 'Every listed task is complete.' : overall.done ? 'One task at a time.' : 'Start with one manageable task.'}</h2></div><GarageIcon name={cleared ? 'trophy' : 'board'} /></div>
        <div className="tool-stats">
          <div className="tool-stat"><span>Tasks completed</span><strong>{overall.done}<small> / {overall.total}</small></strong></div>
          <div className="tool-stat"><span>Task list progress</span><strong>{overall.pct}%</strong></div>
          <div className="tool-stat"><span>Recorded day streak</span><strong>{streak}<small> {streak === 1 ? 'day' : 'days'}</small></strong></div>
        </div>
        <ProgressBar pct={overall.pct} color="#6f8d64" />
        <p className="tool-muted">Task checkmarks track this list. Use your photos and container inventory to see changes in the garage and how much you’re keeping.</p>
        {combo >= 2 && <p className="tool-chip">Your last run: {combo} tasks completed close together</p>}
      </section>

      <div className="tool-grid">
        <section className="tool-card" aria-labelledby="task-level-heading">
          <div className="tool-row task-progress-heading"><h2 id="task-level-heading" className="tool-section-heading">Task level {lv.lvl}</h2><span className="tool-chip">{totalXp} local XP</span></div>
          <p>{LEVEL_NAMES[rankIndex(lv.lvl)]}</p>
          <ProgressBar pct={lv.pct} color="#b68d3f" />
          <p className="tool-muted">{lv.per - lv.into} XP to level {lv.lvl + 1}. This includes {bonusXp} bonus XP from local tasks.</p>
          <p className="tool-muted">Photo missions have their own shared XP. Container volume is tracked separately.</p>
        </section>
        <section className="tool-card" aria-labelledby="weekly-task-heading">
          <div className="tool-row task-progress-heading"><h2 id="weekly-task-heading" className="tool-section-heading">This week’s tasks</h2><span className="tool-chip">{thisWeekDone} / {WEEKLY_GOAL}</span></div>
          <p>{thisWeekDone >= WEEKLY_GOAL ? 'You reached this week’s task goal.' : 'Complete ' + WEEKLY_GOAL + ' local tasks this week.'}</p>
          <ProgressBar pct={weekPct} color="#6f8d64" />
          <p className="tool-muted">A small, steady goal to keep the list moving.</p>
        </section>
      </div>

      {mission && <section className="tool-card task-progress-featured" aria-labelledby="featured-task-heading">
        <div className="tool-row task-progress-heading"><h2 id="featured-task-heading" className="tool-section-heading">Today’s featured task</h2><span className="tool-chip">{mission.status === 'done' ? 'Marked complete' : '+' + MISSION_BONUS + ' bonus XP'}</span></div>
        <p>{mission.title}</p>
        <p className="tool-muted">Chosen from your local task list for today.</p>
      </section>}

      <section className="tool-card task-photo-invitation" aria-labelledby="photo-invitation-heading">
        <GarageIcon name="missions" />
        <div><h2 id="photo-invitation-heading" className="tool-section-heading">Make your next step a photo mission.</h2><p>Take a before photo, sort one small batch, then photograph what changed.</p><button className="tool-button" onClick={() => { sound.start(); onNavigate('play') }}>Start a photo mission</button></div>
      </section>

      <section className="tool-stack" aria-labelledby="next-tasks-heading">
        <div className="tool-row task-progress-heading"><h2 id="next-tasks-heading" className="tool-section-heading">Next tasks</h2><button className="tool-button secondary" onClick={() => onNavigate('people')}>See team tasks</button></div>
        {upNext.length ? upNext.map(task => <TaskCard key={task.id} task={task} />) : <div className="tool-card"><p>{cleared ? 'Every task on this list is marked complete.' : 'No tasks are ready to start. Check the team list for blocked tasks.'}</p>{cleared && <button className="tool-button" onClick={() => onNavigate('results')}>See team standings</button>}</div>}
      </section>

      <section className="tool-stack" aria-labelledby="team-progress-heading">
        <div className="tool-row task-progress-heading"><h2 id="team-progress-heading" className="tool-section-heading">Team task progress</h2><button className="tool-button secondary" onClick={() => onNavigate('results')}>View standings</button></div>
        <div className="tool-card task-team-list">
          {board.map(person => <button className="task-team-row" key={person.id} onClick={() => onNavigate('people')}>
            <span className="task-team-person"><span className="task-person-initial" aria-hidden="true">{person.name.slice(0, 1)}</span><span><strong>{person.name}</strong><span className="tool-muted">{person.done} of {person.total} tasks complete</span></span></span>
            <span className="task-person-score">{person.points} <small>task XP</small></span>
            <ProgressBar pct={person.total ? Math.round(person.done / person.total * 100) : 0} color="#6f8d64" />
          </button>)}
        </div>
      </section>

      <section className="tool-stack" aria-labelledby="task-milestones-heading">
        <h2 id="task-milestones-heading" className="tool-section-heading">Small milestones</h2>
        <div className="task-milestone-grid">{trophies.map(achievement => {
          const copy = MILESTONES[achievement.id]
          return <div key={achievement.id} className={'tool-card task-milestone' + (achievement.unlocked ? ' is-earned' : '')}>
            <GarageIcon name="trophy" /><div><span className="tool-chip">{achievement.unlocked ? 'Reached' : 'Still to come'}</span><h3>{copy?.name ?? achievement.name}</h3><p className="tool-muted">{copy?.description ?? achievement.desc}</p></div>
          </div>
        })}</div>
      </section>

      <footer className="tool-card task-progress-footer">
        <div><h2 className="tool-section-heading">Task settings</h2><p className="tool-muted">Resetting restores the original tasks and removes local item records, task XP, and streaks on this device.</p></div>
        <div className="tool-row"><button className="tool-button secondary" onClick={() => onNavigate('sound')}>Sound settings</button></div>
        <ResetTaskList onReset={resetAll} />
      </footer>
    </div>
  </ToolPage>
}
