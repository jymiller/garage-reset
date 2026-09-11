import { randomUUID } from 'node:crypto'
import { validEnvelope, readBody, photoFormat } from './app.mjs'
import { isAuthorized, handleAccess } from './access.mjs'

const WORKSPACE_KEY = 'garage/workspace.json'
const WORKSPACE_LIMIT = 2 * 1024 * 1024
const PHOTO_LIMIT = 3.5 * 1024 * 1024
const EVIDENCE_LIMIT = 16 * 1024 * 1024
const PHOTO_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.(jpg|png|webp)$/
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' }
const empty = () => ({ revision: 0, data: { schemaVersion: 1, crates: [], items: [], baselineLocked: false, notes: '' } })

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

async function readStream(stream, limit) {
  const reader = stream.getReader()
  let size = 0
  const chunks = []
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) return Buffer.concat(chunks)
      size += value.byteLength
      if (size > limit) throw new Error('Stored object exceeds its size limit.')
      chunks.push(Buffer.from(value))
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally { reader.releaseLock() }
}

/** Private Blob is authoritative; every read bypasses its CDN cache. */
export function createBlobStorage({ loadSdk = () => import('@vercel/blob'), token = () => process.env.BLOB_READ_WRITE_TOKEN } = {}) {
  const options = () => {
    const value = token()
    if (typeof value !== 'string' || !value.trim()) throw new Error('Private storage is not configured.')
    return { access: 'private', token: value }
  }
  return {
    async read(key, { limit = EVIDENCE_LIMIT } = {}) {
      const auth = options()
      const sdk = await loadSdk()
      const result = await sdk.get(key, { ...auth, useCache: false })
      if (result === null) return null
      if (result.statusCode !== 200 || !result.stream || !result.blob?.etag) throw new Error('Invalid private storage response.')
      if (typeof result.blob.size === 'number' && result.blob.size > limit) {
        await result.stream.cancel().catch(() => {})
        throw new Error('Stored object exceeds its size limit.')
      }
      return { bytes: await readStream(result.stream, limit), etag: result.blob.etag, contentType: result.blob.contentType }
    },
    async write(key, bytes, { contentType, ifMatch, createOnly = false }) {
      if (!createOnly && (typeof ifMatch !== 'string' || !ifMatch)) throw new Error('A conditional write requires its previous ETag.')
      const auth = options()
      const sdk = await loadSdk()
      return sdk.put(key, bytes, {
        ...auth, contentType, addRandomSuffix: false, allowOverwrite: !createOnly,
        ...(createOnly ? {} : { ifMatch }),
      })
    },
  }
}

function mediaType(req) { return req.headers['content-type']?.split(';')[0].trim().toLowerCase() }

// Vercel can preparse Node request bodies. Support those and untouched streams;
// the same byte limits and strict schema still apply before any storage write.
async function requestBytes(req, limit) {
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
    throw new RequestError(415, 'Compressed request bodies are not supported.')
  }
  if (Number(req.headers['content-length']) > limit) throw new RequestError(413, 'Request body is too large.')
  if (req.body === undefined) {
    try { return await readBody(req, limit) }
    catch (error) {
      if ([400, 413, 415].includes(error.status)) throw new RequestError(error.status, error.message)
      throw error
    }
  }
  let bytes
  if (Buffer.isBuffer(req.body)) bytes = req.body
  else if (req.body instanceof Uint8Array) bytes = Buffer.from(req.body)
  else if (typeof req.body === 'string') bytes = Buffer.from(req.body)
  else if (mediaType(req) === 'application/json' && req.body !== null && typeof req.body === 'object') {
    bytes = Buffer.from(JSON.stringify(req.body))
  } else throw new RequestError(400, 'Invalid request body.')
  if (bytes.length > limit) throw new RequestError(413, 'Request body is too large.')
  return bytes
}

function sameOriginWrite(req) {
  if (['GET', 'HEAD'].includes(req.method)) return
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new RequestError(403, 'Cross-origin writes are not allowed.')
  if (!req.headers.origin) return
  let origin
  try { origin = new URL(req.headers.origin) } catch { throw new RequestError(403, 'Cross-origin writes are not allowed.') }
  const protocol = req.headers['x-forwarded-proto'] ?? (req.socket?.encrypted ? 'https' : 'http')
  if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host || origin.protocol !== `${protocol}:`) {
    throw new RequestError(403, 'Cross-origin writes are not allowed.')
  }
}

function routeQuery(req) {
  const url = new URL(req.url || '/', 'https://garage.invalid')
  const field = key => {
    if (url.searchParams.getAll(key).length > 1) throw new RequestError(400, 'Invalid route.')
    const value = req.query && Object.hasOwn(req.query, key) ? req.query[key] : url.searchParams.get(key)
    if (value !== null && value !== undefined && typeof value !== 'string') throw new RequestError(400, 'Invalid route.')
    return value
  }
  const route = field('route'), name = field('name')
  if (route) return { route, name }
  let pathname
  try { pathname = decodeURIComponent(url.pathname) } catch { throw new RequestError(400, 'Invalid route.') }
  if (pathname === '/api/workspace') return { route: 'workspace', name }
  if (pathname === '/api/photos') return { route: 'photos', name }
  if (pathname.startsWith('/api/photos/')) return { route: 'photo', name: pathname.slice('/api/photos/'.length) }
  if (pathname.startsWith('/evidence/')) return { route: 'evidence', name: pathname.slice('/evidence/'.length) }
  return { route, name }
}

function evidenceName(name) {
  if (typeof name !== 'string' || name.length > 512 || !name.split('/').every(part => /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(part))) return null
  const extension = name.split('.').at(-1).toLowerCase()
  return MIME[extension] ? extension : null
}

async function workspaceSnapshot(storage) {
  const stored = await storage.read(WORKSPACE_KEY, { limit: WORKSPACE_LIMIT })
  if (stored === null) return { envelope: empty(), etag: null }
  if (typeof stored.etag !== 'string' || !stored.etag || !Buffer.isBuffer(stored.bytes) || stored.bytes.length > WORKSPACE_LIMIT) {
    throw new Error('Invalid stored workspace metadata.')
  }
  const envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(stored.bytes))
  if (!validEnvelope(envelope)) throw new Error('Invalid stored workspace; data is preserved.')
  return { envelope, etag: stored.etag }
}

/** No local files or process-level workspace cache: conditional Blob writes handle concurrency across function instances. */
export function createVercelHandler({ storage = createBlobStorage(), authorize = isAuthorized, access = handleAccess } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'same-origin')
    try {
      sameOriginWrite(req)
      if (await access(req, res)) return
      if (!await authorize(req)) { req.resume?.(); json(res, 401, { error: 'Open your private garage link on this device to continue.' }); return }
      const { route, name } = routeQuery(req)
      if (route === 'workspace') {
        if (req.method === 'GET') { json(res, 200, (await workspaceSnapshot(storage)).envelope); return }
        if (req.method !== 'PUT') { res.setHeader('Allow', 'GET, PUT'); throw new RequestError(405, 'Method not allowed.') }
        if (mediaType(req) !== 'application/json') throw new RequestError(415, 'Workspace requests must use application/json.')
        const bytes = await requestBytes(req, WORKSPACE_LIMIT)
        let candidate
        try { candidate = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
        catch { throw new RequestError(400, 'Invalid JSON.') }
        if (!validEnvelope(candidate)) throw new RequestError(400, 'Invalid workspace or revision.')
        const current = await workspaceSnapshot(storage)
        if (candidate.revision !== current.envelope.revision) { json(res, 409, current.envelope); return }
        if (candidate.revision === Number.MAX_SAFE_INTEGER) throw new Error('Revision limit reached.')
        const next = { revision: candidate.revision + 1, data: candidate.data }
        const serialized = Buffer.from(JSON.stringify(next))
        if (serialized.length > WORKSPACE_LIMIT) throw new RequestError(413, 'Workspace is too large.')
        try {
          await storage.write(WORKSPACE_KEY, serialized, { contentType: 'application/json', createOnly: current.etag === null, ...(current.etag === null ? {} : { ifMatch: current.etag }) })
        } catch (error) {
          // Covers a create race, failed If-Match, or a lost success response.
          // An unrelated storage failure must never become a fictitious success.
          const latest = await workspaceSnapshot(storage)
          if (latest.etag !== null && latest.etag !== current.etag) { json(res, 409, latest.envelope); return }
          throw error
        }
        json(res, 200, next); return
      }
      if (route === 'photos') {
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new RequestError(405, 'Method not allowed.') }
        const bytes = await requestBytes(req, PHOTO_LIMIT)
        const extension = photoFormat(bytes)
        if (!extension) throw new RequestError(415, 'Upload a JPEG, PNG or WebP image.')
        const type = mediaType(req)
        if (type && type !== 'application/octet-stream' && type !== MIME[extension]) throw new RequestError(415, 'Image content does not match its content type.')
        const filename = `${randomUUID()}.${extension}`
        await storage.write(`garage/photos/${filename}`, bytes, { contentType: MIME[extension], createOnly: true })
        const url = `/api/photos/${filename}`
        json(res, 201, { url, src: url, filename }); return
      }
      if (route === 'photo' || route === 'evidence') {
        if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); throw new RequestError(405, 'Method not allowed.') }
        const extension = route === 'photo' ? typeof name === 'string' && PHOTO_NAME.test(name) && name.split('.').at(-1) : evidenceName(name)
        if (!extension) throw new RequestError(404, 'Image not found.')
        const stored = await storage.read(`garage/${route === 'photo' ? 'photos' : 'evidence'}/${name}`, { limit: EVIDENCE_LIMIT })
        if (!stored) throw new RequestError(404, 'Image not found.')
        res.writeHead(200, { 'Content-Type': MIME[extension], 'Content-Length': stored.bytes.length })
        res.end(req.method === 'HEAD' ? undefined : stored.bytes); return
      }
      throw new RequestError(404, 'API route not found.')
    } catch (error) {
      if (res.headersSent) { res.destroy(); return }
      // Never return tokens, Blob URLs or provider diagnostics to the browser.
      const status = error instanceof RequestError ? error.status : 503
      req.resume?.()
      json(res, status, { error: status === 503 ? 'Shared storage is unavailable. Your existing data has not been replaced; retry shortly.' : error.message })
    }
  }
}
