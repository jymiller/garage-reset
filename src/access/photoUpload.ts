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
