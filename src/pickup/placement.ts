/** Dimensions and coordinates are in feet; the public road lies along y = 0. */
export type BagSize = 'large' | 'medium'

export type Site = {
  width: number
  depth: number
  roadWidth: number
  /** Reserved public sidewalk measured back from the road edge. */
  sidewalkDepth: number
}

/** x/y locate the bag's minimum corner, regardless of rotation. */
export type Placement = {
  x: number
  y: number
  rotated: boolean
}

export type PickupChecks = {
  measured: boolean
  openSky: boolean
  privateGround: boolean
  truckAccess: boolean
  handles: boolean
}

export type PickupSettings = {
  site: Site
  placement: Placement
  size: BagSize
  checks: PickupChecks
  fill: number
}

export const BAGS = {
  large: { width: 79 / 12, depth: 39 / 12, height: 39 / 12, volume: 2.6 },
  medium: { width: 38 / 12, depth: 38 / 12, height: 38 / 12, volume: 1.1 },
} as const

export const DEFAULT_SITE: Site = { width: 24, depth: 16, roadWidth: 14, sidewalkDepth: 5 }
export const DEFAULT_PLACEMENT: Placement = { x: 1, y: 6, rotated: false }

export function footprint(size: BagSize, rotated: boolean): { width: number; depth: number } {
  const bag = BAGS[size]
  return rotated
    ? { width: bag.depth, depth: bag.width }
    : { width: bag.width, depth: bag.depth }
}

export function evaluatePlacement(site: Site, placement: Placement, size: BagSize) {
  const bag = footprint(size, placement.rotated)
  const finite = [site.width, site.depth, site.roadWidth, site.sidewalkDepth, placement.x, placement.y].every(Number.isFinite)
  const validSite = finite && site.width > 0 && site.depth > 0 && site.roadWidth > 0 && site.sidewalkDepth >= 0
  const farX = placement.x + bag.width
  const farY = placement.y + bag.depth
  const roadDistance = finite ? Math.max(Math.abs(placement.y), Math.abs(farY)) : Infinity

  // A four-foot central walking lane is a planning preference, not a pickup rule.
  // Touching its edge is allowed; only positive-area overlap obstructs the lane.
  const walkwayOverlap = placement.x < site.width / 2 + 2
    && farX > site.width / 2 - 2
    && placement.y < site.depth
    && farY > 0

  return {
    inside: validSite && placement.x >= 0 && placement.y >= 0 && farX <= site.width && farY <= site.depth,
    roadDistance,
    withinReach: validSite && roadDistance < 20,
    roadWideEnough: validSite && site.roadWidth >= 14,
    walkwayClear: validSite && !walkwayOverlap,
    sidewalkClear: validSite && placement.y >= site.sidewalkDepth,
  }
}

export function suggestPlacement(site: Site, size: BagSize, side: 'left' | 'right'): Placement {
  const bag = footprint(size, false)
  // Round toward the interior to a three-inch increment, retaining at least a
  // foot at the right edge whenever the site has room for that side setback.
  const x = side === 'left' ? 1 : Math.floor((site.width - bag.width - 1) * 4) / 4
  // Preserve the requested setback. evaluatePlacement must still reject an apron
  // too small for this suggestion; suggestions are never a guarantee of fit.
  return {
    x: Math.max(0, Number.isFinite(x) ? x : 0),
    y: Math.max(0, Number.isFinite(site.sidewalkDepth) ? site.sidewalkDepth + 1 : DEFAULT_PLACEMENT.y),
    rotated: false,
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function bounded(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback
}

function checked(value: unknown): boolean {
  return value === true
}

/** Validate parsed localStorage data without trusting types or coercing strings. */
export function sanitizeSettings(raw: unknown): PickupSettings {
  const settings = record(raw)
  const site = record(settings.site)
  const placement = record(settings.placement)
  const checks = record(settings.checks)
  const sanitizedSite: Site = {
    width: bounded(site.width, 4, 80, DEFAULT_SITE.width),
    depth: bounded(site.depth, 4, 80, DEFAULT_SITE.depth),
    roadWidth: bounded(site.roadWidth, 4, 60, DEFAULT_SITE.roadWidth),
    sidewalkDepth: bounded(site.sidewalkDepth, 0, 20, DEFAULT_SITE.sidewalkDepth),
  }
  const sanitizedPlacement: Placement = {
    x: bounded(placement.x, -20, 100, DEFAULT_PLACEMENT.x),
    y: bounded(placement.y, -20, 100, DEFAULT_PLACEMENT.y),
    rotated: checked(placement.rotated),
  }
  // Confirmations apply to the exact measured geometry. If any required field
  // needed a fallback, a saved confirmation must not certify the example data.
  const siteIntact = Object.entries(sanitizedSite).every(([key, value]) => site[key] === value)
  const placementIntact = Object.entries(sanitizedPlacement).every(([key, value]) => placement[key] === value)
  const sizeIntact = settings.size === 'large' || settings.size === 'medium'
  const spatialChecksIntact = siteIntact && placementIntact && sizeIntact
  return {
    site: sanitizedSite,
    placement: sanitizedPlacement,
    size: settings.size === 'medium' ? 'medium' : 'large',
    checks: {
      measured: siteIntact && checked(checks.measured),
      openSky: spatialChecksIntact && checked(checks.openSky),
      privateGround: spatialChecksIntact && checked(checks.privateGround),
      truckAccess: spatialChecksIntact && checked(checks.truckAccess),
      handles: spatialChecksIntact && checked(checks.handles),
    },
    fill: bounded(settings.fill, 0, 100, 0),
  }
}
