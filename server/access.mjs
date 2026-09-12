import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE = '__Host-garage-family'
const YEAR = 365 * 24 * 60 * 60
const FAMILY_ORIGIN = 'https://garage-reset.vercel.app'
const digest = value => createHash('sha256').update(value).digest()
const configuredKey = () => process.env.GARAGE_ACCESS_KEY
const validKey = key => typeof key === 'string' && key.length >= 32 && key.length <= 256 && !/[\s\u0000-\u001f\u007f]/.test(key)
const signature = (key, expires) => createHmac('sha256', key).update(`garage-family-v1:${expires}`).digest('base64url')

export function isAuthorized(req, key = configuredKey(), now = Date.now()) {
  if (!validKey(key)) return false
  const cookie = String(req.headers.cookie ?? '').split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  if (!cookie || !/^\d{10,13}\.[A-Za-z0-9_-]{43}$/.test(cookie)) return false
  const [expires, proof] = cookie.split('.')
  const expiry = Number(expires)
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + YEAR * 1000 + 60000) return false
  return timingSafeEqual(digest(proof), digest(signature(key, expires)))
}

function reply(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.statusCode = status
  res.end(JSON.stringify(body))
}

async function readKey(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') return null
  let body = req.body
  if (body === undefined) {
    const chunks = []; let size = 0
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.length
      if (size > 2048) return null
      chunks.push(bytes)
    }
    body = Buffer.concat(chunks)
  }
  if (Buffer.isBuffer(body) || typeof body === 'string') {
    if (Buffer.byteLength(body) > 2048) return null
    try { body = JSON.parse(body.toString()) } catch { return null }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1) return null
  return validKey(body.key) ? body.key : null
}

function sameOriginShare(req) {
  // The custom header prevents this secret-bearing response being requested by
  // a cross-origin simple fetch or a top-level link. No CORS grant is provided.
  if (req.headers['x-garage-share'] !== '1') return false
  const site = req.headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin') return false
  const rawOrigin = req.headers.origin
  if (rawOrigin === undefined) return true
  if (typeof rawOrigin !== 'string') return false
  let origin
  try { origin = new URL(rawOrigin) } catch { return false }
  const protocol = req.headers['x-forwarded-proto'] ?? (req.socket?.encrypted ? 'https' : 'http')
  return ['https:', 'http:'].includes(origin.protocol) && origin.origin === rawOrigin
    && origin.host === req.headers.host && origin.protocol === `${protocol}:`
}

/** A bookmark grants a signed, HttpOnly device cookie; the family key never enters a public bundle. */
export async function handleAccess(req, res, { key = configuredKey(), now = Date.now() } = {}) {
  const url = new URL(req.url, 'http://garage.local')
  if (req.query?.route !== 'access' && url.searchParams.get('route') !== 'access' && url.pathname !== '/api/access') return false
  if (!validKey(key)) { reply(res, 503, { error: 'Family access is not configured yet.' }); return true }
  const share = req.query?.share ?? url.searchParams.get('share')
  if (share !== null && share !== undefined) {
    if (share !== '1' || url.searchParams.getAll('share').length > 1) { reply(res, 400, { error: 'Invalid invitation request.' }); return true }
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); reply(res, 405, { error: 'Method not allowed.' }); return true }
    if (!isAuthorized(req, key, now)) { reply(res, 401, { error: 'Open your family link on this device before inviting a helper.' }); return true }
    if (!sameOriginShare(req)) { reply(res, 403, { error: 'Invitations must be prepared from the garage app.' }); return true }
    let link
    try { link = `${FAMILY_ORIGIN}/#access=${encodeURIComponent(key)}` }
    catch { reply(res, 503, { error: 'Family invitations are unavailable. Try again later.' }); return true }
    reply(res, 200, { url: link }); return true
  }
  if (req.method === 'GET') { reply(res, 200, { authorized: isAuthorized(req, key, now) }); return true }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); reply(res, 405, { error: 'Method not allowed.' }); return true }
  if (req.headers.origin) {
    let origin
    try { origin = new URL(req.headers.origin) } catch { /* Invalid origins are rejected below. */ }
    if (!origin || !['https:', 'http:'].includes(origin.protocol) || origin.host !== req.headers.host) {
      reply(res, 403, { error: 'Cross-origin requests are not allowed.' }); return true
    }
  }
  let supplied
  try { supplied = await readKey(req) } catch { supplied = null }
  if (!supplied || !timingSafeEqual(digest(supplied), digest(key))) {
    reply(res, 401, { error: 'This family link is not valid. Use the original shared link.' }); return true
  }
  const expires = String(now + YEAR * 1000)
  res.setHeader('Set-Cookie', `${COOKIE}=${expires}.${signature(key, expires)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${YEAR}`)
  reply(res, 200, { authorized: true })
  return true
}
