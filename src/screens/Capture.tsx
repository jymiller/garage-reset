import { useState } from 'react'
import type { ReactNode } from 'react'
import type { PersonId, ZoneId, Decision } from '../types'
import { useStore } from '../store'
import { people, zones, personName } from '../data'
import { arcDecision, arcPerson } from '../theme'
import { TrashIcon } from '../components/icons'

const decisions: Decision[] = ['keep', 'move', 'donate', 'trash', 'undecided']

export function Capture() {
  const { items, addItem, setItemDecision, deleteItem } = useStore()
  const [name, setName] = useState('')
  const [owner, setOwner] = useState<PersonId | null>(null)
  const [zone, setZone] = useState<ZoneId | null>(null)
  const [decision, setDecision] = useState<Decision>('undecided')

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    addItem({ name: trimmed, owner, zone, decision })
    setName('')
    setDecision('undecided')
  }

  const cycleDecision = (id: string, current: Decision) => {
    const order: Decision[] = ['undecided', 'keep', 'move', 'donate', 'trash']
    setItemDecision(id, order[(order.indexOf(current) + 1) % order.length])
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-pixel text-sm text-[#2bd14a]">ADD LOOT</h1>
        <p className="arc-vt mt-1 text-[#8a8aa6]">ONE ITEM. DECIDE ITS FATE.</p>
      </header>

      <div className="arc-panel space-y-4 p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="WHAT IS IT?"
          className="arc-input w-full px-3 py-2.5"
        />

        <Field label="OWNER">
          <Chip on={owner === null} onClick={() => setOwner(null)} color="#8a8aa6">
            NONE
          </Chip>
          {people.map((p) => (
            <Chip key={p.id} on={owner === p.id} onClick={() => setOwner(p.id)} color={arcPerson[p.id]}>
              {p.name.toUpperCase()}
            </Chip>
          ))}
        </Field>

        <Field label="ZONE">
          {zones.map((z) => (
            <Chip key={z.id} on={zone === z.id} onClick={() => setZone(zone === z.id ? null : z.id)} color="#36e0e0">
              {z.name.toUpperCase()}
            </Chip>
          ))}
        </Field>

        <Field label="FATE">
          {decisions.map((d) => (
            <Chip key={d} on={decision === d} onClick={() => setDecision(d)} color={arcDecision[d].color}>
              {arcDecision[d].label}
            </Chip>
          ))}
        </Field>

        <button onClick={submit} disabled={!name.trim()} className="arc-btn w-full py-3.5 text-sm">
          + ADD LOOT
        </button>
      </div>

      {items.length > 0 && (
        <section>
          <h2 className="font-pixel mb-2 text-[10px] text-[#ff3ca6]">INVENTORY ({items.length})</h2>
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="arc-panel flex items-center gap-2 px-3 py-2.5">
                {i.owner && <span className="h-2.5 w-2.5 shrink-0" style={{ background: arcPerson[i.owner] }} />}
                <div className="min-w-0 flex-1">
                  <p className="arc-vt truncate text-[#e8e8f5]">{i.name}</p>
                  <p className="arc-vt truncate text-[#6a6a82]">
                    {i.owner ? personName(i.owner).toUpperCase() : 'UNASSIGNED'}
                    {i.zone ? ` · ${zones.find((z) => z.id === i.zone)?.name.toUpperCase()}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => cycleDecision(i.id, i.decision)}
                  className="font-pixel px-1.5 py-1 text-[7px] text-[#07070e]"
                  style={{ background: arcDecision[i.decision].color }}
                >
                  {arcDecision[i.decision].label}
                </button>
                <button onClick={() => deleteItem(i.id)} aria-label="Delete item" className="p-1 text-[#5a5a70] transition hover:text-[#ff5a5a]">
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-pixel mb-2 text-[8px] text-[#8a8aa6]">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  on,
  onClick,
  color,
  children,
}: {
  on: boolean
  onClick: () => void
  color: string
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="font-pixel border-2 px-2 py-1.5 text-[7px] transition"
      style={{
        borderColor: color,
        background: on ? color : 'transparent',
        color: on ? '#07070e' : color,
      }}
    >
      {children}
    </button>
  )
}
