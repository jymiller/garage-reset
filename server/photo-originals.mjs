import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export const ORIGINAL_LIMIT = 50 * 1024 * 1024
export const UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024
const PREVIEW_LIMIT = 3_500_000
const SHA = /^[a-f0-9]{64}$/
const ID = /^[a-f0-9]{64}$/
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif', gif: 'image/gif' }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const sameBytes = (a, b) => a.length === b.length && hash(a) === hash(b)

export class OriginalUploadError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
const fail = (status, message) => { throw new OriginalUploadError(status, message) }
function validId(id) { if (typeof id !== 'string' || !ID.test(id)) fail(400, 'Invalid photo upload.') }
function exact(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)) }

export function originalUploadMetadata(value) {
  if (!exact(value, ['filename', 'contentType', 'size', 'lastModified', 'sha256', 'preview'])
    || typeof value.filename !== 'string' || !value.filename.trim() || value.filename.length > 240 || /[\x00-\x1f\x7f/\\]/.test(value.filename) || !value.filename.isWellFormed()
    || typeof value.contentType !== 'string' || value.contentType.length > 100 || !/^(?:image\/[a-z0-9.+-]+|application\/octet-stream)?$/.test(value.contentType)
    || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > ORIGINAL_LIMIT
    || !Number.isSafeInteger(value.lastModified) || value.lastModified < 0 || value.lastModified > 8.64e15
    || typeof value.sha256 !== 'string' || !SHA.test(value.sha256)
    || !exact(value.preview, ['size', 'sha256', 'kind']) || !Number.isSafeInteger(value.preview.size) || value.preview.size < 1 || value.preview.size > PREVIEW_LIMIT
    || typeof value.preview.sha256 !== 'string' || !SHA.test(value.preview.sha256) || !['generated', 'unavailable'].includes(value.preview.kind)) {
    fail(400, 'Invalid original photo information. Choose a photo up to 50 MB.')
  }
  // Canonical field order makes begin repeatable after a lost response.
  return { filename: value.filename, contentType: value.contentType, size: value.size, lastModified: value.lastModified,
    sha256: value.sha256, preview: { size: value.preview.size, sha256: value.preview.sha256, kind: value.preview.kind } }
}

/** Inspect bytes, never the extension, before retaining an original as an image. */
export function originalPhotoFormat(bytes, photoFormat) {
  const common = photoFormat(bytes)
  if (common) return common
  if (bytes.length >= 14 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))
    && bytes.readUInt16LE(6) > 0 && bytes.readUInt16LE(8) > 0 && bytes.at(-1) === 0x3b) return 'gif'
  if (bytes.length < 24 || bytes.toString('ascii', 4, 8) !== 'ftyp') return null
  const boxSize = bytes.readUInt32BE(0)
  if (boxSize < 16 || boxSize > bytes.length || boxSize % 4 !== 0) return null
  const brands = [bytes.toString('ascii', 8, 12)]
  for (let offset = 16; offset < boxSize; offset += 4) brands.push(bytes.toString('ascii', offset, offset + 4))
  // HEIF/AVIF is an ISO-BMFF container. Require a complete box layout and
  // an image metadata box, rather than accepting a renamed video or ftyp alone.
  let offset = boxSize, hasMeta = false
  while (offset < bytes.length) {
    if (bytes.length - offset < 8) return null
    let size = bytes.readUInt32BE(offset), header = 8
    if (size === 1) {
      if (bytes.length - offset < 16) return null
      const large = bytes.readBigUInt64BE(offset + 8)
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null
      size = Number(large); header = 16
    } else if (size === 0) size = bytes.length - offset
    if (size < header || size > bytes.length - offset) return null
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'meta' && size > header + 4) hasMeta = true
    offset += size
  }
  if (!hasMeta) return null
  if (brands.some(brand => ['avif', 'avis'].includes(brand))) return 'avif'
  if (brands.some(brand => ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs'].includes(brand))) return 'heic'
  if (brands.some(brand => ['mif1', 'msf1'].includes(brand))) return 'heif'
  return null
}

export function originalQuery(url) {
  const params = new URL(url || '/', 'http://garage.invalid').searchParams
  if (params.has('original') && params.has('metadata')) fail(400, 'Choose an original or its metadata.')
  for (const key of ['original', 'metadata']) {
    if (params.has(key)) {
      if (params.getAll(key).length !== 1 || params.get(key) !== '1') fail(400, 'Invalid photo request.')
      return key
    }
  }
  return null
}

/** Original and preview are separate immutable objects. Nothing succeeds with only a preview. */
export function createOriginalPhotoService({ storage, photoFormat }) {
  const sessionKey = id => `garage/photo-uploads/${id}/session.json`
  const partKey = (id, component, part) => `garage/photo-uploads/${id}/${component}-${part}`
  const metadataKey = id => `garage/photo-originals/${id}.json`
  const originalKey = id => `garage/photo-originals/${id}.bin`
  const previewKey = id => `garage/photos/${id}.jpg`
  const url = id => `/api/photos/${id}.jpg`
  const readJson = async key => {
    const stored = await storage.read(key, { limit: 16 * 1024 })
    return stored ? JSON.parse(stored.bytes.toString('utf8')) : null
  }
  async function session(id) {
    validId(id)
    const value = await readJson(sessionKey(id))
    if (!value) fail(404, 'Start this photo upload again.')
    originalUploadMetadata(value.source)
    return value
  }
  async function writeExact(key, bytes, contentType) {
    const current = await storage.read(key, { limit: Math.max(bytes.length, 16 * 1024) })
    if (current) {
      if (!sameBytes(current.bytes, bytes)) fail(409, 'This upload already contains different data. Choose the photo again.')
      return
    }
    try { await storage.write(key, bytes, { contentType, createOnly: true }) }
    catch (error) {
      // The write may have completed even when its response was lost.
      const saved = await storage.read(key, { limit: Math.max(bytes.length, 16 * 1024) })
      if (!saved || !sameBytes(saved.bytes, bytes)) throw error
    }
  }
  const completed = async id => {
    const metadata = await readJson(metadataKey(id))
    return metadata ? { url: url(id), originalUrl: `${url(id)}?original=1`, metadataUrl: `${url(id)}?metadata=1`, originalSaved: true, previewAvailable: metadata.preview.kind !== 'unavailable' } : null
  }
  async function cleanup(id, source) {
    if (!storage.remove) return
    // Retain the tiny session and completed manifest for repeatable retries.
    const keys = []
    for (const component of ['original', 'preview']) {
      const size = component === 'original' ? source.size : source.preview.size
      for (let part = 0; part < Math.ceil(size / UPLOAD_CHUNK_BYTES); part++) keys.push(partKey(id, component, part))
    }
    try { await storage.remove(keys) } catch { /* A retained chunk must not invalidate the verified original. */ }
  }
  return {
    async begin(body) {
      const source = originalUploadMetadata(body)
      const id = hash(JSON.stringify(source))
      let existing = await readJson(sessionKey(id))
      if (!existing) {
        const fresh = { version: 1, source, startedAt: Date.now() }
        try { await storage.write(sessionKey(id), Buffer.from(JSON.stringify(fresh)), { contentType: 'application/json', createOnly: true }); existing = fresh }
        catch (error) { existing = await readJson(sessionKey(id)); if (!existing) throw error }
      }
      if (JSON.stringify(existing.source) !== JSON.stringify(source)) fail(409, 'Photo upload information changed. Choose the photo again.')
      return { id, chunkBytes: UPLOAD_CHUNK_BYTES, ...(await completed(id) ?? {}) }
    },
    async chunk(id, component, partText, bytes, expectedSha256) {
      const { source } = await session(id)
      if (!['original', 'preview'].includes(component) || typeof partText !== 'string' || !/^(0|[1-9][0-9]?)$/.test(partText)) fail(400, 'Invalid photo part.')
      const part = Number(partText), size = component === 'original' ? source.size : source.preview.size
      const length = Math.min(UPLOAD_CHUNK_BYTES, size - part * UPLOAD_CHUNK_BYTES)
      if (length <= 0 || bytes.length !== length) fail(400, 'Incomplete photo part. Try this photo again.')
      if (typeof expectedSha256 !== 'string' || !SHA.test(expectedSha256) || hash(bytes) !== expectedSha256) fail(400, 'This photo part did not arrive intact. Try this photo again.')
      if (await completed(id)) return { saved: true }
      await writeExact(partKey(id, component, part), bytes, 'application/octet-stream')
      return { saved: true }
    },
    async finish(id) {
      const { source, startedAt } = await session(id)
      const result = await completed(id)
      if (result) { await cleanup(id, source); return result }
      async function assemble(component, size, expected) {
        const chunks = []
        const count = Math.ceil(size / UPLOAD_CHUNK_BYTES)
        for (let start = 0; start < count; start += 4) {
          const group = await Promise.all(Array.from({ length: Math.min(4, count - start) }, async (_, offset) => {
            const value = await storage.read(partKey(id, component, start + offset), { limit: UPLOAD_CHUNK_BYTES })
            if (!value) fail(409, 'Some photo parts are missing. Try this photo again.')
            return value.bytes
          }))
          chunks.push(...group)
        }
        const bytes = Buffer.concat(chunks)
        if (bytes.length !== size || hash(bytes) !== expected) fail(400, 'The photo did not arrive intact. Keep the original and try again.')
        return bytes
      }
      try {
        const original = await assemble('original', source.size, source.sha256)
        const format = originalPhotoFormat(original, photoFormat)
        if (!format) fail(415, 'Choose a JPEG, PNG, WebP, GIF, AVIF or HEIC photo.')
        const preview = await assemble('preview', source.preview.size, source.preview.sha256)
        if (photoFormat(preview) !== 'jpg') fail(415, 'The photo preview is invalid. Your original is unchanged.')
        // Metadata is written last, so a completed manifest always means both writes succeeded.
        await writeExact(originalKey(id), original, TYPES[format])
        await writeExact(previewKey(id), preview, 'image/jpeg')
        const metadata = { version: 1, photo: url(id), uploadedAt: startedAt,
          original: { filename: source.filename, contentType: TYPES[format], declaredContentType: source.contentType,
            bytes: source.size, sha256: source.sha256, fileLastModified: source.lastModified },
          preview: { contentType: 'image/jpeg', bytes: source.preview.size, sha256: source.preview.sha256, kind: source.preview.kind } }
        await writeExact(metadataKey(id), Buffer.from(JSON.stringify(metadata)), 'application/json')
        await cleanup(id, source)
        return await completed(id)
      } catch (error) {
        // Another finalize can finish and remove chunks while this request is
        // reading them. Its complete manifest is a successful acknowledgement.
        const saved = await completed(id)
        if (saved) return saved
        throw error
      }
    },
    async read(filename, kind) {
      if (typeof filename !== 'string' || !/^[a-f0-9]{64}\.jpg$/.test(filename)) fail(404, 'Original photo not found.')
      const id = filename.slice(0, -4), metadata = await readJson(metadataKey(id))
      if (!metadata) fail(404, 'An original was not stored with this older photo.')
      if (kind === 'metadata') return { metadata }
      const original = await storage.read(originalKey(id), { limit: ORIGINAL_LIMIT })
      if (!original || original.bytes.length !== metadata.original.bytes || hash(original.bytes) !== metadata.original.sha256) throw new Error('Original photo integrity check failed.')
      return { bytes: original.bytes, metadata }
    },
  }
}

export async function handleOriginalPhotoOperation({ operation, headers, readBytes, service }) {
  if (operation === 'chunk') {
    return service.chunk(headers['x-garage-upload-id'], headers['x-garage-photo-component'], headers['x-garage-photo-part'], await readBytes(UPLOAD_CHUNK_BYTES), headers['x-garage-photo-sha256'])
  }
  if (!['begin', 'finish'].includes(operation)) fail(400, 'Invalid photo upload action.')
  if (headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, 'Use application/json for photo information.')
  let body
  try { body = JSON.parse((await readBytes(16 * 1024)).toString('utf8')) } catch (error) { if (error.status) throw error; fail(400, 'Invalid photo information.') }
  if (operation === 'begin') return service.begin(body)
  if (!exact(body, ['id'])) fail(400, 'Invalid photo upload.')
  return service.finish(body.id)
}

export function originalResponseHeaders(metadata, length) {
  return { 'Content-Type': metadata.original.contentType, 'Content-Length': length,
    'Content-Disposition': `attachment; filename="garage-original"; filename*=UTF-8''${encodeURIComponent(metadata.original.filename).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16)}`)}` }
}

/** Local storage mirrors the private Blob keys without serving the data directory. */
export function createOriginalFileStorage(dataDir) {
  function resolve(key) {
    if (!/^garage\/(?:photo-uploads\/[a-f0-9]{64}\/(?:session\.json|(?:original|preview)-[0-9]{1,2})|photo-originals\/[a-f0-9]{64}\.(?:bin|json)|photos\/[a-f0-9]{64}\.jpg)$/.test(key)) throw new Error('Invalid original storage key.')
    return path.join(dataDir, key.slice('garage/'.length))
  }
  return {
    async read(key, { limit = ORIGINAL_LIMIT } = {}) {
      const file = resolve(key)
      try {
        const stat = await fs.lstat(file)
        if (!stat.isFile() || stat.size > limit) throw new Error('Invalid original storage object.')
        const bytes = await fs.readFile(file)
        if (bytes.length > limit) throw new Error('Original storage object exceeds its limit.')
        return { bytes, etag: hash(bytes) }
      } catch (error) { if (error.code === 'ENOENT') return null; throw error }
    },
    async write(key, bytes, { createOnly }) {
      if (!createOnly) throw new Error('Original photo writes must be immutable.')
      const file = resolve(key), temporary = `${file}.${randomUUID()}.tmp`
      await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
      try {
        await fs.writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 })
        // Hard-link creation fails if another request already committed this key.
        await fs.link(temporary, file)
      } finally { await fs.unlink(temporary).catch(() => {}) }
    },
    async remove(keys) {
      if (!Array.isArray(keys) || keys.some(key => !/^garage\/photo-uploads\/[a-f0-9]{64}\/(?:original|preview)-[0-9]{1,2}$/.test(key))) throw new Error('Only completed upload chunks can be removed.')
      await Promise.all(keys.map(key => fs.unlink(resolve(key)).catch(error => { if (error.code !== 'ENOENT') throw error })))
    },
  }
}

/** Streaming avoids the hosted response-body cap for originals above 4.5 MB. */
export async function sendOriginalPhoto(req, res, saved) {
  res.writeHead(200, originalResponseHeaders(saved.metadata, saved.bytes.length))
  if (req.method === 'HEAD') { res.end(); return }
  function* chunks() { for (let offset = 0; offset < saved.bytes.length; offset += 512 * 1024) yield saved.bytes.subarray(offset, offset + 512 * 1024) }
  await pipeline(Readable.from(chunks()), res)
}
