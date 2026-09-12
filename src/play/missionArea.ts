import type { Crate, SpatialItem } from '../crates/model'
import { currentObjects } from '../garage/currentObjects'
import type { LayoutObject } from '../garage/currentObjects'

export type MissionAreaSuggestion = {
  kind: 'floor' | 'shelf' | 'crate'
  area: string
  crateId: string | null
}

type AreaObject = Pick<LayoutObject, 'id' | 'kind' | 'label'>
type AreaItem = Pick<SpatialItem, 'parentId' | 'name' | 'crateId'>
type AreaCrate = Pick<Crate, 'id' | 'code' | 'location'>

const viewOnlyKinds = new Set<LayoutObject['kind']>(['vehicle', 'bike', 'heater', 'bag'])
const storageKinds = new Set<LayoutObject['kind']>(['rack', 'cabinet', 'table', 'wardrobe', 'bins', 'loose'])
const label = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
const crateCode = (value: unknown) => typeof value === 'string' ? value.trim() : ''

function boundedArea(parts: string[]): string {
  const text = parts.filter(Boolean).join(' · ')
  if (text.length <= 160) return text
  let shortened = text.slice(0, 159)
  // Do not cut an emoji or another supplementary Unicode character in half.
  if (/[\ud800-\udbff]$/u.test(shortened)) shortened = shortened.slice(0, -1)
  return `${shortened.trimEnd()}…`
}

/**
 * Suggest setup fields from an explicitly selected, photographed map object.
 * Coordinates and dimensions never determine a mission, clearance or reward.
 * The caller applies this suggestion only after the user chooses “Use this area”.
 */
export function missionAreaForObject(
  object: AreaObject | null | undefined,
  spatialItem?: AreaItem | null,
  crates: readonly AreaCrate[] = [],
): MissionAreaSuggestion | null {
  if (!object) return null
  const reference = currentObjects.find(candidate => candidate.id === object.id)
  if (!reference || reference.kind !== object.kind || reference.photoIds.length === 0
    || viewOnlyKinds.has(reference.kind) || reference.id === 'utility-cabinet-reference'
    || !storageKinds.has(reference.kind)) return null
  const parentLabel = label(object.label)
  if (!parentLabel) return null

  if (spatialItem) {
    if (spatialItem.parentId !== reference.id || !label(spatialItem.name)) return null
    if (spatialItem.crateId !== null) {
      // A deleted or ambiguous linked record is not silently treated as a new crate.
      const matches = crates.filter(crate => crate.id === spatialItem.crateId)
      if (matches.length !== 1) return null
      const crate = matches[0]
      const code = crateCode(crate.code)
      if (!code || code.length > 32 || !crate.id || typeof crate.location !== 'string'
        || crates.filter(candidate => crateCode(candidate.code).toLowerCase() === code.toLowerCase()).length !== 1) return null
      return { kind: 'crate', area: boundedArea([code, label(crate.location) || parentLabel]), crateId: crate.id }
    }
  }

  // An unlinked photo annotation can be any item, so it does not establish a crate.
  if (reference.kind === 'rack') {
    return { kind: 'shelf', area: boundedArea([parentLabel, spatialItem ? label(spatialItem.name) : 'one shelf']), crateId: null }
  }
  return {
    kind: 'floor',
    area: boundedArea([`Area by ${spatialItem ? label(spatialItem.name) : parentLabel}`, spatialItem ? parentLabel : '']),
    crateId: null,
  }
}
