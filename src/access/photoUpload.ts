/** Final JPEG body limit, below hosted request-size limits. Raw photos may be larger. */
export const MAX_ENCODED_PHOTO_BYTES = 3_500_000

class PhotoSizeError extends Error {}

type Encoder = (maxEdge: number, quality: number) => Promise<Blob>

/** Try progressively smaller encodings; never return an oversized upload body. */
export async function encodePhotoWithinLimit(encode: Encoder, limit = MAX_ENCODED_PHOTO_BYTES): Promise<Blob> {
  for (const [maxEdge, quality] of [[1600, 0.84], [1600, 0.72], [1280, 0.72], [1024, 0.62], [768, 0.55]]) {
    const blob = await encode(maxEdge, quality)
    if (blob.size > 0 && blob.size <= limit && blob.type === 'image/jpeg') return blob
  }
  throw new PhotoSizeError('This photo is still too large to upload. Try cropping it or choose a smaller image; your original is unchanged.')
}

export async function preparePhotoUpload(file: File): Promise<Blob> {
  const image = new Image()
  const objectUrl = URL.createObjectURL(file)
  let decoded = false
  try {
    image.src = objectUrl
    await image.decode()
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) throw new Error('Invalid photo dimensions')
    decoded = true
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Photo conversion unavailable')
    return await encodePhotoWithinLimit(async (maxEdge, quality) => {
      const ratio = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Photo conversion failed')), 'image/jpeg', quality)
      })
    })
  } catch (error) {
    if (error instanceof PhotoSizeError) throw error
    throw new Error(decoded
      ? 'Could not prepare this photo for upload. Try a smaller image; your original is unchanged.'
      : 'Could not read this photo. Try a JPEG, PNG or WebP image; your original is unchanged.')
  } finally { URL.revokeObjectURL(objectUrl) }
}

export const MAX_ORIGINAL_PHOTO_BYTES = 50 * 1024 * 1024
const ORIGINAL_CHUNK_BYTES = 2 * 1024 * 1024
const PREVIEW_URL = /^\/api\/photos\/[a-f0-9]{64}\.jpg$/

type PreparedOriginal = { preview: Blob; previewKind: 'generated' | 'unavailable'; sha256: string; previewSha256: string }
const preparedPhotos = new WeakMap<File, Promise<PreparedOriginal>>()
const sha256 = async (blob: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')

async function unavailablePreview(): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 960; canvas.height = 640
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare a preview. Your original is unchanged; try again.')
  context.fillStyle = '#e8ecdf'; context.fillRect(0, 0, canvas.width, canvas.height)
  context.textAlign = 'center'; context.fillStyle = '#254d3d'
  context.font = 'bold 46px sans-serif'; context.fillText('Original photo saved', 480, 290)
  context.font = '28px sans-serif'; context.fillText('Preview unavailable on this device', 480, 355)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare a preview. Your original is unchanged; try again.')), 'image/jpeg', 0.8))
}

async function prepareOriginal(file: File): Promise<PreparedOriginal> {
  const existing = preparedPhotos.get(file)
  if (existing) return existing
  const prepared = (async () => {
    let preview: Blob, previewKind: PreparedOriginal['previewKind'] = 'generated'
    try { preview = await preparePhotoUpload(file) }
    catch { previewKind = 'unavailable'; preview = await unavailablePreview() }
    return { preview, previewKind, sha256: await sha256(file), previewSha256: await sha256(preview) }
  })()
  preparedPhotos.set(file, prepared)
  try { return await prepared } catch (error) { preparedPhotos.delete(file); throw error }
}

async function photoRequest(operation: string, body: BodyInit, extra: Record<string, string> = {}): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response
    try {
      response = await fetch('/api/photos', { method: 'POST', credentials: 'same-origin',
        headers: { 'X-Garage-Photo-Operation': operation, ...extra }, body, signal: AbortSignal.timeout(55_000) })
    } catch {
      if (attempt < 2) continue
      throw new Error('Upload paused. Your original is unchanged. Try again when connected.')
    }
    let result: unknown
    try { result = await response.json() } catch {
      if (attempt < 2 && (response.ok || response.status >= 500)) continue
      throw new Error('The photo server did not confirm this upload. Keep the original and try again.')
    }
    if (!response.ok) {
      if (attempt < 2 && (response.status >= 500 || response.status === 408 || response.status === 429)) continue
      const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : 'Photo upload failed. Keep the original and try again.'
      throw new Error(message)
    }
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('The photo server returned an invalid response. Keep the original and try again.')
    return result as Record<string, unknown>
  }
  throw new Error('Photo upload could not be completed. Keep the original and try again.')
}

/** Save exact selected bytes first; the smaller JPEG is only a separate display copy. */
export async function uploadOriginalPhoto(file: File): Promise<string> {
  if (!file.size || file.size > MAX_ORIGINAL_PHOTO_BYTES) throw new Error('Choose a photo up to 50 MB. Your original is unchanged.')
  const prepared = await prepareOriginal(file)
  const session = await photoRequest('begin', JSON.stringify({ filename: file.name, contentType: file.type.toLowerCase(), size: file.size,
    lastModified: file.lastModified, sha256: prepared.sha256,
    preview: { size: prepared.preview.size, sha256: prepared.previewSha256, kind: prepared.previewKind } }), { 'Content-Type': 'application/json' })
  if (session.originalSaved === true && typeof session.url === 'string' && PREVIEW_URL.test(session.url)) return session.url
  if (typeof session.id !== 'string' || !/^[a-f0-9]{64}$/.test(session.id) || session.chunkBytes !== ORIGINAL_CHUNK_BYTES) throw new Error('Could not start a safe photo upload. Keep the original and try again.')
  for (const [component, blob] of [['original', file], ['preview', prepared.preview]] as const) {
    for (let offset = 0, part = 0; offset < blob.size; offset += ORIGINAL_CHUNK_BYTES, part++) {
      const chunk = blob.slice(offset, offset + ORIGINAL_CHUNK_BYTES)
      const result = await photoRequest('chunk', chunk, {
        'Content-Type': 'application/octet-stream', 'X-Garage-Upload-Id': session.id,
        'X-Garage-Photo-Component': component, 'X-Garage-Photo-Part': String(part), 'X-Garage-Photo-Sha256': await sha256(chunk),
      })
      if (result.saved !== true) throw new Error('A photo part was not confirmed. Keep the original and try again.')
    }
  }
  const result = await photoRequest('finish', JSON.stringify({ id: session.id }), { 'Content-Type': 'application/json' })
  if (result.originalSaved !== true || typeof result.url !== 'string' || !PREVIEW_URL.test(result.url)) throw new Error('The original photo was not confirmed. Keep the original and try again.')
  return result.url
}
