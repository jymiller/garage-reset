import { useEffect, useId, useRef, useState } from 'react'
import { isLocalhost } from './access'
import './share-family-link.css'

const FAMILY_ORIGIN = 'https://garage-reset.vercel.app'
class InvitationError extends Error {}

function validInvitation(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 2000) return false
  try {
    const url = new URL(raw)
    const parameters = new URLSearchParams(url.hash.slice(1))
    const key = parameters.get('access')
    return url.origin === FAMILY_ORIGIN && url.pathname === '/' && !url.search && !url.username && !url.password
      && [...parameters].length === 1 && key !== null && key.length >= 32 && key.length <= 256 && !/[\s\u0000-\u001f\u007f]/.test(key)
  } catch { return false }
}

/** The private invitation exists only in this open panel's memory. */
export function ShareFamilyLink() {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [manualCopy, setManualCopy] = useState(false)
  const request = useRef<AbortController | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const manual = useRef<HTMLTextAreaElement | null>(null)
  const generation = useRef(0)
  const canShare = typeof navigator.share === 'function'

  useEffect(() => () => { generation.current += 1; request.current?.abort() }, [])

  async function prepare() {
    request.current?.abort()
    const current = ++generation.current
    setOpen(true); setUrl(null); setError(''); setNotice(''); setManualCopy(false)
    if (isLocalhost(window.location.hostname)) {
      setLoading(false); setError('Invitations are available in the shared online garage. Open your family link there, then choose Invite a helper.'); return
    }
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    const timeout = window.setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch('/api/access?share=1', { method: 'GET', credentials: 'same-origin', cache: 'no-store', headers: { 'X-Garage-Share': '1' }, signal: controller.signal })
      if (!response.ok) throw new InvitationError(response.status === 401 || response.status === 403
        ? 'Open your family link on this device before inviting a helper.'
        : response.status === 404 || response.status === 503
          ? 'Family invitations are unavailable here right now. Keep your original family link and try again later.'
          : 'The invitation could not be prepared. Try again.')
      const data: unknown = await response.json()
      const link = data && typeof data === 'object' && 'url' in data ? data.url : null
      if (!validInvitation(link)) throw new InvitationError('The garage returned an invalid invitation. Try again later.')
      if (current === generation.current) setUrl(link)
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof InvitationError
        ? cause.message : 'Couldn’t connect to prepare the invitation. Check your connection and try again.')
    } finally {
      window.clearTimeout(timeout)
      if (current === generation.current) setLoading(false)
    }
  }

  function close() {
    generation.current += 1; request.current?.abort(); request.current = null
    setUrl(null); setOpen(false); setLoading(false); setError(''); setNotice(''); setManualCopy(false)
    trigger.current?.focus()
  }

  function share() {
    if (!url || !canShare) return
    const current = generation.current
    // Invoke during this click, after preparation has finished. Awaiting a fetch
    // here would lose the transient activation required by the iPhone share sheet.
    try {
      const pending = navigator.share({ title: 'Garage Reset', text: 'Join our garage cleanup. Open this private family link and choose your name.', url })
      void pending.then(() => {
        if (current === generation.current) setNotice('Link passed to the share sheet. Your helper can open it and choose their name.')
      }).catch((cause: unknown) => {
        if (current === generation.current && !(cause instanceof Error && cause.name === 'AbortError')) setNotice('The share sheet could not open. Use Copy family link instead.')
      })
    } catch { setNotice('The share sheet could not open. Use Copy family link instead.') }
  }

  function copy() {
    if (!url) return
    const current = generation.current
    if (!navigator.clipboard?.writeText) { setManualCopy(true); setNotice('Select and copy the private link below.'); return }
    void navigator.clipboard.writeText(url).then(() => {
      if (current === generation.current) setNotice('Family link copied. Send it only to someone you’re inviting into this garage.')
    }).catch(() => {
      if (current === generation.current) { setManualCopy(true); setNotice('Select and copy the private link below.') }
    })
  }

  return <section className="share-family">
    <button type="button" className="share-family-trigger" ref={trigger} aria-expanded={open} aria-controls={id + '-panel'} onClick={() => open ? close() : void prepare()}><ShareIcon /><span>Invite a helper</span><span aria-hidden="true">{open ? '−' : '→'}</span></button>
    {open && <div id={id + '-panel'} className="share-family-panel" role="region" aria-labelledby={id + '-heading'}>
      <div className="share-family-heading"><h2 id={id + '-heading'}>Bring someone along.</h2><button type="button" onClick={close}>Close</button></div>
      <p>This private link grants access to the family garage, including its photos and progress. Share it with someone you trust. They can choose their name after opening it.</p>
      {loading && <p role="status">Preparing your private invitation…</p>}
      {error && <div className="share-family-error"><p role="alert">{error}</p><button type="button" onClick={() => void prepare()}>Try again</button></div>}
      {url && <>
        <div className="share-family-actions">{canShare && <button type="button" onClick={share}><ShareIcon />Share with AirDrop</button>}<button type="button" className="secondary" onClick={copy}>Copy family link</button></div>
        <p className="share-family-hint">{canShare ? 'On iPhone, choose AirDrop in the share sheet, then choose your helper. You can also choose Messages.' : 'Copy the link and send it in a message or use your phone’s sharing options.'}</p>
        {manualCopy && <div className="share-family-manual"><label htmlFor={id + '-link'}>Private family link<textarea id={id + '-link'} ref={manual} value={url} readOnly rows={3} spellCheck={false} onFocus={event => event.target.select()} /></label><button type="button" className="secondary" onClick={() => { manual.current?.focus(); manual.current?.select() }}>Select link</button></div>}
      </>}
      {notice && <p className="share-family-notice" role="status">{notice}</p>}
    </div>}
  </section>
}

function ShareIcon() {
  return <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M7 10H4v11h16V10h-3" /></svg>
}
