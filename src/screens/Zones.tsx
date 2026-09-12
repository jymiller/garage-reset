import { useState } from 'react'
import type { Decision, ZoneId } from '../types'
import { useStore } from '../store'
import { zones, personName } from '../data'
import { progress } from '../lib'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCard } from '../components/TaskCard'
import { ChevronIcon } from '../components/icons'
import { GarageIcon } from '../components/GarageIcons'
import { ToolPage } from '../components/ToolPage'
import './tasks.css'

const decisionLabels: Record<Decision, string> = {
  undecided: 'Not decided', keep: 'Keep', move: 'Move', donate: 'Donate', trash: 'Trash',
}

export function Zones() {
  const { tasks, items } = useStore()
  const [open, setOpen] = useState<ZoneId | null>(null)

  return <ToolPage title="Tasks by area" description="Open an area to see its tasks and the items recorded there." icon="board" localData>
    <div className="tool-stack">
      {zones.map(zone => {
        const zoneTasks = tasks.filter(task => task.zone === zone.id).sort((a, b) => a.order - b.order)
        const zoneItems = items.filter(item => item.zone === zone.id)
        const pr = progress(zoneTasks)
        const isOpen = open === zone.id
        const complete = pr.total > 0 && pr.done === pr.total
        const headingId = `task-area-heading-${zone.id}`
        const contentId = `task-area-content-${zone.id}`

        return <section className={`task-area${complete ? ' is-complete' : ''}`} key={zone.id} aria-labelledby={headingId}>
          <h2 className="task-area-heading" id={headingId}>
            <button type="button" className="task-area-toggle" onClick={() => setOpen(isOpen ? null : zone.id)} aria-expanded={isOpen} aria-controls={contentId}>
              <GarageIcon name="shelf" className="task-area-icon" />
              <span className="task-area-title">{zone.name}</span>
              <span aria-hidden="true"><ChevronIcon className={`task-area-chevron${isOpen ? ' is-open' : ''}`} /></span>
            </button>
          </h2>
          <div className="task-area-summary">
            <p>{pr.total ? `${pr.done} of ${pr.total} tasks complete` : 'No tasks recorded'} · {zoneItems.length} {zoneItems.length === 1 ? 'item' : 'items'}</p>
            {complete && <span className="tool-chip task-complete-chip">All tasks complete</span>}
            {pr.total > 0 && <ProgressBar pct={pr.pct} color="#41644d" />}
          </div>

          <div id={contentId} className="task-area-content" hidden={!isOpen}>
            {isOpen && <>
              {zoneTasks.length > 0 && <div className="tool-stack">
                <h3 className="tool-section-heading task-page-heading">Tasks</h3>
                {zoneTasks.map(task => <TaskCard key={task.id} task={task} showZone={false} />)}
              </div>}

              {zoneItems.length > 0 && <div className="tool-stack">
                <h3 className="tool-section-heading task-page-heading">Items in this area</h3>
                <ul className="task-area-items">
                  {zoneItems.map(item => <li key={item.id} className="task-area-item">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.owner ? `Owner: ${personName(item.owner)}` : 'Owner not recorded'}</p>
                    </div>
                    <span className={`task-item-decision decision-${item.decision}`}>{decisionLabels[item.decision]}</span>
                  </li>)}
                </ul>
              </div>}

              {zoneTasks.length === 0 && zoneItems.length === 0 && <p className="tool-muted task-body-note">No tasks or items have been recorded in this area yet.</p>}
            </>}
          </div>
        </section>
      })}
    </div>
  </ToolPage>
}
