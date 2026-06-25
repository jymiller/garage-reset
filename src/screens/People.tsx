import { useState } from 'react'
import type { PersonId } from '../types'
import { useStore } from '../store'
import { people } from '../data'
import { progress } from '../lib'
import { personMeta } from '../theme'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCard } from '../components/TaskCard'

export function People() {
  const { tasks } = useStore()
  const [active, setActive] = useState<PersonId>('john')

  const theirs = tasks
    .filter((t) => t.person === active)
    .sort((a, b) => a.order - b.order)
  const pr = progress(tasks, active)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">People</h1>
        <p className="text-sm text-slate-500">Tap a name to see their tasks.</p>
      </header>

      <div className="flex gap-2">
        {people.map((p) => {
          const on = p.id === active
          return (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold transition ${
                on
                  ? `${personMeta[p.id].soft} ${personMeta[p.id].text} ring-2 ${personMeta[p.id].ring}`
                  : 'bg-white text-slate-500 ring-1 ring-slate-100'
              }`}
            >
              {p.name}
            </button>
          )
        })}
      </div>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-600">{pr.done} of {pr.total} done</span>
          <span className="tabular-nums text-slate-400">{pr.pct}%</span>
        </div>
        <ProgressBar pct={pr.pct} bar={personMeta[active].bar} />
      </section>

      <section className="space-y-2">
        {theirs.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </section>
    </div>
  )
}
