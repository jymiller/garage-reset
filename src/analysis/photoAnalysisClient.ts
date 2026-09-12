import { isPhotoFilename, validateAnalysisRecord } from './contract.mjs'
import type { AnalysisRecord } from './contract.mjs'

const PHOTO_URL = /^\/api\/photos\/([A-Za-z0-9][A-Za-z0-9_-]{0,127}\.(?:jpg|png|webp))$/

export function photoFilenameFromUrl(photo: string): string | null {
  return PHOTO_URL.exec(photo)?.[1] ?? null
}

export async function requestPhotoAnalysis(filename: string, retry = false, signal?: AbortSignal, send: typeof fetch = fetch): Promise<AnalysisRecord | null> {
  if (!isPhotoFilename(filename)) throw new Error('This photo cannot be analyzed.')
  const response = await send(retry ? '/api/analysis/retry' : `/api/analysis?photo=${encodeURIComponent(filename)}`, {
    method: retry ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    ...(retry ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo: filename }) } : {}),
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Open the family link to view analysis.')
    if (response.status === 404) throw new Error('The original photo is unavailable.')
    throw new Error(retry ? 'Analysis could not start. Try again.' : 'Could not check analysis.')
  }
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('Analysis is unavailable.') }
  if (!payload || typeof payload !== 'object' || !('analysis' in payload)) throw new Error('Analysis is unavailable.')
  const analysis = payload.analysis
  if (analysis === null && !retry) return null
  if (!validateAnalysisRecord(analysis) || analysis.photoFilename !== filename) throw new Error('Analysis is unavailable.')
  return analysis
}
