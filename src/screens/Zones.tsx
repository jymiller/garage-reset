import { useState } from 'react'
import type { ZoneId } from '../types'
import { useStore } from '../store'
import { zones, personName } from '../data'
import { progress } from '../lib'
import { decisionMeta, personMeta } from '../theme'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCard } from '../components/TaskCard'
import { ChevronIcon } from '../components/icons'

export function Zones() {
  const { tasks, items } = useStore()
  const [open, setOpen] = useState<ZoneId | null>(null)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Zones</h1>
        <p className="text-sm text-slate-500">Tap a zone to see its tasks and items.</p>
      </header>

      <div className="space-y-2.5">
        {zones.map((z) => {
          const zoneTasks = tasks.filter((t) => t.zone === z.id).sort((a, b) => a.order - b.order)
          const zoneItems = items.filter((i) => i.zone === z.id)
          const pr = progress(zoneTasks)
          const isOpen = open === z.id

          return (
            <div key={z.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
              <button
                onClick={() => setOpen(isOpen ? null : z.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">{z.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {pr.done}/{pr.total} tasks · {zoneItems.length} item{zoneItems.length === 1 ? '' : 's'}
                  </p>
                  {pr.total > 0 && <ProgressBar pct={pr.pct} className="mt-2 h-2" />}
                </div>
                <ChevronIcon className={`h-5 w-5 shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-4">
                  {zoneTasks.length > 0 && (
                    <div className="space-y-2">
                      {zoneTasks.map((t) => (
                        <TaskCard key={t.id} task={t} showZone={false} />
                      ))}
                    </div>
                  )}

                  {zoneItems.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Items</p>
                      {zoneItems.map((i) => (
                        <div
                          key={i.id}
                          className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-100"
                        >
                          {i.owner && <span className={`h-2 w-2 shrink-0 rounded-full ${personMeta[i.owner].dot}`} />}
                          <span className="min-w-0 flex-1 truncate text-slate-700">{i.name}</span>
                          {i.owner && <span className="text-xs text-slate-400">{personName(i.owner)}</span>}
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${decisionMeta[i.decision].chip}`}>
                            {decisionMeta[i.decision].label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {zoneTasks.length === 0 && zoneItems.length === 0 && (
                    <p className="text-center text-sm text-slate-400">Nothing here yet.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
