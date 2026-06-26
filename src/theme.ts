import type { TaskStatus, Decision, PersonId, ZoneId } from './types'

export const statusMeta: Record<TaskStatus, { label: string; dot: string; chip: string }> = {
  'not-started': { label: 'Not started', dot: 'bg-slate-300', chip: 'bg-slate-200 text-slate-700' },
  'in-progress': { label: 'In progress', dot: 'bg-amber-400', chip: 'bg-amber-100 text-amber-800' },
  done: { label: 'Done', dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-800' },
  blocked: { label: 'Blocked', dot: 'bg-rose-400', chip: 'bg-rose-100 text-rose-800' },
}

export const decisionMeta: Record<Decision, { label: string; chip: string }> = {
  undecided: { label: 'Undecided', chip: 'bg-slate-200 text-slate-600' },
  keep: { label: 'Keep', chip: 'bg-emerald-100 text-emerald-800' },
  move: { label: 'Move', chip: 'bg-sky-100 text-sky-800' },
  donate: { label: 'Donate', chip: 'bg-violet-100 text-violet-800' },
  trash: { label: 'Trash', chip: 'bg-rose-100 text-rose-800' },
}

/** Hex fills/strokes for SVG floor-plan blocks, keyed by zone (plus 'car'). */
export const zoneColors: Record<ZoneId | 'car', { fill: string; stroke: string }> = {
  'griffin-workshop': { fill: '#fcd34d', stroke: '#b45309' },
  'griffin-fitness': { fill: '#fdba74', stroke: '#c2410c' },
  'lj-clothing': { fill: '#c4b5fd', stroke: '#6d28d9' },
  'john-table': { fill: '#7dd3fc', stroke: '#0369a1' },
  'shared-storage': { fill: '#cbd5e1', stroke: '#475569' },
  'exit-zone': { fill: '#fda4af', stroke: '#be123c' },
  car: { fill: '#94a3b8', stroke: '#1e293b' },
}

/** Arcade neon color + label per decision. */
export const arcDecision: Record<Decision, { label: string; color: string }> = {
  undecided: { label: 'UNDECIDED', color: '#8a8aa6' },
  keep: { label: 'KEEP', color: '#2bd14a' },
  move: { label: 'MOVE', color: '#36e0e0' },
  donate: { label: 'DONATE', color: '#ff3ca6' },
  trash: { label: 'TRASH', color: '#ff5a5a' },
}

/** Arcade neon color per person (hex), for bars/dots/leaderboard. */
export const arcPerson: Record<PersonId, string> = {
  john: '#36e0e0',
  griffin: '#ffd23f',
  lj: '#ff3ca6',
}

export const personMeta: Record<
  PersonId,
  { bar: string; dot: string; soft: string; text: string; ring: string }
> = {
  john: { bar: 'bg-sky-500', dot: 'bg-sky-500', soft: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-300' },
  griffin: { bar: 'bg-amber-500', dot: 'bg-amber-500', soft: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-300' },
  lj: { bar: 'bg-violet-500', dot: 'bg-violet-500', soft: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-300' },
}
