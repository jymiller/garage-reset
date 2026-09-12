import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { isAuthorized, handleAccess } from './access.mjs'

const key = 'test-family-link-secret-key-of-at-least-32-characters'
const now = 1800000000000
async function request({ method = 'POST', body = { key }, origin = 'https://garage.example', host = 'garage.example', cookie, secret = key, url = '/api/garage?route=access', headers: extraHeaders = {}, query, at = now } = {}) {
  const req = Readable.from([JSON.stringify(body)])
  Object.assign(req, { method, url, query, headers: { host, origin, cookie, 'content-type': 'application/json', 'x-forwarded-proto': 'https', ...extraHeaders } })
  const headers = {}; let result
  const res = { statusCode: 200, setHeader(name, value) { headers[name.toLowerCase()] = value }, end(value) { result = JSON.parse(value) } }
  const handled = await handleAccess(req, res, { key: secret, now: at })
  return { handled, status: res.statusCode, headers, result }
}
test('a valid family bookmark exchanges for a secure device cookie', async () => {
  const response = await request()
  assert.equal(response.status, 200)
  assert.equal(response.result.authorized, true)
  const cookie = response.headers['set-cookie']
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax; Max-Age=31536000/)
  assert.ok(!cookie.includes(key))
  assert.ok(isAuthorized({ headers: { cookie } }, key, now))
  assert.ok(!isAuthorized({ headers: { cookie } }, key, now + 366 * 86400000))
  assert.ok(!isAuthorized({ headers: { cookie } }, 'rotated-family-key-of-at-least-32-characters', now))
  assert.ok(!isAuthorized({ headers: { cookie: cookie.replace(/=\d/, '=9') } }, key, now))
})
test('access status is public but evidence authorization fails closed', async () => {
  assert.deepEqual((await request({ method: 'GET' })).result, { authorized: false })
  assert.equal((await request({ secret: '' })).status, 503)
  assert.ok(!isAuthorized({ headers: {} }, undefined, now))
  assert.equal((await request({ url: '/api/garage?route=workspace' })).handled, false)
})
test('invalid credentials, cross-site exchanges and unsupported methods are rejected', async () => {
  assert.equal((await request({ body: { key: 'incorrect-but-long-enough-secret-value' } })).status, 401)
  assert.equal((await request({ body: { key, extra: true } })).status, 401)
  assert.equal((await request({ body: { key: 'x'.repeat(3000) } })).status, 401)
  assert.equal((await request({ origin: 'https://other.example' })).status, 403)
  assert.equal((await request({ method: 'DELETE' })).status, 405)
})

const share = { method: 'GET', url: '/api/access?share=1', headers: { 'x-garage-share': '1', 'sec-fetch-site': 'same-origin' } }
test('only an authorized invitation request receives the fixed encoded family URL', async () => {
  const secret = 'test-family-key-with-special-characters-&?/%#+='
  const access = await request({ secret, body: { key: secret } })
  const cookie = access.headers['set-cookie']
  const response = await request({ ...share, secret, cookie, host: 'preview.example', origin: 'https://preview.example' })
  assert.equal(response.status, 200)
  assert.deepEqual(response.result, { url: 'https://garage-reset.vercel.app/#access=' + encodeURIComponent(secret) })
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.equal(response.headers['referrer-policy'], 'no-referrer')
  assert.equal(response.headers['set-cookie'], undefined)
  assert.equal(new URL(response.result.url).search, '')
  const rewritten = await request({ ...share, secret, cookie, url: '/api/garage?route=access&share=1', query: { route: 'access', share: '1' } })
  assert.equal(rewritten.status, 200)
  assert.deepEqual(rewritten.result, response.result)
})

test('unauthorized, expired and rotated cookies never receive invitation URLs', async () => {
  const cookie = (await request()).headers['set-cookie']
  for (const patch of [{}, { cookie: 'invalid' }, { cookie, at: now + 366 * 86400000 }, { cookie, secret: 'rotated-family-key-of-at-least-32-characters' }]) {
    const response = await request({ ...share, ...patch })
    assert.equal(response.status, 401)
    assert.equal(Object.hasOwn(response.result, 'url'), false)
    assert.ok(!JSON.stringify(response.result).includes(key))
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.equal(response.headers['referrer-policy'], 'no-referrer')
  }
})

test('cross-origin, same-site and top-level invitation requests fail closed', async () => {
  const cookie = (await request()).headers['set-cookie']
  for (const patch of [
    { origin: 'https://other.example' }, { origin: 'http://garage.example' }, { origin: 'null' },
    { headers: { 'x-garage-share': '1', 'sec-fetch-site': 'cross-site' } },
    { headers: { 'x-garage-share': '1', 'sec-fetch-site': 'same-site' } },
    { headers: { 'x-garage-share': '1', 'sec-fetch-site': 'none' } },
    { headers: { 'sec-fetch-site': 'same-origin' } }, { headers: {} },
  ]) {
    const response = await request({ ...share, cookie, ...patch })
    assert.equal(response.status, 403)
    assert.equal(Object.hasOwn(response.result, 'url'), false)
    assert.ok(!JSON.stringify(response.result).includes(key))
  }
  // Same-origin browser GETs need not send an Origin header. The custom
  // header also provides a preflight boundary for older Fetch Metadata clients.
  assert.equal((await request({ ...share, cookie, headers: { 'x-garage-share': '1', origin: undefined } })).status, 200)
})

test('invalid configuration, queries and methods never leak a configured key', async () => {
  const cookie = (await request()).headers['set-cookie']
  for (const secret of ['', 'short-key', 'x'.repeat(257), 'space-containing secret of sufficient length']) {
    const response = await request({ ...share, cookie, secret })
    assert.equal(response.status, 503)
    assert.equal(Object.hasOwn(response.result, 'url'), false)
    if (secret) assert.ok(!JSON.stringify(response.result).includes(secret))
  }
  for (const patch of [{ url: '/api/access?share=1&share=1' }, { url: '/api/access?share=no' }, { query: { share: ['1', '1'] } }]) {
    assert.equal((await request({ ...share, cookie, ...patch })).status, 400)
  }
  assert.equal((await request({ ...share, cookie, method: 'POST' })).status, 405)
  const ordinaryStatus = await request({ method: 'GET', cookie })
  assert.deepEqual(ordinaryStatus.result, { authorized: true })
})
