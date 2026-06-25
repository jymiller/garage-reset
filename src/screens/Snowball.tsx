import { useState } from 'react'
import type { PersonId } from '../types'
import { useStore } from '../store'
import { people, zoneName } from '../data'
import { nextTasks, progress } from '../lib'
import { personMeta } from '../theme'
import { CheckIcon } from '../components/icons'

export function Snowball() {
  const { tasks, setTaskStatus } = useStore()
  const [who, setWho] = useState<PersonId | null>(null)

  if (!who) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Snowball</h1>
          <p className="text-sm text-slate-500">Pick one person. Knock out three small things.</p>
        </header>
        <div className="space-y-3">
          {people.map((p) => {
            const pr = progress(tasks, p.id)
            return (
              <button
                key={p.id}
                onClick={() => setWho(p.id)}
                className={`flex w-full items-center justify-between rounded-2xl ${personMeta[p.id].soft} p-5 text-left ring-1 ring-slate-100 transition active:scale-[0.99]`}
              >
                <span className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${personMeta[p.id].dot}`} />
                  <span className="text-lg font-semibold text-slate-800">{p.name}</span>
                </span>
                <span className={`text-sm font-medium ${personMeta[p.id].text}`}>{pr.pct}%</span>
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

  return (
    <div className="flex min-h-[70vh] flex-col">
      <header className="flex items-center justify-between">
        <button onClick={() => setWho(null)} className="text-sm font-medium text-slate-500">
          ← People
        </button>
        <span className={`flex items-center gap-2 text-sm font-semibold ${personMeta[who].text}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${personMeta[who].dot}`} />
          {person.name}
        </span>
      </header>

      {!top ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckIcon className="h-10 w-10" />
          </div>
          <p className="mt-4 text-xl font-bold text-slate-800">All clear, {person.name}.</p>
          <p className="mt-1 text-sm text-slate-500">Nothing left in your queue right now.</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-slate-400">Your next thing</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-900">{top.title}</h2>
            <span className="mt-4 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
              {zoneName(top.zone)}
            </span>
          </div>

          <button
            onClick={() => setTaskStatus(top.id, 'done')}
            className="mb-3 flex w-full items-center justify-center gap-3 rounded-3xl bg-emerald-500 py-6 text-2xl font-bold text-white shadow-lg shadow-emerald-200 transition active:scale-[0.98]"
          >
            <CheckIcon className="h-8 w-8" />
            Done
          </button>

          {queue.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Then</p>
              {queue.slice(1).map((t) => (
                <div key={t.id} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-100">
                  {t.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
