import { scanShell } from './scanGeometry'

export type Geometry = { x: number; y: number; w: number; d: number; h: number }
export type Correction = Geometry & { note: string }
export type Corrections = Record<string, Correction>

type Point = [number, number]
const EPSILON = 1e-8

function pointInFloor([x, y]: Point): boolean {
  let inside = false
  const outline = scanShell.outline
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [ax, ay] = outline[j], [bx, by] = outline[i]
    const dx = bx - ax, dy = by - ay
    const cross = (x - ax) * dy - (y - ay) * dx
    if (Math.abs(cross) <= EPSILON * Math.max(1, Math.hypot(dx, dy))
      && x >= Math.min(ax, bx) - EPSILON && x <= Math.max(ax, bx) + EPSILON
      && y >= Math.min(ay, by) - EPSILON && y <= Math.max(ay, by) + EPSILON) return true
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside
  }
  return inside
}

/** True when any positive span of this segment lies inside the open rectangle. */
function segmentEntersFootprint(a: Point, b: Point, rectangle: Geometry): boolean {
  let start = 0, end = 1
  const minimum = [rectangle.x, rectangle.y]
  const maximum = [rectangle.x + rectangle.w, rectangle.y + rectangle.d]
  for (let axis = 0; axis < 2; axis++) {
    const delta = b[axis] - a[axis]
    const low = minimum[axis] + EPSILON, high = maximum[axis] - EPSILON
    if (Math.abs(delta) <= EPSILON) {
      if (a[axis] <= low || a[axis] >= high) return false
      continue
    }
    const t1 = (low - a[axis]) / delta, t2 = (high - a[axis]) / delta
    start = Math.max(start, Math.min(t1, t2))
    end = Math.min(end, Math.max(t1, t2))
    if (start >= end) return false
  }
  return start < end
}

/**
 * Validate a local drawing correction against the scan's floor and wall bodies.
 * This does not establish measured fit, service clearance or vehicle access.
 */
export function validGeometry(value: unknown): value is Correction {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  if (!['x', 'y', 'w', 'd', 'h'].every(key => typeof candidate[key] === 'number' && Number.isFinite(candidate[key]))
    || typeof candidate.note !== 'string' || candidate.note.length > 1000) return false
  const rectangle = value as Correction
  if (rectangle.x < 0 || rectangle.y < 0 || rectangle.w < 0.05 || rectangle.d < 0.05
    || rectangle.h < 0.05 || rectangle.h > scanShell.height) return false
  return validFootprint(rectangle)
}

/** Spatial items may be smaller than a furniture footprint; physical wall/floor checks still apply. */
export function validFootprint(rectangle: Geometry): boolean {
  if (![rectangle.x, rectangle.y, rectangle.w, rectangle.d, rectangle.h].every(Number.isFinite)
    || rectangle.x < 0 || rectangle.y < 0 || rectangle.w <= 0 || rectangle.d <= 0 || rectangle.h <= 0) return false
  const right = rectangle.x + rectangle.w, bottom = rectangle.y + rectangle.d
  if (!Number.isFinite(right) || !Number.isFinite(bottom)) return false
  const corners: Point[] = [[rectangle.x, rectangle.y], [right, rectangle.y], [right, bottom], [rectangle.x, bottom]]
  if (!corners.every(pointInFloor)) return false

  // Four inside corners are insufficient for a concave room: a wall notch can
  // pass through the rectangle between those corners.
  const outline = scanShell.outline
  for (let i = 0; i < outline.length; i++) {
    if (segmentEntersFootprint(outline[i], outline[(i + 1) % outline.length], rectangle)) return false
  }
  // Wall centerlines alone miss objects intruding into the near half of a wall.
  // Include half the exported thickness on each side and at segment ends;
  // this also covers the short interior projection absent from the floor outline.
  const halfWall = scanShell.wallThickness / 2
  if (scanShell.walls.some(wall => {
    const left = Math.min(wall.a[0], wall.b[0]) - halfWall
    const top = Math.min(wall.a[1], wall.b[1]) - halfWall
    const wallRight = Math.max(wall.a[0], wall.b[0]) + halfWall
    const wallBottom = Math.max(wall.a[1], wall.b[1]) + halfWall
    return Math.min(right, wallRight) - Math.max(rectangle.x, left) > EPSILON
      && Math.min(bottom, wallBottom) - Math.max(rectangle.y, top) > EPSILON
  })) return false
  return true
}

/** Positive 2D overlap only; touching edges do not indicate a collision. */
export function footprintOverlaps(object: Geometry, others: Array<Geometry & { id: string; label: string }>, ignoreId: string): string[] {
  return others.filter(other => other.id !== ignoreId
    && Math.min(object.x + object.w, other.x + other.w) > Math.max(object.x, other.x)
    && Math.min(object.y + object.d, other.y + other.d) > Math.max(object.y, other.y))
    .map(other => other.label)
}
