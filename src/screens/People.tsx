import { useState } from 'react'
import type { PersonId } from '../types'
import { useStore } from '../store'
import { people } from '../data'
import { progress } from '../lib'
import { xp, level } from '../game'
import { arcPerson } from '../theme'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCard } from '../components/TaskCard'

export function People() {
  const { tasks } = useStore()
  const [active, setActive] = useState<PersonId>('john')

  const theirs = tasks.filter((t) => t.person === active).sort((a, b) => a.order - b.order)
  const pr = progress(tasks, active)
  const px = xp(tasks, active)
  const lv = level(px)
  const color = arcPerson[active]

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-pixel text-sm text-[#2bd14a]">PLAYERS</h1>
      </header>

      <div className="flex gap-2">
        {people.map((p) => {
          const on = p.id === active
          return (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className="arc-panel flex-1 py-2.5 text-center transition"
              style={{
                borderColor: arcPerson[p.id],
                background: on ? arcPerson[p.id] : '#0d0d18',
              }}
            >
              <span
                className="arc-vt text-lg"
                style={{ color: on ? '#07070e' : arcPerson[p.id] }}
              >
                {p.name.toUpperCase()}
              </span>
            </button>
          )
        })}
      </div>

      <section className="arc-panel p-4" style={{ borderColor: color }}>
        <div className="flex items-end justify-between">
          <p className="font-pixel text-sm" style={{ color }}>
            LV.{lv.lvl}
          </p>
          <p className="arc-vt text-xl text-[#ffd23f]">{px} XP</p>
        </div>
        <ProgressBar pct={pr.pct} color={color} className="mt-2" />
        <p className="arc-vt mt-2 text-[#8a8aa6]">
          {pr.done}/{pr.total} QUESTS CLEARED · {pr.pct}%
        </p>
      </section>

      <section className="space-y-2">
        {theirs.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </section>
    </div>
  )
}
