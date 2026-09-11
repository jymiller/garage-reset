import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { isAuthorized, handleAccess } from './access.mjs'

const key = 'test-family-link-secret-key-of-at-least-32-characters'
const now = 1800000000000
async function request({ method = 'POST', body = { key }, origin = 'https://garage.example', host = 'garage.example', cookie, secret = key, url = '/api/garage?route=access' } = {}) {
  const req = Readable.from([JSON.stringify(body)])
  Object.assign(req, { method, url, headers: { host, origin, cookie, 'content-type': 'application/json' } })
  const headers = {}; let result
  const res = { statusCode: 200, setHeader(name, value) { headers[name.toLowerCase()] = value }, end(value) { result = JSON.parse(value) } }
  const handled = await handleAccess(req, res, { key: secret, now })
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
