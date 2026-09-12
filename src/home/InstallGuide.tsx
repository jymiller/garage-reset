import { useEffect, useState } from 'react'
import './install.css'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function useStandalone() {
  const [standalone, setStandalone] = useState(isStandalone)
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const update = () => setStandalone(isStandalone())
    media.addEventListener('change', update)
    window.addEventListener('pageshow', update)
    return () => {
      media.removeEventListener('change', update)
      window.removeEventListener('pageshow', update)
    }
  }, [])
  return standalone
}

export function InstallHomeLink({ onShowGuide }: { onShowGuide: () => void }) {
  const standalone = useStandalone()
  if (standalone) return null
  return <button type="button" className="install-home-link" onClick={onShowGuide}>
    <img src="/icons/apple-touch-icon.png" alt="" width="52" height="52" />
    <span><strong>Put Garage Reset on your iPhone</strong><small>Your own app icon. One tap to start.</small></span>
    <span aria-hidden="true">→</span>
  </button>
}

export function InstallGuide() {
  const standalone = useStandalone()
  return <section className="install-guide" aria-labelledby="install-heading">
    <div className="install-heading"><img src="/icons/apple-touch-icon.png" alt="" width="72" height="72" /><div><span>GARAGE RESET FOR IPHONE</span><h2 id="install-heading">{standalone ? 'You’re in the Home Screen app.' : 'Your garage, one tap away.'}</h2></div></div>
    {standalone ? <p>Open this icon whenever you’re ready to sort. Your crates, missions and scores share with the laptop when connected.</p> : <>
      <p>Add Garage Reset to your iPhone’s Home Screen. It opens in its own window, without Safari’s address bar.</p>
      <ol role="list">
        <li><b>Open Garage Reset in Safari.</b><span>Use the family link you already open on your phone. Wait for your changes to finish syncing.</span></li>
        <li><b>Tap Share <ShareIcon />.</b><span>You may need to tap Safari’s More (…) button first.</span></li>
        <li><b>Choose Add to Home Screen.</b><span>Scroll down the share menu to find it.</span></li>
        <li><b>Keep Open as Web App on, then tap Add.</b><span>If that switch isn’t shown, just tap Add. Look for the Garage Reset icon on your Home Screen.</span></li>
      </ol>
      <a className="install-apple-help" href="https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios" target="_blank" rel="noreferrer">See Apple’s illustrated instructions ↗</a>
    </>}
    <details className="install-details"><summary>What carries over?</summary><p>This is the Home Screen web app. It uses the same shared crates, photos, missions and scores as your laptop. It needs a connection to open, upload photos and sync.</p><p>If it asks for access, paste your existing family link once. Unsent drafts and device-only planning settings may stay in the browser where you made them; finish syncing and keep that browser available.</p></details>
  </section>
}

function ShareIcon() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M7 10H4v11h16V10h-3" /></svg>
}
