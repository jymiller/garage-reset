import http from 'node:http'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { validateRewardBook, rewardsTransitionError } from '../src/rewards/contract.mjs'
import { createPhotoAnalysisService, createAnalysisFileStorage } from './photo-analysis.mjs'
import { isPhotoFilename } from '../src/analysis/contract.mjs'
import { createOriginalPhotoService, createOriginalFileStorage, handleOriginalPhotoOperation, originalQuery, sendOriginalPhoto } from './photo-originals.mjs'

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const WORKSPACE_LIMIT = 2 * 1024 * 1024
const PHOTO_LIMIT = 8 * 1024 * 1024
const PHOTO_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.(jpg|png|webp)$/
const PHOTO_URL = /^\/api\/photos\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.(jpg|png|webp)$/
// Fixed observation groups and dated evidence IDs; checked against client data in tests.
const SPATIAL_PARENTS = new Set([
  'suv-latest', 'rack-front-black-cabinet', 'rack-r1', 'rack-r2', 'rack-r3', 'rack-r4',
  'rack-front-jacks', 'rack-floor-cords', 'folded-tables', 'rear-tool-chest', 'rear-oak-cupboard',
  'cupboard-floor-group', 'rear-cart', 'rear-window-cabinets', 'rear-upright-tools', 'wall-panel-block',
  'side-bins-reference', 'rug-frame-reference', 'water-heater-reference', 'utility-cabinet-reference',
  'bicycle-reference', 'fabric-wardrobe-reference', 'white-bench-reference', 'rear-stacked-storage-reference',
  'rear-oak-worktop-reference', 'yellow-sack-morning-reference',
])
const SPATIAL_PHOTOS = new Set([
  'IMG_1908', 'IMG_1909', 'IMG_1910', 'IMG_1911', 'IMG_1912', 'IMG_1913', 'IMG_1914', 'IMG_1915',
  'IMG_1916', 'IMG_1917', 'IMG_1918', 'IMG_1927', 'IMG_1928', 'IMG_1929', 'IMG_1930', 'IMG_1931', 'IMG_1932',
])
const EMPTY = { schemaVersion: 1, crates: [], items: [], baselineLocked: false, notes: '' }
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary',
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function exactObject(value, keys, optionalKeys = []) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && keys.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => keys.includes(key) || optionalKeys.includes(key))
}
function text(value, max, required = false) {
  return typeof value === 'string' && value.length <= max && value === value.trim()
    && (!required || value.length > 0)
}
function number(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

/** Mirrors src/crates/model.ts. The integration test checks the shared contract. */
export function validWorkspace(data) {
  if (!exactObject(data, ['schemaVersion', 'crates', 'items', 'baselineLocked', 'notes'], ['missions', 'spatialItems', 'rewards', 'observations', 'photoAwards', 'activityCredits'])
    || data.schemaVersion !== 1 || !Array.isArray(data.crates) || !Array.isArray(data.items)
    || typeof data.baselineLocked !== 'boolean' || !text(data.notes, 4000)) return false
  const ids = new Set(), codes = new Set(), itemIds = new Set()
  for (const crate of data.crates) {
    if (!exactObject(crate, ['id', 'code', 'name', 'location', 'owner', 'capacityLiters', 'baselineFill', 'currentFill', 'status', 'photo', 'notes', 'createdAt'])
      || !text(crate.id, 120, true) || !text(crate.code, 32, true) || !text(crate.name, 160, true)
      || !text(crate.location, 160) || !text(crate.owner, 80) || !text(crate.notes, 4000)
      || !number(crate.capacityLiters, Number.MIN_VALUE, 2000)
      || !number(crate.baselineFill, 0, 100) || !number(crate.currentFill, 0, 100)
      || !number(crate.createdAt, 0, 8.64e15) || !['unopened', 'sorting', 'repacked'].includes(crate.status)
      || !(crate.photo === null || (typeof crate.photo === 'string' && PHOTO_URL.test(crate.photo)))
      || ids.has(crate.id) || codes.has(crate.code.toLowerCase())) return false
    ids.add(crate.id); codes.add(crate.code.toLowerCase())
  }
  for (const item of data.items) {
    if (!exactObject(item, ['id', 'crateId', 'name', 'quantity', 'decision', 'destination', 'departed', 'notes'])
      || !text(item.id, 120, true) || !text(item.crateId, 120, true) || !text(item.name, 160, true)
      || !Number.isInteger(item.quantity) || !number(item.quantity, 1, 100000)
      || !['undecided', 'keep', 'donate', 'sell', 'recycle', 'trash'].includes(item.decision)
      || !text(item.destination, 240) || typeof item.departed !== 'boolean' || !text(item.notes, 4000)
      || itemIds.has(item.id) || !ids.has(item.crateId)) return false
    itemIds.add(item.id)
  }
  if (Object.hasOwn(data, 'missions')) {
    if (!Array.isArray(data.missions)) return false
    const missionIds = new Set()
    for (const mission of data.missions) {
      if (!validMission(mission, ids) || missionIds.has(mission.id)) return false
      missionIds.add(mission.id)
    }
  }
  if (Object.hasOwn(data, 'spatialItems')) {
    if (!Array.isArray(data.spatialItems)) return false
    const occupiedIds = new Set([...SPATIAL_PARENTS, ...ids, ...itemIds, ...(data.missions ?? []).map(mission => mission.id)])
    const linkedCrates = new Set()
    for (const item of data.spatialItems) {
      if (!validSpatialItem(item, ids) || occupiedIds.has(item.id)
        || item.crateId !== null && linkedCrates.has(item.crateId)) return false
      occupiedIds.add(item.id)
      if (item.crateId !== null) linkedCrates.add(item.crateId)
    }
  }
  if (Object.hasOwn(data, 'rewards') && !validateRewardBook(data.rewards, data.missions ?? [])) return false
  if (Object.hasOwn(data, 'observations')) {
    if (!Array.isArray(data.observations)) return false
    const observationIds = new Set()
    const helperIds = new Set(data.rewards?.players.map(player => player.id) ?? [])
    for (const observation of data.observations) {
      if (!validObservation(observation, ids, helperIds) || observationIds.has(observation.id)) return false
      observationIds.add(observation.id)
    }
  }
  if (Object.hasOwn(data, 'photoAwards')) {
    if (!Array.isArray(data.photoAwards)) return false
    const observations = new Map((data.observations ?? []).map(photo => [photo.id, photo]))
    const helperIds = new Set(data.rewards?.players.map(player => player.id) ?? [])
    const awarded = new Set()
    for (const award of data.photoAwards) {
      if (!exactObject(award, ['observationId', 'helperId', 'points', 'reviewedAt'])
        || !text(award.observationId, 120, true) || !text(award.helperId, 120, true)
        || award.points !== 25 || !number(award.reviewedAt, 0, 8.64e15)
        || awarded.has(award.observationId) || !helperIds.has(award.helperId)) return false
      const observation = observations.get(award.observationId)
      if (!observation || award.reviewedAt < observation.createdAt) return false
      awarded.add(award.observationId)
    }
  }
  if (Object.hasOwn(data, 'activityCredits')) {
    if (!Array.isArray(data.activityCredits)) return false
    const helperIds = new Set(data.rewards?.players.map(player => player.id) ?? [])
    const creditIds = new Set(), creditedItems = new Set()
    for (const credit of data.activityCredits) {
      if (!validActivityCredit(credit) || creditIds.has(credit.id) || !helperIds.has(credit.helperId)) return false
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

function validActivityCredit(value) {
  if (!value || !text(value.id, 120, true) || !text(value.helperId, 120, true)
    || value.points !== 25 || !number(value.createdAt, 0, 8.64e15) || !text(value.labelCode, 32, true)) return false
  const common = ['id', 'kind', 'helperId', 'points', 'createdAt', 'labelCode']
  if (value.kind === 'sticker') {
    return exactObject(value, [...common, 'surface']) && /^C-(?!000)[0-9]{3}$/.test(value.labelCode)
      && ['front', 'lid'].includes(value.surface) && value.id === `sticker:${value.labelCode}:${value.surface}`
  }
  return value.kind === 'inventory' && exactObject(value, [...common, 'itemIds'])
    && Array.isArray(value.itemIds) && value.itemIds.length >= 1 && value.itemIds.length <= 100
    && value.itemIds.every(id => text(id, 120, true)) && new Set(value.itemIds).size === value.itemIds.length
}

function validObservation(observation, crateIds, helperIds) {
  if (!exactObject(observation, ['id', 'kind', 'photo', 'notes', 'location', 'crateId', 'measurement', 'createdAt'], ['labelCode', 'photoRole', 'helperId'])
    || !text(observation.id, 120, true) || !['general', 'crate', 'parking', 'measurement', 'placement'].includes(observation.kind)
    || typeof observation.photo !== 'string' || !PHOTO_URL.test(observation.photo)
    || !text(observation.notes, 4000) || !text(observation.location, 160)
    || !(observation.crateId === null || text(observation.crateId, 120, true) && crateIds.has(observation.crateId))
    || !number(observation.createdAt, 0, 8.64e15)
    || Object.hasOwn(observation, 'labelCode') && !(typeof observation.labelCode === 'string' && /^C-(?!000)[0-9]{3}$/.test(observation.labelCode))
    || Object.hasOwn(observation, 'photoRole') && !['outside', 'contents'].includes(observation.photoRole)
    || Object.hasOwn(observation, 'helperId') && !(observation.helperId === null || text(observation.helperId, 120, true) && helperIds.has(observation.helperId))) return false
  const measurement = observation.measurement
  return measurement === null || exactObject(measurement, ['value', 'unit', 'label', 'basis'])
    && number(measurement.value, Number.MIN_VALUE, 1e6)
    && ['cm', 'm', 'in', 'ft'].includes(measurement.unit)
    && text(measurement.label, 160, true) && measurement.basis === 'user-measured'
}

/** Old clients cannot silently discard photos they do not yet understand. */
export function observationsPreserved(current, next) {
  const incoming = new Map((next.observations ?? []).map(observation => [observation.id, observation]))
  return (current.observations ?? []).every(observation => {
    const retained = incoming.get(observation.id)
    return retained && ['labelCode', 'photoRole', 'helperId'].every(key => !Object.hasOwn(observation, key) || Object.hasOwn(retained, key))
  })
}

/** Reviewed XP and its original photo cannot be replaced by a stale or older client. */
export function photoAwardsPreserved(current, next) {
  const incoming = new Map((next.photoAwards ?? []).map(award => [award.observationId, award]))
  const previousPhotos = new Map((current.observations ?? []).map(photo => [photo.id, photo]))
  const nextPhotos = new Map((next.observations ?? []).map(photo => [photo.id, photo]))
  return (current.photoAwards ?? []).every(award => {
    const retained = incoming.get(award.observationId)
    const before = previousPhotos.get(award.observationId), after = nextPhotos.get(award.observationId)
    return retained && ['observationId', 'helperId', 'points', 'reviewedAt'].every(key => retained[key] === award[key])
      && before && after && before.photo === after.photo && before.createdAt === after.createdAt
  })
}

/** Immutable receipts survive older clients; new inventory XP accompanies actual added items. */
export function activityCreditsPreserved(current, next) {
  const incoming = new Map((next.activityCredits ?? []).map(credit => [credit.id, credit]))
  const existing = new Map((current.activityCredits ?? []).map(credit => [credit.id, credit]))
  for (const credit of existing.values()) {
    const retained = incoming.get(credit.id)
    if (!retained || !['id', 'kind', 'helperId', 'points', 'createdAt', 'labelCode'].every(key => retained[key] === credit[key])) return false
    if (credit.kind === 'sticker' ? retained.surface !== credit.surface
      : retained.itemIds.length !== credit.itemIds.length || credit.itemIds.some(id => !retained.itemIds.includes(id))) return false
  }
  const previousItems = new Set(current.items.map(item => item.id))
  const nextItems = new Map(next.items.map(item => [item.id, item]))
  const nextCrates = new Map(next.crates.map(crate => [crate.id, crate]))
  for (const credit of incoming.values()) {
    if (existing.has(credit.id) || credit.kind !== 'inventory') continue
    // Only new receipts need a current crate match. Earned receipts retain their
    // historical label even when these items or their crate are moved/renamed.
    if (credit.itemIds.some(id => {
      const item = nextItems.get(id)
      return previousItems.has(id) || !item || nextCrates.get(item.crateId)?.code !== credit.labelCode
    })) return false
  }
  return true
}

function validSpatialItem(item, crateIds) {
  if (!exactObject(item, ['id', 'name', 'parentId', 'crateId', 'photoId', 'region', 'x', 'y', 'z', 'w', 'd', 'h', 'dimensionBasis', 'notes', 'createdAt'])
    || !text(item.id, 120, true) || !text(item.name, 160, true)
    || !text(item.parentId, 120, true) || !SPATIAL_PARENTS.has(item.parentId)
    || !text(item.photoId, 120, true) || !SPATIAL_PHOTOS.has(item.photoId)
    || !(item.crateId === null || text(item.crateId, 120, true) && crateIds.has(item.crateId))
    || !text(item.notes, 4000) || !number(item.createdAt, 0, 8.64e15)
    || !['estimated', 'measured'].includes(item.dimensionBasis)
    || !number(item.x, 0, 25.21) || !number(item.y, 0, 7.38) || !number(item.z, 0, 3.2)
    || !number(item.w, 0.01, 25.21) || !number(item.d, 0.01, 7.38) || !number(item.h, 0.01, 3.2)
    || item.x + item.w > 25.21 || item.y + item.d > 7.38 || item.z + item.h > 3.2) return false
  const region = item.region
  return exactObject(region, ['x', 'y', 'w', 'h'])
    && number(region.x, 0, 1) && number(region.y, 0, 1)
    && number(region.w, Number.MIN_VALUE, 1) && number(region.h, Number.MIN_VALUE, 1)
    && region.x + region.w <= 1 && region.y + region.h <= 1
}

function validMission(mission, crateIds) {
  if (!exactObject(mission, ['id', 'title', 'area', 'kind', 'crateId', 'phase', 'beforePhoto', 'afterPhoto', 'plannedMinutes',
    'elapsedSeconds', 'runningSince', 'createdAt', 'completedAt', 'kept', 'bagged', 'donated', 'ask', 'summary', 'parkingClear'])
    || !text(mission.id, 120, true) || !text(mission.title, 160, true) || !text(mission.area, 160, true)
    || !['floor', 'shelf', 'crate'].includes(mission.kind) || !['before', 'active', 'review', 'complete'].includes(mission.phase)
    || !(mission.crateId === null || text(mission.crateId, 120, true) && crateIds.has(mission.crateId))
    || ![5, 10, 15].includes(mission.plannedMinutes) || !Number.isInteger(mission.elapsedSeconds)
    || !number(mission.elapsedSeconds, 0, 31536000) || !number(mission.createdAt, 0, 8.64e15)
    || !text(mission.summary, 4000) || typeof mission.parkingClear !== 'boolean') return false
  for (const photo of [mission.beforePhoto, mission.afterPhoto]) {
    if (!(photo === null || typeof photo === 'string' && PHOTO_URL.test(photo))) return false
  }
  for (const count of [mission.kept, mission.bagged, mission.donated, mission.ask]) {
    if (!Number.isInteger(count) || !number(count, 0, 100000)) return false
  }
  for (const timestamp of [mission.runningSince, mission.completedAt]) {
    if (!(timestamp === null || number(timestamp, mission.createdAt, 8.64e15))) return false
  }
  if (mission.phase !== 'before' && mission.beforePhoto === null) return false
  if (mission.phase === 'before' && mission.elapsedSeconds !== 0) return false
  if (mission.phase !== 'active' && mission.runningSince !== null) return false
  if (mission.phase === 'complete') {
    return mission.beforePhoto !== null && mission.afterPhoto !== null && mission.summary.length > 0
      && mission.parkingClear && mission.completedAt !== null
  }
  return mission.completedAt === null
}

export function validEnvelope(value) {
  return exactObject(value, ['revision', 'data']) && Number.isSafeInteger(value.revision)
    && value.revision >= 0 && validWorkspace(value.data)
}

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let chunks = [], length = 0, settled = false
    const fail = (status, message) => {
      if (settled) return
      settled = true; chunks = []; reject(new HttpError(status, message))
    }
    if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
      req.resume(); reject(new HttpError(415, 'Compressed request bodies are not supported.')); return
    }
    req.on('data', chunk => {
      if (settled) return
      length += chunk.length
      if (length > limit) fail(413, 'Request body is too large.')
      else chunks.push(chunk)
    })
    req.on('end', () => { if (!settled) { settled = true; resolve(Buffer.concat(chunks)) } })
    req.on('error', () => fail(400, 'Request body could not be read.'))
    req.on('aborted', () => fail(400, 'Request was interrupted.'))
    if (Number(req.headers['content-length']) > limit) fail(413, 'Request body is too large.')
  })
}

export function photoFormat(bytes) {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return 'jpg'
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && bytes.toString('ascii', 12, 16) === 'IHDR' && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0) return 'png'
  if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) === bytes.length - 8
    && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))) return 'webp'
  return null
}

async function atomicWrite(file, contents) {
  const temporary = `${file}.${randomUUID()}.tmp`
  let handle
  try {
    handle = await fs.open(temporary, 'wx', 0o600)
    await handle.writeFile(contents)
    await handle.sync()
    await handle.close(); handle = undefined
    await fs.rename(temporary, file)
  } finally {
    await handle?.close().catch(() => {})
    await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error })
  }
}

function authenticated(req, expectedDigest) {
  if (!expectedDigest) return true
  const header = req.headers.authorization ?? ''
  let password = '', wellFormed = false
  if (/^Basic [A-Za-z0-9+/]+={0,2}$/i.test(header)) {
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(header.slice(6), 'base64'))
      const separator = decoded.indexOf(':')
      if (separator >= 0) { password = decoded.slice(separator + 1); wellFormed = true }
    } catch { /* Invalid authorization is handled like a wrong password. */ }
  }
  const matches = timingSafeEqual(expectedDigest, createHash('sha256').update(password).digest())
  return wellFormed && matches
}

function requestPath(req) {
  const raw = (req.url ?? '').split('?')[0]
  if (!raw.startsWith('/')) throw new HttpError(400, 'Invalid request path.')
  let decoded
  try { decoded = decodeURIComponent(raw) } catch { throw new HttpError(400, 'Invalid request path.') }
  if (decoded.includes('\0') || decoded.includes('\\') || /(?:^|\/)\.{1,2}(?:\/|$)/.test(decoded)) {
    throw new HttpError(400, 'Invalid request path.')
  }
  return decoded
}

async function sendFile(req, res, file, mime) {
  const stat = await fs.stat(file)
  if (!stat.isFile()) throw new HttpError(404, 'Not found.')
  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size })
  if (req.method === 'HEAD') res.end()
  else await pipeline(createReadStream(file), res)
}

async function fileInside(directory, file) {
  const [actual, actualDirectory] = await Promise.all([fs.realpath(file), fs.realpath(directory)])
  if (!actual.startsWith(`${actualDirectory}${path.sep}`)) throw new HttpError(404, 'Not found.')
  return actual
}

/** Returns an unbound HTTP server. Bind development to loopback; production sits behind HTTPS. */
export async function createGarageServer({
  dataDir,
  root = APP_ROOT, dev = false, password = process.env.GARAGE_PASSWORD, host,
  analysis,
} = {}) {
  root = path.resolve(root)
  dataDir = path.resolve(dataDir || process.env.GARAGE_DATA_DIR || path.join(root, '.garage-data'))
  if (!dev && (typeof password !== 'string' || password.length === 0)) {
    throw new Error('GARAGE_PASSWORD is required in production.')
  }
  if (dev && !password && host && !['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new Error('Development without a password must bind to loopback.')
  }
  if (password !== undefined && typeof password !== 'string') throw new Error('Password must be a string.')
  for (const publicRoot of [path.join(root, 'public'), path.join(root, 'dist')]) {
    const relative = path.relative(publicRoot, dataDir)
    if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
      throw new Error('GARAGE_DATA_DIR must be outside the public and dist directories.')
    }
  }
  const expectedDigest = password ? createHash('sha256').update(password).digest() : null
  const photoDir = path.join(dataDir, 'photos'), evidenceDir = path.join(dataDir, 'evidence')
  const stateFile = path.join(dataDir, 'workspace.json')
  await fs.mkdir(photoDir, { recursive: true, mode: 0o700 })
  analysis ??= createPhotoAnalysisService({ storage: createAnalysisFileStorage(dataDir) })
  const originals = createOriginalPhotoService({ storage: createOriginalFileStorage(dataDir), photoFormat })
  let state
  try {
    state = JSON.parse(await fs.readFile(stateFile, 'utf8'))
    if (!validEnvelope(state)) throw new Error('Stored workspace is invalid; the existing file has been preserved.')
  } catch (error) {
    if (error.code === 'ENOENT') state = { revision: 0, data: structuredClone(EMPTY) }
    else throw error
  }
  let writeQueue = Promise.resolve()
  let vite
  let viteClose
  const dist = path.join(root, 'dist')

  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'same-origin')
    if (!authenticated(req, expectedDigest)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Garage Reset", charset="UTF-8"')
      json(res, 401, { error: 'Authentication required.' }); req.resume(); return
    }
    try {
      const pathname = requestPath(req)
      // Reject browser cross-site writes even when Basic credentials are cached.
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin) {
        let origin
        try { origin = new URL(req.headers.origin) } catch { throw new HttpError(403, 'Cross-origin writes are not allowed.') }
        if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host) {
          throw new HttpError(403, 'Cross-origin writes are not allowed.')
        }
      }
      if (pathname === '/api/analysis' || pathname === '/api/analysis/retry') {
        if (pathname === '/api/analysis') {
          if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); throw new HttpError(405, 'Method not allowed.') }
          const params = new URL(req.url, 'http://local').searchParams
          const photo = params.get('photo')
          if (params.getAll('photo').length !== 1 || !isPhotoFilename(photo)) throw new HttpError(400, 'Choose an uploaded photo.')
          json(res, 200, { analysis: await analysis.get(photo) }); return
        }
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new HttpError(405, 'Method not allowed.') }
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'Use application/json.')
        const bytes = await readBody(req, 1024)
        let body
        try { body = JSON.parse(bytes.toString('utf8')) } catch { throw new HttpError(400, 'Invalid JSON.') }
        if (!body || typeof body !== 'object' || Object.keys(body).length !== 1 || !isPhotoFilename(body.photo)) throw new HttpError(400, 'Choose an uploaded photo.')
        const record = await analysis.queue(body.photo)
        json(res, ['queued', 'processing'].includes(record.status) ? 202 : 200, { analysis: record }); return
      }
      if (pathname === '/api/workspace') {
        if (req.method === 'GET') { json(res, 200, state); return }
        if (req.method !== 'PUT') { res.setHeader('Allow', 'GET, PUT'); throw new HttpError(405, 'Method not allowed.') }
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
          throw new HttpError(415, 'Workspace requests must use application/json.')
        }
        const raw = await readBody(req, WORKSPACE_LIMIT)
        let body
        try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)) }
        catch { throw new HttpError(400, 'Invalid JSON.') }
        if (!validEnvelope(body)) throw new HttpError(400, 'Invalid workspace or revision.')
        const write = writeQueue.then(async () => {
          if (body.revision !== state.revision) return { status: 409, value: state }
          if (!observationsPreserved(state.data, body.data)) return { status: 409, value: state }
          if (!photoAwardsPreserved(state.data, body.data)) return { status: 409, value: state }
          if (!activityCreditsPreserved(state.data, body.data)) return { status: 409, value: state }
          const rewardsError = rewardsTransitionError(state.data, body.data)
          if (rewardsError) throw new HttpError(400, rewardsError)
          if (state.revision === Number.MAX_SAFE_INTEGER) throw new Error('Revision limit reached.')
          const next = { revision: state.revision + 1, data: body.data }
          await atomicWrite(stateFile, `${JSON.stringify(next)}\n`)
          state = next
          return { status: 200, value: next }
        })
        writeQueue = write.catch(() => {})
        const result = await write
        json(res, result.status, result.value); return
      }
      if (pathname === '/api/photos') {
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new HttpError(405, 'Method not allowed.') }
        if (req.headers['x-garage-photo-operation']) {
          const result = await handleOriginalPhotoOperation({ operation: req.headers['x-garage-photo-operation'], headers: req.headers, readBytes: limit => readBody(req, limit), service: originals })
          if (req.headers['x-garage-photo-operation'] === 'finish' && result.url && result.previewAvailable !== false) {
            try { await analysis.queue(result.url.split('/').at(-1)) } catch { /* Analysis cannot invalidate an archived original. */ }
          }
          json(res, 200, result); return
        }
        const bytes = await readBody(req, PHOTO_LIMIT)
        const extension = photoFormat(bytes)
        if (!extension) throw new HttpError(415, 'Upload a JPEG, PNG or WebP image.')
        const type = req.headers['content-type']?.split(';')[0].trim().toLowerCase()
        if (type && type !== 'application/octet-stream' && type !== mimeTypes[`.${extension}`]) {
          throw new HttpError(415, 'Image content does not match its content type.')
        }
        const filename = `${randomUUID()}.${extension}`
        await atomicWrite(path.join(photoDir, filename), bytes)
        const url = `/api/photos/${filename}`
        let record = null
        try { record = await analysis.queue(filename, bytes) } catch { /* Analysis must never invalidate a saved photo. */ }
        json(res, 201, { url, src: url, filename, analysis: record }); return
      }
      if (pathname.startsWith('/api/photos/')) {
        if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); throw new HttpError(405, 'Method not allowed.') }
        const filename = pathname.slice('/api/photos/'.length)
        if (!PHOTO_NAME.test(filename)) throw new HttpError(404, 'Photo not found.')
        const originalKind = originalQuery(req.url)
        if (originalKind) {
          const saved = await originals.read(filename, originalKind)
          if (originalKind === 'metadata') { json(res, 200, saved.metadata); return }
          await sendOriginalPhoto(req, res, saved); return
        }
        const file = path.join(photoDir, filename)
        if (!(await fs.lstat(file)).isFile()) throw new HttpError(404, 'Photo not found.')
        await sendFile(req, res, file, mimeTypes[path.extname(filename)]); return
      }
      if (pathname.startsWith('/api/')) throw new HttpError(404, 'API route not found.')
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); throw new HttpError(405, 'Method not allowed.') }
      if (pathname.split('/').some(segment => segment.startsWith('.'))) throw new HttpError(404, 'Not found.')
      if (pathname.startsWith('/evidence/')) {
        try {
          const file = await fileInside(evidenceDir, path.resolve(evidenceDir, `.${pathname.slice('/evidence'.length)}`))
          await sendFile(req, res, file, mimeTypes[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
          return
        } catch (error) {
          // Local previews may use the existing public evidence. Production
          // evidence is supplied separately on private persistent storage.
          if (!dev || !['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
        }
      }
      if (dev) {
        vite.middlewares(req, res, () => { if (!res.writableEnded) json(res, 404, { error: 'Not found.' }) })
        return
      }
      let file = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`)
      try {
        file = await fileInside(dist, file)
      } catch (error) {
        if (error.code === 'ENOENT' && !path.extname(pathname) && req.headers.accept?.includes('text/html')) {
          file = await fileInside(dist, path.join(dist, 'index.html'))
        }
        else throw error
      }
      await sendFile(req, res, file, mimeTypes[path.extname(file)] ?? 'application/octet-stream')
    } catch (error) {
      if (res.headersSent) { res.destroy(); return }
      const status = error.status ?? (error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500)
      json(res, status, { error: status === 500 ? 'Could not complete the request. Your last saved workspace has been preserved.' : error.status ? error.message : 'Not found.' })
      req.resume()
    }
  })
  server.requestTimeout = 60000
  server.headersTimeout = 15000
  server.keepAliveTimeout = 5000
  server.maxRequestsPerSocket = 100
  if (dev) {
    const [{ createServer }, { default: react }, { default: tailwindcss }] = await Promise.all([
      import('vite'), import('@vitejs/plugin-react'), import('@tailwindcss/vite'),
    ])
    // Vite resolves source files to real paths; use the same root for its file allowlist.
    const viteRoot = await fs.realpath(root)
    vite = await createServer({
      root: viteRoot, configFile: false,
      cacheDir: path.join(os.tmpdir(), `garage-reset-vite-${createHash('sha256').update(root).digest('hex').slice(0, 12)}`),
      plugins: [react(), tailwindcss()], resolve: { dedupe: ['react', 'react-dom', 'three'] },
      server: {
        middlewareMode: true, host: '127.0.0.1',
        hmr: { server, host: '127.0.0.1' },
      }, appType: 'spa',
    })
    // Upgrade requests bypass the HTTP request handler. Keep Vite's WebSocket on
    // this same loopback listener, behind the same authentication gate.
    const viteUpgradeHandlers = server.listeners('upgrade')
    for (const handler of viteUpgradeHandlers) server.removeListener('upgrade', handler)
    server.on('upgrade', (req, socket, head) => {
      if (!authenticated(req, expectedDigest)) {
        socket.end('HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm="Garage Reset", charset="UTF-8"\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
        return
      }
      const protocol = req.headers['sec-websocket-protocol']
      if (!['vite-hmr', 'vite-ping'].includes(protocol) || req.url?.split('?')[0] !== '/') {
        socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
        return
      }
      for (const handler of viteUpgradeHandlers) handler.call(server, req, socket, head)
    })
    server.on('close', () => { viteClose = vite.close() })
  }
  server.closeGarage = async () => {
    if (server.listening) await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
      server.closeIdleConnections()
    })
    await writeQueue
    await (viteClose || vite?.close())
  }
  return server
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dev = process.argv.includes('--dev')
  const host = dev ? '127.0.0.1' : '0.0.0.0'
  const port = Number(process.env.PORT || (dev ? 5173 : 3000))
  try {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.')
    const server = await createGarageServer({ dev, host })
    server.on('error', error => { console.error(`Garage Reset server failed: ${error.code ?? 'unknown error'}`); process.exitCode = 1 })
    server.listen(port, host, () => console.log(`Garage Reset listening on http://${host}:${port}`))
    const stop = () => { void server.closeGarage().then(() => process.exit(0)) }
    process.once('SIGTERM', stop); process.once('SIGINT', stop)
  } catch (error) {
    console.error(`Garage Reset could not start: ${error.message}`); process.exitCode = 1
  }
}
