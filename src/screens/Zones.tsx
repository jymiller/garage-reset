import { useState } from 'react'
import type { ZoneId } from '../types'
import { useStore } from '../store'
import { zones, personName } from '../data'
import { progress } from '../lib'
import { arcDecision, arcPerson } from '../theme'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCard } from '../components/TaskCard'
import { ChevronIcon } from '../components/icons'

export function Zones() {
  const { tasks, items } = useStore()
  const [open, setOpen] = useState<ZoneId | null>(null)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-pixel text-sm text-[#2bd14a]">ZONES</h1>
        <p className="arc-vt mt-1 text-[#8a8aa6]">SELECT A ZONE TO INSPECT.</p>
      </header>

      <div className="space-y-2.5">
        {zones.map((z) => {
          const zoneTasks = tasks.filter((t) => t.zone === z.id).sort((a, b) => a.order - b.order)
          const zoneItems = items.filter((i) => i.zone === z.id)
          const pr = progress(zoneTasks)
          const isOpen = open === z.id
          const cleared = pr.total > 0 && pr.done === pr.total

          return (
            <div className="arc-panel" key={z.id} style={cleared ? { borderColor: '#ffd23f' } : undefined}>
              <button onClick={() => setOpen(isOpen ? null : z.id)} className="flex w-full items-center gap-3 p-3 text-left">
                <div className="min-w-0 flex-1">
                  <p className="arc-vt text-lg text-[#e8e8f5]">
                    {z.name.toUpperCase()} {cleared && <span className="text-[#ffd23f]">★</span>}
                  </p>
                  <p className="arc-vt mt-0.5 text-[#8a8aa6]">
                    {pr.done}/{pr.total} QUESTS · {zoneItems.length} LOOT
                  </p>
                  {pr.total > 0 && <ProgressBar pct={pr.pct} className="mt-2" />}
                </div>
                <ChevronIcon className={`h-5 w-5 shrink-0 text-[#2bd14a] transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="space-y-3 border-t-2 border-[#1d1d2e] p-3">
                  {zoneTasks.length > 0 && (
                    <div className="space-y-2">
                      {zoneTasks.map((t) => (
                        <TaskCard key={t.id} task={t} showZone={false} />
                      ))}
                    </div>
                  )}

                  {zoneItems.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-pixel text-[8px] text-[#ff3ca6]">LOOT</p>
                      {zoneItems.map((i) => (
                        <div key={i.id} className="arc-panel arc-panel-dim flex items-center gap-2 px-3 py-2">
                          {i.owner && (
                            <span className="h-2.5 w-2.5 shrink-0" style={{ background: arcPerson[i.owner] }} />
                          )}
                          <span className="arc-vt min-w-0 flex-1 truncate text-[#e8e8f5]">{i.name}</span>
                          {i.owner && <span className="arc-vt text-[#8a8aa6]">{personName(i.owner).toUpperCase()}</span>}
                          <span
                            className="font-pixel px-1.5 py-1 text-[7px] text-[#07070e]"
                            style={{ background: arcDecision[i.decision].color }}
                          >
                            {arcDecision[i.decision].label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {zoneTasks.length === 0 && zoneItems.length === 0 && (
                    <p className="arc-vt text-center text-[#6a6a82]">EMPTY ZONE.</p>
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
