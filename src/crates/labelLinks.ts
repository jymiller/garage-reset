/** Printed labels carry a crate code, never the private family access link. */
export const CRATE_LABEL_ORIGIN = 'https://garage-reset.vercel.app'
const HASH_PREFIX = '#crates?code='
const MAX_CODE_LENGTH = 32
// A 32-code-unit string needs at most 288 percent-encoded characters.
const MAX_HASH_LENGTH = HASH_PREFIX.length + MAX_CODE_LENGTH * 9

/** Match the model's length/trim rules without changing case or punctuation. */
export function normalizeCrateCode(raw: unknown): string | null {
  if (typeof raw !== 'string' || /[\u0000-\u001f\u007f-\u009f]/u.test(raw)) return null
  const code = raw.trim()
  if (!code || code.length > MAX_CODE_LENGTH) return null
  // Lone surrogate code units cannot make a faithful UTF-8 URL round trip.
  try { encodeURIComponent(code) } catch { return null }
  return code
}

export function crateLabelHash(code: string): string | null {
  const normalized = normalizeCrateCode(code)
  return normalized === null ? null : `${HASH_PREFIX}${encodeURIComponent(normalized)}`
}

export function crateLabelUrl(code: string): string | null {
  const hash = crateLabelHash(code)
  return hash === null ? null : `${CRATE_LABEL_ORIGIN}/${hash}`
}

/** Accept one crate-code parameter in a fragment, not a URL or arbitrary route. */
export function parseCrateLabelHash(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > MAX_HASH_LENGTH) return null
  const match = /^#crates\?code=([^&#]*)$/u.exec(raw)
  if (!match) return null
  try {
    // URL query '+' means a space. Generated labels escape a literal '+' as %2B.
    return normalizeCrateCode(decodeURIComponent(match[1].replace(/\+/g, ' ')))
  } catch {
    // Reject malformed escapes/UTF-8 instead of replacing them with another code.
    return null
  }
}

/** Use before writing or reading a pending route in sessionStorage. */
export function sanitizePendingCrateHash(raw: unknown): string | null {
  const code = parseCrateLabelHash(raw)
  return code === null ? null : crateLabelHash(code)
}

/** Call only after family access succeeds; invalid/missing routes go home. */
export function restoreCrateHashAfterAccess(raw: unknown): string {
  return sanitizePendingCrateHash(raw) ?? '#home'
}

/** Match workspace code uniqueness; never choose arbitrarily among duplicates. */
export function findCrateByCode<T extends { code: string }>(crates: readonly T[], code: unknown): T | null {
  const normalized = normalizeCrateCode(code)
  if (normalized === null) return null
  const key = normalized.toLowerCase()
  let found: T | null = null
  for (const crate of crates) {
    if (normalizeCrateCode(crate.code)?.toLowerCase() !== key) continue
    if (found !== null) return null
    found = crate
  }
  return found
}
