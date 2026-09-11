export type AccessResult = { state: 'authorized' } | { state: 'locked'; message?: string } | { state: 'error'; message: string }
type Fetcher = typeof fetch

/** Only loopback development bypasses access. LAN and hosted addresses stay gated. */
export function isLocalhost(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname.toLowerCase())
}

function validKey(value: string): boolean {
  return value.length > 0 && value.length <= 2048 && !/\s/.test(value)
}

export function accessKeyFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const keys = params.getAll('access')
  return keys.length === 1 && validKey(keys[0]) ? keys[0] : null
}

/** Parse locally; pasted URLs are never navigated to or fetched. */
export function parseAccessKey(input: string): string | null {
  const value = input.trim()
  if (!value || value.length > 4096) return null
  if (value.startsWith('#')) return accessKeyFromHash(value)
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      return accessKeyFromHash(url.hash)
    } catch { return null }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//') || /[?#]/.test(value)) return null
  return validKey(value) ? value : null
}

const unavailable: AccessResult = { state: 'error', message: 'Couldn’t reach the garage. Check your connection and try again.' }

async function request(fetcher: Fetcher, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    return await fetcher('/api/access', { ...init, credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
  } finally { clearTimeout(timer) }
}

export async function checkAccess(fetcher: Fetcher = fetch): Promise<AccessResult> {
  try {
    const response = await request(fetcher, { method: 'GET' })
    if (!response.ok) return unavailable
    const result: unknown = await response.json()
    if (!result || typeof result !== 'object' || !('authorized' in result) || typeof result.authorized !== 'boolean') return unavailable
    return result.authorized ? { state: 'authorized' } : { state: 'locked' }
  } catch { return unavailable }
}

export async function openFamilyAccess(key: string, fetcher: Fetcher = fetch): Promise<AccessResult> {
  if (!validKey(key)) return { state: 'locked', message: 'Paste the complete family link and try again.' }
  try {
    const response = await request(fetcher, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }),
    })
    if (response.status === 401 || response.status === 403) {
      return { state: 'locked', message: 'That family link wasn’t recognized. Check that you copied the whole link.' }
    }
    if (!response.ok) return unavailable
    const confirmed = await checkAccess(fetcher)
    return confirmed.state === 'locked'
      ? { state: 'error', message: 'Couldn’t finish opening the garage on this device. Try your family link again.' }
      : confirmed
  } catch { return unavailable }
}
