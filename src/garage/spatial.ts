import { validSpatialItem } from '../crates/model'
import type { SpatialItem } from '../crates/model'
import { currentObjects } from './currentObjects'

export { validSpatialItem } from '../crates/model'

type Point = { x: number; y: number }
type ImageSize = { width: number; height: number }
type NewSpatialItem = Pick<SpatialItem, 'id' | 'name' | 'parentId' | 'photoId' | 'region'> & {
  crateId?: string | null
  z?: number
  dimensions?: { w: number; d: number; h: number }
  dimensionBasis?: SpatialItem['dimensionBasis']
  notes?: string
}

/**
 * Start an explicitly estimated box inside the selected photo-survey group's
 * drawing envelope. Its size is a manual starting point, not photo detection.
 * A caller may supply a chosen shelf height and separately entered dimensions.
 */
export function createSpatialItem(input: NewSpatialItem, now = Date.now()): SpatialItem {
  const parent = currentObjects.find(object => object.id === input.parentId)
  if (!parent) throw new Error('Choose a photographed layout group before adding an item.')
  const z = input.z ?? 0
  const dimensions = input.dimensions ?? {
    w: Math.min(0.55, parent.w),
    d: Math.min(0.4, parent.d),
    h: Math.min(0.35, parent.h - z),
  }
  const item: SpatialItem = {
    id: input.id.trim(), name: input.name.trim(), parentId: parent.id,
    crateId: input.crateId?.trim() || null, photoId: input.photoId,
    region: { ...input.region },
    x: parent.x + Math.max(0, (parent.w - dimensions.w) / 2),
    y: parent.y + Math.max(0, (parent.d - dimensions.d) / 2),
    z, ...dimensions,
    // Untouched default dimensions must never be presented as measurements.
    dimensionBasis: input.dimensions ? input.dimensionBasis ?? 'estimated' : 'estimated',
    notes: input.notes?.trim() ?? '', createdAt: now,
  }
  if (!validSpatialItem(item)) throw new Error('Check the item name, photo selection and dimensions; the box must fit inside the garage bounds.')
  return item
}

/** Outer rectangular bounding-box volume. This is never occupied contents volume. */
export function boxVolumeLiters(box: Pick<SpatialItem, 'w' | 'd' | 'h'>): number {
  if (![box.w, box.d, box.h].every(value => Number.isFinite(value) && value > 0)) return 0
  const volume = box.w * box.d * box.h * 1000
  return Number.isFinite(volume) ? volume : 0
}

/**
 * Drag points are pixels relative to the displayed image content, excluding any
 * letterbox margins. Either drag direction works; outside points clamp to edges.
 * Zero-area selections and invalid image sizes produce no annotation.
 */
export function normalizedRegionFromDrag(start: Point, end: Point, image: ImageSize): SpatialItem['region'] | null {
  if (![start.x, start.y, end.x, end.y, image.width, image.height].every(Number.isFinite)
    || image.width <= 0 || image.height <= 0) return null
  const clamp = (value: number, size: number) => Math.min(size, Math.max(0, value)) / size
  const x = clamp(Math.min(start.x, end.x), image.width)
  const y = clamp(Math.min(start.y, end.y), image.height)
  const right = clamp(Math.max(start.x, end.x), image.width)
  const bottom = clamp(Math.max(start.y, end.y), image.height)
  const w = Math.min(right - x, 1 - x)
  const h = Math.min(bottom - y, 1 - y)
  return w > 0 && h > 0 ? { x, y, w, h } : null
}
