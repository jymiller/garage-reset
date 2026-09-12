import { currentObjects } from './currentObjects'
import { validGeometry } from './layoutDraft'
import type { Correction, Corrections } from './layoutDraft'

export const LAYOUT_CORRECTIONS_KEY = 'garage-layout-corrections-v1'

export function readCorrections(): Corrections {
  try {
    const value = JSON.parse(localStorage.getItem(LAYOUT_CORRECTIONS_KEY) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const entries: [string, Correction][] = []
    for (const [id, c] of Object.entries(value)) {
      if (currentObjects.some(o => o.id === id) && validGeometry(c)) entries.push([id, { x: c.x, y: c.y, w: c.w, d: c.d, h: c.h, note: c.note }])
    }
    return Object.fromEntries(entries)
  } catch { return {} }
}

