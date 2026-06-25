import type { Tab } from '../App'
import { useStore } from '../store'
import { people } from '../data'
import { nextTasks, progress, cheer } from '../lib'
import { personMeta } from '../theme'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCard } from '../components/TaskCard'
import { BoltIcon } from '../components/icons'

export function Dashboard({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { tasks, resetAll } = useStore()
  const overall = progress(tasks)
  const upNext = nextTasks(tasks, 3)

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-emerald-600">Garage Reset</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{cheer(overall.pct)}</h1>
      </header>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-slate-500">Overall progress</p>
            <p className="text-4xl font-bold tabular-nums text-slate-900">{overall.pct}%</p>
          </div>
          <p className="pb-1 text-sm text-slate-400">
            {overall.done} of {overall.total} done
          </p>
        </div>
        <ProgressBar pct={overall.pct} className="mt-3" />
      </section>

      <button
        onClick={() => onNavigate('snowball')}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-lg font-semibold text-white shadow-sm transition active:scale-[0.98]"
      >
        <BoltIcon className="h-6 w-6" />
        Start a Snowball
      </button>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Next up</h2>
        {upNext.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-center text-sm text-slate-500 ring-1 ring-slate-100">
            Nothing left in the queue. Nice work.
          </p>
        ) : (
          <div className="space-y-2">
            {upNext.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">By person</h2>
        <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          {people.map((p) => {
            const pr = progress(tasks, p.id)
            return (
              <button
                key={p.id}
                onClick={() => onNavigate('people')}
                className="block w-full text-left"
              >
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className={`h-2.5 w-2.5 rounded-full ${personMeta[p.id].dot}`} />
                    {p.name}
                  </span>
                  <span className="tabular-nums text-slate-400">{pr.pct}%</span>
                </div>
                <ProgressBar pct={pr.pct} bar={personMeta[p.id].bar} />
              </button>
            )
          })}
        </div>
      </section>

      <footer className="pt-2 text-center">
        <button
          onClick={() => {
            if (confirm('Reset all tasks and items back to the starting set?')) resetAll()
          }}
          className="text-xs text-slate-400 underline-offset-2 hover:underline"
        >
          Reset all data
        </button>
      </footer>
    </div>
  )
}
