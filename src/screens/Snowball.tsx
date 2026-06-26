import { useState } from 'react'
import type { PersonId } from '../types'
import { useStore } from '../store'
import { people, zoneName } from '../data'
import { nextTasks, progress } from '../lib'
import { xp } from '../game'
import { arcPerson } from '../theme'
import { CheckIcon } from '../components/icons'
import { sound } from '../sound'

export function Snowball() {
  const { tasks, setTaskStatus } = useStore()
  const [who, setWho] = useState<PersonId | null>(null)

  if (!who) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="font-pixel text-sm text-[#2bd14a]">SELECT PLAYER</h1>
          <p className="arc-vt mt-1 text-[#8a8aa6]">PICK ONE. CLEAR THREE QUESTS.</p>
        </header>
        <div className="space-y-3">
          {people.map((p) => {
            const pr = progress(tasks, p.id)
            return (
              <button
                key={p.id}
                onClick={() => {
                  sound.start()
                  setWho(p.id)
                }}
                className="arc-panel flex w-full items-center justify-between p-4 text-left transition active:translate-x-1"
                style={{ borderColor: arcPerson[p.id] }}
              >
                <span className="arc-vt text-2xl" style={{ color: arcPerson[p.id] }}>
                  {p.name.toUpperCase()}
                </span>
                <span className="arc-vt text-xl text-[#ffd23f]">{xp(tasks, p.id)} XP · {pr.pct}%</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const queue = nextTasks(tasks, 3, who)
  const top = queue[0]
  const person = people.find((p) => p.id === who)!
  const color = arcPerson[who]

  return (
    <div className="flex min-h-[72vh] flex-col">
      <header className="flex items-center justify-between">
        <button
          onClick={() => {
            sound.back()
            setWho(null)
          }}
          className="font-pixel text-[8px] text-[#8a8aa6]"
        >
          ◀ PLAYERS
        </button>
        <span className="arc-vt text-xl" style={{ color }}>
          {person.name.toUpperCase()}
        </span>
      </header>

      {!top ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="arc-panel arc-panel-yellow flex h-24 w-24 items-center justify-center text-[#ffd23f]">
            <CheckIcon className="h-12 w-12" />
          </div>
          <p className="font-pixel mt-5 text-base text-[#2bd14a]">STAGE CLEAR</p>
          <p className="arc-vt mt-2 text-[#8a8aa6]">NOTHING LEFT FOR {person.name.toUpperCase()}.</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="font-pixel text-[9px] text-[#ff3ca6]">QUEST</p>
            <h2 className="arc-vt mt-4 text-5xl leading-none text-[#e8e8f5]">{top.title}</h2>
            <span className="font-pixel mt-5 bg-[#ffd23f] px-2 py-1.5 text-[8px] text-[#4a3a00]">
              {zoneName(top.zone).toUpperCase()}
            </span>
          </div>

          <button
            onClick={() => setTaskStatus(top.id, 'done')}
            className="arc-btn mb-3 flex w-full items-center justify-center gap-3 py-6 text-xl"
          >
            <CheckIcon className="h-7 w-7" />
            DONE +50XP
          </button>

          {queue.length > 1 && (
            <div>
              <p className="font-pixel mb-1.5 text-[8px] text-[#8a8aa6]">THEN</p>
              <div className="space-y-1.5">
                {queue.slice(1).map((t) => (
                  <div key={t.id} className="arc-panel arc-panel-dim arc-vt px-3 py-2 text-[#8a8aa6]">
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
