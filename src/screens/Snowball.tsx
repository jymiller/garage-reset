import { useState } from 'react'
import type { PersonId } from '../types'
import { useStore } from '../store'
import { people, zoneName } from '../data'
import { nextTasks, progress } from '../lib'
import { xp, taskXp } from '../game'
import { GarageIcon } from '../components/GarageIcons'
import { ToolPage } from '../components/ToolPage'
import { sound } from '../sound'

export function Snowball() {
  const { tasks, setTaskStatus } = useStore()
  const [who, setWho] = useState<PersonId | null>(null)

  if (!who) return <ToolPage title="Who is sorting?" description="Choose a person to see their next three tasks." icon="crew" localData>
    <div className="tool-stack">{people.map(person => {
      const pr = progress(tasks, person.id)
      return <button key={person.id} className="tool-card tool-row" onClick={() => {sound.start();setWho(person.id)}}><strong>{person.name}</strong><span className="tool-muted">{xp(tasks, person.id)} task XP · {pr.pct}% complete</span></button>
    })}</div>
  </ToolPage>

  const queue = nextTasks(tasks, 3, who)
  const top = queue[0]
  const person = people.find(p => p.id === who)!
  return <ToolPage title={`${person.name}’s next task`} description="Finish one task, then move on to the next." icon="board" localData actions={<button className="tool-button secondary" onClick={() => {sound.back();setWho(null)}}>Change person</button>}>
    {top ? <><section className="tool-card tool-stack"><span className="tool-chip">{zoneName(top.zone)}</span><h2>{top.title}</h2><button className="tool-button" onClick={() => setTaskStatus(top.id, 'done')}>Mark done · +{taskXp(top)} task XP</button></section>{queue.length>1&&<section className="tool-card tool-stack"><h2>After this</h2>{queue.slice(1).map(task=><p key={task.id}>{task.title}</p>)}</section>}</> : <section className="tool-card tool-stack"><GarageIcon name="trophy"/><h2>All assigned tasks are done.</h2><p>{person.name} has no unfinished tasks in this list.</p></section>}
  </ToolPage>
}
