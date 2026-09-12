import { validateRewardBook } from '../rewards/contract.mjs'
import type { RewardBook } from '../rewards/contract.mjs'

export type Crate = {
  id: string
  code: string
  name: string
  location: string
  owner: string
  capacityLiters: number
  baselineFill: number
  currentFill: number
  status: 'unopened' | 'sorting' | 'repacked'
  photo: string | null
  notes: string
  createdAt: number
}

export type ContentItem = {
  id: string
  crateId: string
  name: string
  quantity: number
  decision: 'undecided' | 'keep' | 'donate' | 'sell' | 'recycle' | 'trash'
  destination: string
  departed: boolean
  notes: string
}

export type CleanupMission = {
  id: string
  title: string
  area: string
  kind: 'floor' | 'shelf' | 'crate'
  crateId: string | null
  phase: 'before' | 'active' | 'review' | 'complete'
  beforePhoto: string | null
  afterPhoto: string | null
  plannedMinutes: 5 | 10 | 15
  elapsedSeconds: number
  runningSince: number | null
  createdAt: number
  completedAt: number | null
  kept: number
  bagged: number
  donated: number
  ask: number
  summary: string
  parkingClear: boolean
}

export type SpatialItem = {
  id: string
  name: string
  parentId: string
  crateId: string | null
  photoId: string
  region: { x: number; y: number; w: number; h: number }
  /** Metres: x front to rear, y from the rack wall, z above the floor. */
  x: number
  y: number
  z: number
  w: number
  d: number
  h: number
  dimensionBasis: 'estimated' | 'measured'
  notes: string
  createdAt: number
}

export type ObservationMeasurement = {
  value: number
  unit: 'cm' | 'm' | 'in' | 'ft'
  label: string
  basis: 'user-measured'
}

/** A quick photo and optional human measurement, independent of inventory or missions. */
export type Observation = {
  id: string
  kind: 'crate' | 'parking' | 'measurement' | 'placement'
  photo: string
  notes: string
  location: string
  crateId: string | null
  measurement: ObservationMeasurement | null
  createdAt: number
  /** Printed label identity; does not register a volume-tracked crate. */
  labelCode?: string
  photoRole?: 'outside' | 'contents'
  helperId?: string | null
}

/** Human-reviewed photo XP; does not create cleanup cash or a mission award. */
export type PhotoAward = {
  observationId: string
  helperId: string
  points: 25
  reviewedAt: number
}

/** One confirmed activity earns 25 XP; these receipts never create cash. */
export type ActivityCredit = {
  id: string
  helperId: string
  points: 25
  createdAt: number
  labelCode: string
} & ({
  kind: 'sticker'
  surface: 'front' | 'lid'
} | {
  kind: 'inventory'
  /** Historical receipt: items may subsequently move to a different crate. */
  itemIds: string[]
})

export type Workspace = {
  schemaVersion: 1
  crates: Crate[]
  items: ContentItem[]
  baselineLocked: boolean
  notes: string
  missions?: CleanupMission[]
  spatialItems?: SpatialItem[]
  rewards?: RewardBook
  observations?: Observation[]
  photoAwards?: PhotoAward[]
  activityCredits?: ActivityCredit[]
}

// Fixed photo-survey groups are reference geometry, not shared inventory records.
export const SPATIAL_PARENT_IDS: readonly string[] = [
  'suv-latest', 'rack-front-black-cabinet', 'rack-r1', 'rack-r2', 'rack-r3', 'rack-r4',
  'rack-front-jacks', 'rack-floor-cords', 'folded-tables', 'rear-tool-chest', 'rear-oak-cupboard',
  'cupboard-floor-group', 'rear-cart', 'rear-window-cabinets', 'rear-upright-tools', 'wall-panel-block',
  'side-bins-reference', 'rug-frame-reference', 'water-heater-reference', 'utility-cabinet-reference',
  'bicycle-reference', 'fabric-wardrobe-reference', 'white-bench-reference',
  'rear-stacked-storage-reference', 'rear-oak-worktop-reference', 'yellow-sack-morning-reference',
]
export const SPATIAL_PHOTO_IDS: readonly string[] = [
  'IMG_1908', 'IMG_1909', 'IMG_1910', 'IMG_1911', 'IMG_1912', 'IMG_1913', 'IMG_1914',
  'IMG_1915', 'IMG_1916', 'IMG_1917', 'IMG_1918', 'IMG_1927', 'IMG_1928', 'IMG_1929',
  'IMG_1930', 'IMG_1931', 'IMG_1932',
]

const CRATE_STATUSES = new Set<Crate['status']>(['unopened', 'sorting', 'repacked'])
const DECISIONS = new Set<ContentItem['decision']>(['undecided', 'keep', 'donate', 'sell', 'recycle', 'trash'])
const OUTGOING_DECISIONS = new Set<ContentItem['decision']>(['donate', 'sell', 'recycle', 'trash'])
const PHOTO_PATH = /^\/api\/photos\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.(jpg|png|webp)$/
const MISSION_KINDS = new Set<CleanupMission['kind']>(['floor', 'shelf', 'crate'])
const MISSION_PHASES = new Set<CleanupMission['phase']>(['before', 'active', 'review', 'complete'])

export function emptyWorkspace(): Workspace {
  return { schemaVersion: 1, crates: [], items: [], baselineLocked: false, notes: '' }
}

function record(raw: unknown): Record<string, unknown> | null {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : null
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], optionalKeys: readonly string[] = []): boolean {
  return keys.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => keys.includes(key) || optionalKeys.includes(key))
}

function finiteBetween(raw: unknown, min: number, max: number): raw is number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= min && raw <= max
}

function capacity(raw: unknown): raw is number {
  return finiteBetween(raw, 0, 2000) && raw > 0
}

function quantity(raw: unknown): raw is number {
  return finiteBetween(raw, 1, 100000) && Number.isInteger(raw)
}

function textIsValid(raw: unknown, max: number, required = false): raw is string {
  return typeof raw === 'string' && raw === raw.trim() && raw.length <= max && (!required || raw.length > 0)
}

function text(raw: unknown, max: number): string {
  return typeof raw === 'string' ? raw.trim().slice(0, max).trim() : ''
}

function isPhoto(raw: unknown): raw is string | null {
  return raw === null || typeof raw === 'string' && PHOTO_PATH.test(raw)
}

function isCrate(raw: unknown): raw is Crate {
  const value = record(raw)
  return value !== null
    && textIsValid(value.id, 120, true)
    && textIsValid(value.code, 32, true)
    && textIsValid(value.name, 160, true)
    && textIsValid(value.location, 160)
    && textIsValid(value.owner, 80)
    && capacity(value.capacityLiters)
    && finiteBetween(value.baselineFill, 0, 100)
    && finiteBetween(value.currentFill, 0, 100)
    && CRATE_STATUSES.has(value.status as Crate['status'])
    && isPhoto(value.photo)
    && textIsValid(value.notes, 4000)
    && finiteBetween(value.createdAt, 0, 8.64e15)
}

function isItem(raw: unknown): raw is ContentItem {
  const value = record(raw)
  return value !== null
    && textIsValid(value.id, 120, true)
    && textIsValid(value.crateId, 120, true)
    && textIsValid(value.name, 160, true)
    && quantity(value.quantity)
    && DECISIONS.has(value.decision as ContentItem['decision'])
    && textIsValid(value.destination, 240)
    && typeof value.departed === 'boolean'
    && textIsValid(value.notes, 4000)
}

/** A mission records a human-confirmed session, never a measured volume change. */
export function validateCleanupMission(raw: unknown): raw is CleanupMission {
  const value = record(raw)
  if (!value || !textIsValid(value.id, 120, true) || !textIsValid(value.title, 160, true)
    || !textIsValid(value.area, 160, true) || !MISSION_KINDS.has(value.kind as CleanupMission['kind'])
    || !(value.crateId === null || textIsValid(value.crateId, 120, true))
    || !MISSION_PHASES.has(value.phase as CleanupMission['phase'])
    || !isPhoto(value.beforePhoto) || !isPhoto(value.afterPhoto)
    || ![5, 10, 15].includes(value.plannedMinutes as number)
    || !finiteBetween(value.elapsedSeconds, 0, 31536000) || !Number.isInteger(value.elapsedSeconds)
    || !finiteBetween(value.createdAt, 0, 8.64e15)
    || !(value.runningSince === null || finiteBetween(value.runningSince, value.createdAt, 8.64e15))
    || !(value.completedAt === null || finiteBetween(value.completedAt, value.createdAt, 8.64e15))
    || !['kept', 'bagged', 'donated', 'ask'].every(key => finiteBetween(value[key], 0, 100000) && Number.isInteger(value[key]))
    || !textIsValid(value.summary, 4000) || typeof value.parkingClear !== 'boolean') return false

  if (value.phase !== 'before' && value.beforePhoto === null) return false
  if (value.phase === 'before' && value.elapsedSeconds !== 0) return false
  if (value.phase !== 'active' && value.runningSince !== null) return false
  if (value.phase !== 'complete' && value.completedAt !== null) return false
  if (value.phase === 'complete' && (value.afterPhoto === null || value.summary.length === 0
    || !value.parkingClear || value.completedAt === null)) return false
  return true
}

/** Validate one photograph-to-layout annotation; workspace links are checked separately. */
export function validSpatialItem(raw: unknown): raw is SpatialItem {
  const value = record(raw)
  if (!value || !exactKeys(value, ['id', 'name', 'parentId', 'crateId', 'photoId', 'region', 'x', 'y', 'z', 'w', 'd', 'h', 'dimensionBasis', 'notes', 'createdAt'])
    || !textIsValid(value.id, 120, true) || SPATIAL_PARENT_IDS.includes(value.id)
    || !textIsValid(value.name, 160, true) || !textIsValid(value.parentId, 120, true)
    || !SPATIAL_PARENT_IDS.includes(value.parentId)
    || !(value.crateId === null || textIsValid(value.crateId, 120, true))
    || !textIsValid(value.photoId, 120, true) || !SPATIAL_PHOTO_IDS.includes(value.photoId)
    || !textIsValid(value.notes, 4000) || !finiteBetween(value.createdAt, 0, 8.64e15)
    || !['estimated', 'measured'].includes(value.dimensionBasis as string)) return false
  const region = record(value.region)
  if (!region || !exactKeys(region, ['x', 'y', 'w', 'h'])
    || !finiteBetween(region.x, 0, 1) || !finiteBetween(region.y, 0, 1)
    || !finiteBetween(region.w, 0, 1) || region.w <= 0
    || !finiteBetween(region.h, 0, 1) || region.h <= 0
    || region.x + region.w > 1 || region.y + region.h > 1) return false
  return finiteBetween(value.x, 0, 25.21) && finiteBetween(value.y, 0, 7.38)
    && finiteBetween(value.z, 0, 3.2) && finiteBetween(value.w, 0.01, 25.21)
    && finiteBetween(value.d, 0.01, 7.38) && finiteBetween(value.h, 0.01, 3.2)
    && value.x + value.w <= 25.21 && value.y + value.d <= 7.38 && value.z + value.h <= 3.2
}

/** Photos do not establish dimensions or whether either car fits. */
export function validateObservation(raw: unknown): raw is Observation {
  const value = record(raw)
  if (!value || !exactKeys(value, ['id', 'kind', 'photo', 'notes', 'location', 'crateId', 'measurement', 'createdAt'], ['labelCode', 'photoRole', 'helperId'])
    || !textIsValid(value.id, 120, true) || !['crate', 'parking', 'measurement', 'placement'].includes(value.kind as string)
    || typeof value.photo !== 'string' || !PHOTO_PATH.test(value.photo)
    || !textIsValid(value.notes, 4000) || !textIsValid(value.location, 160)
    || !(value.crateId === null || textIsValid(value.crateId, 120, true))
    || !finiteBetween(value.createdAt, 0, 8.64e15)
    || Object.hasOwn(value, 'labelCode') && !(typeof value.labelCode === 'string' && /^C-(?!000)[0-9]{3}$/.test(value.labelCode))
    || Object.hasOwn(value, 'photoRole') && !['outside', 'contents'].includes(value.photoRole as string)
    || Object.hasOwn(value, 'helperId') && !(value.helperId === null || textIsValid(value.helperId, 120, true))) return false
  if (value.measurement === null) return true
  const measurement = record(value.measurement)
  return measurement !== null && exactKeys(measurement, ['value', 'unit', 'label', 'basis'])
    && finiteBetween(measurement.value, 0, 1e6) && measurement.value > 0
    && ['cm', 'm', 'in', 'ft'].includes(measurement.unit as string)
    && textIsValid(measurement.label, 160, true) && measurement.basis === 'user-measured'
}

export function validatePhotoAward(raw: unknown): raw is PhotoAward {
  const value = record(raw)
  return value !== null && exactKeys(value, ['observationId', 'helperId', 'points', 'reviewedAt'])
    && textIsValid(value.observationId, 120, true) && textIsValid(value.helperId, 120, true)
    && value.points === 25 && finiteBetween(value.reviewedAt, 0, 8.64e15)
}

export function validateActivityCredit(raw: unknown): raw is ActivityCredit {
  const value = record(raw)
  if (!value || !textIsValid(value.id, 120, true) || !textIsValid(value.helperId, 120, true)
    || value.points !== 25 || !finiteBetween(value.createdAt, 0, 8.64e15)
    || !textIsValid(value.labelCode, 32, true)) return false
  const common = ['id', 'kind', 'helperId', 'points', 'createdAt', 'labelCode']
  if (value.kind === 'sticker') {
    return exactKeys(value, [...common, 'surface']) && /^C-(?!000)[0-9]{3}$/.test(value.labelCode)
      && ['front', 'lid'].includes(value.surface as string)
      && value.id === `sticker:${value.labelCode}:${value.surface}`
  }
  return value.kind === 'inventory' && exactKeys(value, [...common, 'itemIds'])
    && Array.isArray(value.itemIds) && value.itemIds.length >= 1 && value.itemIds.length <= 100
    && value.itemIds.every(id => textIsValid(id, 120, true))
    && new Set(value.itemIds).size === value.itemIds.length
}

/** Validate imports and server snapshots before replacing the current workspace. */
export function validateWorkspace(raw: unknown): boolean {
  const value = record(raw)
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.crates) || !Array.isArray(value.items)
    || typeof value.baselineLocked !== 'boolean' || !textIsValid(value.notes, 4000)) return false

  const crateIds = new Set<string>()
  const crateCodes = new Set<string>()
  for (const crate of value.crates) {
    if (!isCrate(crate) || crateIds.has(crate.id) || crateCodes.has(crate.code.toLowerCase())) return false
    crateIds.add(crate.id)
    crateCodes.add(crate.code.toLowerCase())
  }
  const itemIds = new Set<string>()
  for (const item of value.items) {
    if (!isItem(item) || itemIds.has(item.id) || !crateIds.has(item.crateId)) return false
    itemIds.add(item.id)
  }
  const missionIds = new Set<string>()
  if ('missions' in value) {
    if (!Array.isArray(value.missions)) return false
    for (const mission of value.missions) {
      if (!validateCleanupMission(mission) || missionIds.has(mission.id)
        || mission.crateId !== null && !crateIds.has(mission.crateId)) return false
      missionIds.add(mission.id)
    }
  }
  if ('spatialItems' in value) {
    if (!Array.isArray(value.spatialItems)) return false
    const spatialIds = new Set<string>()
    const linkedCrates = new Set<string>()
    for (const item of value.spatialItems) {
      if (!validSpatialItem(item) || spatialIds.has(item.id) || crateIds.has(item.id)
        || itemIds.has(item.id) || missionIds.has(item.id)
        || item.crateId !== null && (!crateIds.has(item.crateId) || linkedCrates.has(item.crateId))) return false
      spatialIds.add(item.id)
      if (item.crateId !== null) linkedCrates.add(item.crateId)
    }
  }
  if ('rewards' in value && !validateRewardBook(value.rewards, Array.isArray(value.missions) ? value.missions : [])) return false
  if ('observations' in value) {
    if (!Array.isArray(value.observations)) return false
    const observationIds = new Set<string>()
    const helperIds = new Set((value.rewards as RewardBook | undefined)?.players.map(player => player.id) ?? [])
    for (const observation of value.observations) {
      if (!validateObservation(observation) || observationIds.has(observation.id)
        || observation.crateId !== null && !crateIds.has(observation.crateId)
        || observation.helperId != null && !helperIds.has(observation.helperId)) return false
      observationIds.add(observation.id)
    }
  }
  if ('photoAwards' in value) {
    if (!Array.isArray(value.photoAwards)) return false
    const observations = new Map(((value.observations ?? []) as Observation[]).map(photo => [photo.id, photo]))
    const helperIds = new Set((value.rewards as RewardBook | undefined)?.players.map(player => player.id) ?? [])
    const awarded = new Set<string>()
    for (const award of value.photoAwards) {
      if (!validatePhotoAward(award) || awarded.has(award.observationId) || !helperIds.has(award.helperId)) return false
      const observation = observations.get(award.observationId)
      if (!observation || award.reviewedAt < observation.createdAt) return false
      awarded.add(award.observationId)
    }
  }
  if ('activityCredits' in value) {
    if (!Array.isArray(value.activityCredits)) return false
    const helperIds = new Set((value.rewards as RewardBook | undefined)?.players.map(player => player.id) ?? [])
    const creditIds = new Set<string>()
    const creditedItems = new Set<string>()
    for (const credit of value.activityCredits) {
      if (!validateActivityCredit(credit) || creditIds.has(credit.id) || !helperIds.has(credit.helperId)) return false
      if (credit.kind === 'inventory') {
        for (const id of credit.itemIds) {
          if (!itemIds.has(id) || creditedItems.has(id)) return false
          creditedItems.add(id)
        }
      }
      creditIds.add(credit.id)
    }
  }
  return true
}

/**
 * Recover recognizable local data without creating crates or contents. Imports
 * should pass validateWorkspace first, so damaged records cannot disappear silently.
 */
export function sanitizeWorkspace(raw: unknown): Workspace {
  const value = record(raw)
  if (!value || value.schemaVersion !== 1) return emptyWorkspace()

  const crates: Crate[] = []
  const crateIds = new Set<string>()
  const crateCodes = new Set<string>()
  for (const entry of Array.isArray(value.crates) ? value.crates : []) {
    const candidate = record(entry)
    if (!candidate || !capacity(candidate.capacityLiters) || !finiteBetween(candidate.baselineFill, 0, 100)) continue
    const id = text(candidate.id, 120)
    const code = text(candidate.code, 32)
    const name = text(candidate.name, 160)
    if (!id || !code || !name || crateIds.has(id) || crateCodes.has(code.toLowerCase())) continue
    crates.push({
      id,
      code,
      name,
      location: text(candidate.location, 160),
      owner: text(candidate.owner, 80),
      capacityLiters: candidate.capacityLiters,
      baselineFill: candidate.baselineFill,
      // Damaged measurements never manufacture freed volume.
      currentFill: finiteBetween(candidate.currentFill, 0, 100) ? candidate.currentFill : candidate.baselineFill,
      status: CRATE_STATUSES.has(candidate.status as Crate['status']) ? candidate.status as Crate['status'] : 'unopened',
      photo: isPhoto(candidate.photo) ? candidate.photo : null,
      notes: text(candidate.notes, 4000),
      createdAt: finiteBetween(candidate.createdAt, 0, 8.64e15) ? candidate.createdAt : 0,
    })
    crateIds.add(id)
    crateCodes.add(code.toLowerCase())
  }

  const items: ContentItem[] = []
  const itemIds = new Set<string>()
  for (const entry of Array.isArray(value.items) ? value.items : []) {
    const candidate = record(entry)
    if (!candidate || !quantity(candidate.quantity)) continue
    const id = text(candidate.id, 120)
    const crateId = text(candidate.crateId, 120)
    const name = text(candidate.name, 160)
    if (!id || !name || !crateIds.has(crateId) || itemIds.has(id)) continue
    items.push({
      id,
      crateId,
      name,
      quantity: candidate.quantity,
      decision: DECISIONS.has(candidate.decision as ContentItem['decision']) ? candidate.decision as ContentItem['decision'] : 'undecided',
      destination: text(candidate.destination, 240),
      departed: candidate.departed === true,
      notes: text(candidate.notes, 4000),
    })
    itemIds.add(id)
  }

  const result: Workspace = {
    schemaVersion: 1,
    crates,
    items,
    baselineLocked: value.baselineLocked === true,
    notes: text(value.notes, 4000),
  }
  // Keep legacy snapshots byte-for-byte compatible at the schema level: do not
  // invent an optional mission collection when the stored data has none.
  if ('missions' in value) {
    result.missions = []
    const missionIds = new Set<string>()
    for (const entry of Array.isArray(value.missions) ? value.missions : []) {
      const candidate = record(entry)
      if (!candidate) continue
      const id = text(candidate.id, 120)
      const title = text(candidate.title, 160)
      const area = text(candidate.area, 160)
      const crateId = candidate.crateId === null ? null : text(candidate.crateId, 120) || null
      if (!id || !title || !area || missionIds.has(id) || crateId !== null && !crateIds.has(crateId)) continue
      const createdAt = finiteBetween(candidate.createdAt, 0, 8.64e15) ? candidate.createdAt : 0
      const beforePhoto = isPhoto(candidate.beforePhoto) ? candidate.beforePhoto : null
      let phase: CleanupMission['phase'] = MISSION_PHASES.has(candidate.phase as CleanupMission['phase'])
        ? candidate.phase as CleanupMission['phase'] : 'before'
      if (beforePhoto === null) phase = 'before'
      // Do not turn malformed completion records into earned rounds by supplying
      // missing proof or silently repairing fields. They return to human review.
      if (phase === 'complete' && !validateCleanupMission(candidate)) phase = beforePhoto ? 'review' : 'before'
      const count = (key: 'kept' | 'bagged' | 'donated' | 'ask') => finiteBetween(candidate[key], 0, 100000) && Number.isInteger(candidate[key]) ? candidate[key] as number : 0
      const mission: CleanupMission = {
        id, title, area, crateId,
        kind: MISSION_KINDS.has(candidate.kind as CleanupMission['kind']) ? candidate.kind as CleanupMission['kind'] : 'floor',
        phase,
        beforePhoto,
        afterPhoto: isPhoto(candidate.afterPhoto) ? candidate.afterPhoto : null,
        plannedMinutes: [5, 10, 15].includes(candidate.plannedMinutes as number) ? candidate.plannedMinutes as 5 | 10 | 15 : 10,
        elapsedSeconds: phase !== 'before' && finiteBetween(candidate.elapsedSeconds, 0, 31536000) && Number.isInteger(candidate.elapsedSeconds) ? candidate.elapsedSeconds : 0,
        runningSince: phase === 'active' && finiteBetween(candidate.runningSince, createdAt, 8.64e15) ? candidate.runningSince : null,
        createdAt,
        completedAt: phase === 'complete' && finiteBetween(candidate.completedAt, createdAt, 8.64e15) ? candidate.completedAt : null,
        kept: count('kept'), bagged: count('bagged'), donated: count('donated'), ask: count('ask'),
        summary: text(candidate.summary, 4000),
        parkingClear: candidate.parkingClear === true,
      }
      if (!validateCleanupMission(mission)) continue
      result.missions.push(mission)
      missionIds.add(id)
    }
  }
  if ('spatialItems' in value) {
    result.spatialItems = []
    const occupiedIds = new Set([...crateIds, ...itemIds, ...(result.missions ?? []).map(mission => mission.id)])
    const linkedCrates = new Set<string>()
    for (const item of Array.isArray(value.spatialItems) ? value.spatialItems : []) {
      // Never invent or clamp dimensions while recovering stored annotations.
      // A damaged record must be reviewed again instead of acquiring measurements.
      if (!validSpatialItem(item) || occupiedIds.has(item.id)
        || item.crateId !== null && (!crateIds.has(item.crateId) || linkedCrates.has(item.crateId))) continue
      result.spatialItems.push({
        id: item.id, name: item.name, parentId: item.parentId, crateId: item.crateId,
        photoId: item.photoId, region: { x: item.region.x, y: item.region.y, w: item.region.w, h: item.region.h },
        x: item.x, y: item.y, z: item.z, w: item.w, d: item.d, h: item.h,
        dimensionBasis: item.dimensionBasis, notes: item.notes, createdAt: item.createdAt,
      })
      occupiedIds.add(item.id)
      if (item.crateId !== null) linkedCrates.add(item.crateId)
    }
  }
  if ('rewards' in value && validateRewardBook(value.rewards, result.missions ?? [])) result.rewards = structuredClone(value.rewards)
  if ('observations' in value) {
    result.observations = []
    const observationIds = new Set<string>()
    const helperIds = new Set(result.rewards?.players.map(player => player.id) ?? [])
    for (const observation of Array.isArray(value.observations) ? value.observations : []) {
      // Preserve valid records exactly; never invent a photo, measurement or link.
      if (!validateObservation(observation) || observationIds.has(observation.id)
        || observation.crateId !== null && !crateIds.has(observation.crateId)
        || observation.helperId != null && !helperIds.has(observation.helperId)) continue
      result.observations.push(structuredClone(observation))
      observationIds.add(observation.id)
    }
  }
  if ('photoAwards' in value) {
    result.photoAwards = []
    const observations = new Map((result.observations ?? []).map(photo => [photo.id, photo]))
    const helperIds = new Set(result.rewards?.players.map(player => player.id) ?? [])
    const awarded = new Set<string>()
    for (const award of Array.isArray(value.photoAwards) ? value.photoAwards : []) {
      // Never manufacture a review or change its credited helper while recovering.
      if (!validatePhotoAward(award) || awarded.has(award.observationId) || !helperIds.has(award.helperId)) continue
      const observation = observations.get(award.observationId)
      if (!observation || award.reviewedAt < observation.createdAt) continue
      result.photoAwards.push({ ...award })
      awarded.add(award.observationId)
    }
  }
  if ('activityCredits' in value) {
    result.activityCredits = []
    const helperIds = new Set(result.rewards?.players.map(player => player.id) ?? [])
    const creditIds = new Set<string>()
    const creditedItems = new Set<string>()
    for (const credit of Array.isArray(value.activityCredits) ? value.activityCredits : []) {
      // Never repair an earned receipt or silently reassign its helper/items.
      if (!validateActivityCredit(credit) || creditIds.has(credit.id) || !helperIds.has(credit.helperId)
        || credit.kind === 'inventory' && credit.itemIds.some(id => !itemIds.has(id) || creditedItems.has(id))) continue
      result.activityCredits.push(structuredClone(credit))
      creditIds.add(credit.id)
      if (credit.kind === 'inventory') credit.itemIds.forEach(id => creditedItems.add(id))
    }
  }
  return result
}

/** Only confirmed repacking measurements change occupied-volume progress. */
export function volumeStats(workspace: Workspace) {
  let baselineLiters = 0
  let currentLiters = 0
  for (const crate of workspace.crates) {
    baselineLiters += crate.capacityLiters * crate.baselineFill / 100
    const measuredFill = crate.status === 'repacked' ? crate.currentFill : crate.baselineFill
    currentLiters += crate.capacityLiters * measuredFill / 100
  }
  const freedLiters = Math.max(0, baselineLiters - currentLiters)
  const targetLiters = baselineLiters / 2
  return {
    baselineLiters,
    currentLiters,
    freedLiters,
    freedPercent: baselineLiters > 0 ? freedLiters / baselineLiters * 100 : 0,
    targetLiters,
    remainingToTarget: Math.max(0, currentLiters - targetLiters),
    unopenedCount: workspace.crates.filter(crate => crate.status === 'unopened').length,
    undecidedCount: workspace.items.filter(item => item.decision === 'undecided').length,
    pendingDepartureCount: workspace.items.filter(item => OUTGOING_DECISIONS.has(item.decision) && !item.departed).length,
  }
}
