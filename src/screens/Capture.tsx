import { useState } from 'react'
import type { ReactNode } from 'react'
import type { PersonId, ZoneId, Decision } from '../types'
import { useStore } from '../store'
import { people, zones, personName } from '../data'
import { decisionMeta, personMeta } from '../theme'
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
    const next = order[(order.indexOf(current) + 1) % order.length]
    setItemDecision(id, next)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Capture an item</h1>
        <p className="text-sm text-slate-500">One thing at a time. Decide where it goes.</p>
      </header>

      <div className="space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="What is it?"
          className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-lg text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-300"
        />

        <Field label="Owner">
          <Chip on={owner === null} onClick={() => setOwner(null)}>
            Unassigned
          </Chip>
          {people.map((p) => (
            <Chip
              key={p.id}
              on={owner === p.id}
              onClick={() => setOwner(p.id)}
              activeClass={`${personMeta[p.id].soft} ${personMeta[p.id].text} ring-1 ${personMeta[p.id].ring}`}
            >
              {p.name}
            </Chip>
          ))}
        </Field>

        <Field label="Zone">
          {zones.map((z) => (
            <Chip key={z.id} on={zone === z.id} onClick={() => setZone(zone === z.id ? null : z.id)}>
              {z.name}
            </Chip>
          ))}
        </Field>

        <Field label="Decision">
          {decisions.map((d) => (
            <Chip
              key={d}
              on={decision === d}
              onClick={() => setDecision(d)}
              activeClass={`${decisionMeta[d].chip} ring-1 ring-slate-200`}
            >
              {decisionMeta[d].label}
            </Chip>
          ))}
        </Field>

        <button
          onClick={submit}
          disabled={!name.trim()}
          className="w-full rounded-2xl bg-emerald-500 py-4 text-lg font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400"
        >
          Add item
        </button>
      </div>

      {items.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Captured ({items.length})
          </h2>
          <div className="space-y-2">
            {items.map((i) => (
              <div
                key={i.id}
                className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100"
              >
                {i.owner && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${personMeta[i.owner].dot}`} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{i.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {i.owner ? personName(i.owner) : 'Unassigned'}
                    {i.zone ? ` · ${zones.find((z) => z.id === i.zone)?.name}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => cycleDecision(i.id, i.decision)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${decisionMeta[i.decision].chip}`}
                >
                  {decisionMeta[i.decision].label}
                </button>
                <button
                  onClick={() => deleteItem(i.id)}
                  aria-label="Delete item"
                  className="p-1 text-slate-300 transition hover:text-rose-500"
                >
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
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
  activeClass = 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
  activeClass?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        on ? activeClass : 'bg-slate-100 text-slate-500'
      }`}
    >
      {children}
    </button>
  )
}
