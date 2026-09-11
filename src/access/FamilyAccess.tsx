import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { accessKeyFromHash, checkAccess, isLocalhost, openFamilyAccess, parseAccessKey } from './access'
import type { AccessResult } from './access'
import './access.css'

type State = AccessResult | { state: 'checking' }

export function FamilyAccess({ children }: { children: ReactNode }) {
  const local = isLocalhost(window.location.hostname)
  const [state, setState] = useState<State>(() => ({ state: local ? 'authorized' : 'checking' }))
  const [entry, setEntry] = useState('')
  const startup = useRef<Promise<AccessResult> | null>(null)
  const requestNumber = useRef(0)

  function accept(result: AccessResult, clearFragment: boolean) {
    if (result.state === 'authorized') {
      setEntry('')
      if (clearFragment) {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#layout`)
      }
    }
    setState(result)
  }

  async function attempt(key: string | null) {
    const current = ++requestNumber.current
    setState({ state: 'checking' })
    const result = await (key ? openFamilyAccess(key) : checkAccess())
    if (current === requestNumber.current) accept(result, key !== null)
  }

  useEffect(() => {
    if (local) return
    let active = true
    const key = accessKeyFromHash(window.location.hash)
    // React's development effect replay shares this operation rather than
    // exchanging the same link twice and racing its cookie confirmation.
    startup.current ??= key ? openFamilyAccess(key) : checkAccess()
    const current = requestNumber.current
    void startup.current.then(result => {
      if (active && current === requestNumber.current) accept(result, key !== null)
    })
    const onHashChange = () => {
      const next = accessKeyFromHash(window.location.hash)
      if (next) void attempt(next)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => { active = false; window.removeEventListener('hashchange', onHashChange) }
  }, [local])

  if (state.state === 'authorized') return children
  const checking = state.state === 'checking'
  const message = state.state === 'locked' || state.state === 'error' ? state.message : undefined

  return <main className="family-access">
    <section className="family-access-card" aria-labelledby="family-access-title">
      <span className="family-access-mark" aria-hidden="true">G↗</span>
      <p className="family-access-brand">GARAGE RESET</p>
      <h1 id="family-access-title">{checking ? 'Opening your garage…' : state.state === 'error' ? 'Let’s get you connected.' : 'Open your family link.'}</h1>
      <p className="family-access-intro">Your photos, plans and progress, together.<br />Use your saved family link to open the garage on this device.</p>
      {checking ? <p className="family-access-checking" role="status">Getting the garage ready…</p> : <>
        {message && <p className="family-access-message" role="alert">{message}</p>}
        <form onSubmit={event => {
          event.preventDefault()
          const key = parseAccessKey(entry)
          if (!key) { setState({ state: 'locked', message: 'Paste the complete family link and try again.' }); return }
          void attempt(key)
        }}>
          <label htmlFor="family-link">Family link</label>
          <input id="family-link" type="text" value={entry} onChange={event => setEntry(event.target.value)}
            placeholder="Paste your family link" maxLength={4096} autoComplete="off" autoCapitalize="none" spellCheck={false} />
          <button type="submit" disabled={!entry.trim()}>Open garage <span aria-hidden="true">→</span></button>
        </form>
        {state.state === 'error' && <button className="family-access-retry" onClick={() => void attempt(accessKeyFromHash(window.location.hash))}>Try connecting again</button>}
        <p className="family-access-note">Once you’ve opened your family link, this device can remember the garage.</p>
      </>}
    </section>
  </main>
}
