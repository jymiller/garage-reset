import { validateObservation, validateWorkspace } from '../crates/model'
import type { Observation, Workspace } from '../crates/model'

type Input = {
  id: string; kind: Observation['kind']; photo: string | null; location: string; notes: string; crateId: string | null;
  measurementEnabled: boolean; measurementLabel: string; measurementValue: string;
  measurementUnit: 'cm' | 'm' | 'in' | 'ft';
  labelCode?: string | null; photoRole?: 'outside' | 'contents' | null; helperId?: string | null;
}

export function buildObservation(input: Input, createdAt: number): { observation: Observation | null; error: string } {
  const fail = (error: string) => ({ observation: null, error })
  if (!input.photo) return fail('Choose a photo first.')
  let notes = input.notes.trim()
  let measurement: Observation['measurement'] = null
  const valueText = input.measurementValue.trim()
  const label = input.measurementLabel.trim()
  if (input.measurementEnabled && valueText) {
    const value = Number(valueText)
    if (!Number.isFinite(value) || value <= 0 || value > 1000000) return fail('Enter a positive measured number, up to 1,000,000, or leave the reading blank.')
    if (!label) return fail('Name both endpoints for this reading, or leave the reading blank for now.')
    measurement = { value, unit: input.measurementUnit, label, basis: 'user-measured' }
  } else if (input.measurementEnabled || input.kind === 'measurement') {
    const pending = label ? `Reading pending: ${label}` : 'Measurement reading pending.'
    notes = [notes, pending].filter(Boolean).join('\n')
  }
  if (notes.length > 4000) return fail('Shorten the notes to leave room for the pending measurement description.')
  const labelCode = input.labelCode?.trim().toUpperCase()
  if (labelCode && !/^C-(?!000)\d{3}$/.test(labelCode)) return fail('Use a printed label code such as C-001.')
  const observation: Observation = {
    id: input.id, kind: input.kind, photo: input.photo, location: input.location.trim(), notes,
    crateId: input.crateId || null, measurement, createdAt,
    ...(labelCode ? { labelCode } : {}),
    ...(input.photoRole ? { photoRole: input.photoRole } : {}),
    ...(input.helperId ? { helperId: input.helperId } : {}),
  }
  if (!validateObservation(observation)) return fail('Check the photo, location, notes, and measurement fields. Your draft is still here.')
  return { observation, error: '' }
}

/** Append exactly once without changing inventory, measurements, missions or rewards. */
export function appendObservation(workspace: Workspace, observation: Observation): Workspace {
  if ((workspace.observations ?? []).some(existing => existing.id === observation.id)) return workspace
  if (observation.labelCode && observation.crateId) {
    const linked = workspace.crates.find(crate => crate.id === observation.crateId)
    if (!linked || linked.code.trim().toUpperCase() !== observation.labelCode) return workspace
  }
  const next = { ...workspace, observations: [...(workspace.observations ?? []), observation] }
  return validateWorkspace(next) ? next : workspace
}
