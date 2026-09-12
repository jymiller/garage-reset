// Run with: node src/crates/labelLinks.test.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('./labelLinks.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const {
  CRATE_LABEL_ORIGIN, normalizeCrateCode, crateLabelHash, crateLabelUrl,
  parseCrateLabelHash, sanitizePendingCrateHash, restoreCrateHashAfterAccess, findCrateByCode,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('printed QR links use the fixed public origin and only the crate code', () => {
  assert.equal(CRATE_LABEL_ORIGIN, 'https://garage-reset.vercel.app')
  assert.equal(crateLabelUrl('C-001'), 'https://garage-reset.vercel.app/#crates?code=C-001')
  const url = new URL(crateLabelUrl('Rack A & B / #1 + 50%'))
  assert.equal(url.origin, CRATE_LABEL_ORIGIN)
  assert.equal(url.pathname, '/')
  assert.equal(url.search, '')
  assert.equal(url.username, '')
  assert.equal(url.password, '')
  assert.deepEqual([...new URLSearchParams(url.hash.slice('#crates?'.length))], [['code', 'Rack A & B / #1 + 50%']])
})

test('custom codes round-trip without imposing C-number naming or losing Unicode', () => {
  for (const code of ['C-001', 'c-001', 'Tools / camping', 'A&B=1?# +%', 'Étagère 🧰', '箱'.repeat(32), 'A'.repeat(32)]) {
    const hash = crateLabelHash(code)
    assert.equal(parseCrateLabelHash(hash), code)
    assert.equal(sanitizePendingCrateHash(hash), hash)
  }
  assert.equal(crateLabelHash('  Blue tote  '), '#crates?code=Blue%20tote')
  assert.equal(normalizeCrateCode('  C-001  '), 'C-001')
  assert.equal(parseCrateLabelHash('#crates?code=Rack+A%2BB'), 'Rack A+B')
})

test('code bounds and unsafe/unrepresentable strings are rejected without truncating', () => {
  for (const code of ['', '   ', 'A'.repeat(33), '🧰'.repeat(17), 'C\n001', 'C\u0000001', 'C\u007f001', '\ud800']) {
    assert.equal(normalizeCrateCode(code), null)
    assert.equal(crateLabelHash(code), null)
    assert.equal(crateLabelUrl(code), null)
  }
  for (const raw of [null, undefined, 42, {}, ['C-001']]) assert.equal(normalizeCrateCode(raw), null)
})

test('the route parser rejects duplicate, unexpected and missing parameters', () => {
  for (const hash of [
    '#crates', '#crates?', '#crates?code=', '#crates?code=%20', '#crates?code',
    '#crates?code=C-001&code=C-002', '#crates?code=C-001&code=C-001',
    '#crates?code=C-001&access=family-key', '#crates?access=family-key&code=C-001',
    '#crates?code=C-001&', '#crates?Code=C-001', '#crates?%63ode=C-001',
    '#Crates?code=C-001', '#crates?code=C-001#access=family-key',
  ]) assert.equal(parseCrateLabelHash(hash), null, hash)
})

test('malformed encoding never resolves to a different valid crate', () => {
  for (const hash of [
    '#crates?code=%', '#crates?code=%2', '#crates?code=%GG', '#crates?code=%C0%AF',
    '#crates?code=%ED%A0%80', '#crates?code=C%0A001', '#crates?code=%00C-001',
    '#crates?code=' + 'x'.repeat(1000),
  ]) assert.equal(parseCrateLabelHash(hash), null, hash)
  assert.equal(parseCrateLabelHash('#crates?code=%252F'), '%2F')
})

test('pending routes cannot carry external URLs, auth fragments or arbitrary app routes', () => {
  for (const raw of [
    null, undefined, {}, 3, 'https://garage-reset.vercel.app/#crates?code=C-001',
    'https://elsewhere.example/#crates?code=C-001', '//elsewhere.example/',
    'javascript:alert(1)', '#access=family-key', '#layout', '#home',
    '#crates?code=C-001&next=https://elsewhere.example/',
  ]) {
    assert.equal(sanitizePendingCrateHash(raw), null)
    assert.equal(restoreCrateHashAfterAccess(raw), '#home')
  }
})

test('the saved QR destination survives family access as a canonical fragment', () => {
  const pending = sanitizePendingCrateHash('#crates?code=  Blue+tote  ')
  assert.equal(pending, '#crates?code=Blue%20tote')
  assert.equal(restoreCrateHashAfterAccess(pending), '#crates?code=Blue%20tote')
  assert.equal(restoreCrateHashAfterAccess('#crates?code=Shelf%2fOne'), '#crates?code=Shelf%2FOne')
})

test('matching is case-insensitive exactly as model uniqueness, and preserves records', () => {
  const crates = [{ id: 'one', code: 'C-001' }, { id: 'two', code: 'Étage / 2' }]
  assert.equal(findCrateByCode(crates, ' c-001 '), crates[0])
  assert.equal(findCrateByCode(crates, 'étage / 2'), crates[1])
  assert.equal(findCrateByCode(crates, 'C-002'), null)
  assert.equal(findCrateByCode(crates, null), null)
  assert.equal(findCrateByCode([{ code: 'é' }], 'e\u0301'), null)
})

test('ambiguous duplicate codes fail closed even if one is an exact-case match', () => {
  assert.equal(findCrateByCode([{ code: 'C-001' }, { code: 'c-001' }], 'C-001'), null)
  assert.equal(findCrateByCode([{ code: 'C-001' }, { code: 'C-001' }], 'c-001'), null)
})
