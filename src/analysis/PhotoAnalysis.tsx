import { useEffect, useRef, useState } from 'react'
import type { AnalysisRecord } from './contract.mjs'
import { usePhotoAnalysis } from './usePhotoAnalysis'
import './photo-analysis.css'

function downloadMetadata(record: AnalysisRecord) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${record.photoFilename.replace(/\.[^.]+$/, '')}-analysis.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function PhotoAnalysis({ photo, compact = false }: { photo: string; compact?: boolean }) {
  const root = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const { filename, record, loaded, issue, timedOut, retrying, checkAgain, tryAnalysis } = usePhotoAnalysis(photo, visible)

  useEffect(() => {
    if (!root.current) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)))
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])

  if (!filename) return null
  const pending = record?.status === 'queued' || record?.status === 'processing'
  const result = record?.status === 'complete' ? record.result : null
  const unavailable = record?.errorCode === 'not_configured'

  return <section ref={root} className={`photo-analysis${compact ? ' is-compact' : ''}`} aria-label="Photo analysis">
    {result ? <>
      <p className="photo-analysis-summary" title={result.summary}><span className="photo-analysis-ai">AI</span>{result.summary}</p>
      <details className="photo-analysis-details">
        <summary>What’s here <span>{result.objects.length}</span></summary>
        <p className="photo-analysis-note">Suggestions to confirm. Inventory and measurements stay unchanged.</p>
        {result.summary && <p className="photo-analysis-full-summary">{result.summary}</p>}
        {result.objects.length ? <ul className="photo-analysis-objects">{result.objects.map(item => <li key={item.id}>
          <div className="photo-analysis-object-heading"><strong>{item.name}{item.quantity !== null && item.quantity > 1 ? ` × ${item.quantity}` : ''}</strong><span className={`photo-analysis-confidence confidence-${item.confidence}`}>{item.confidence} confidence</span></div>
          <p>{item.evidence}</p>
          {(item.readableLabel || item.locationHint) && <p className="photo-analysis-object-context">{[item.readableLabel ? `Label: ${item.readableLabel}` : null, item.locationHint].filter(Boolean).join(' · ')}</p>}
          {item.suggestedCrateId && <p className="photo-analysis-object-context">Possible crate: {item.suggestedCrateId}</p>}
        </li>)}</ul> : <p className="photo-analysis-note">No individual objects identified.</p>}
        {result.questions.length > 0 && <div className="photo-analysis-questions"><h3>A closer look?</h3><ul>{result.questions.map((question, index) => <li key={index}>{question}</li>)}</ul></div>}
        <button type="button" className="photo-analysis-button" onClick={() => downloadMetadata(record!)}>Download analysis JSON ↓</button>
      </details>
    </> : <>
      <p className="photo-analysis-state" role="status">{retrying ? 'Starting analysis…' : issue || (timedOut ? 'Still working. Check again later.' : pending ? 'Learning from this photo…' : !loaded ? 'Checking photo analysis…' : unavailable ? 'Analysis is not set up yet.' : record?.status === 'failed' ? 'Analysis couldn’t finish.' : 'Not analyzed yet.')}</p>
      {!retrying && (issue || timedOut) ? <button type="button" className="photo-analysis-button" onClick={checkAgain}>Check again</button> : !retrying && loaded && !pending && <button type="button" className="photo-analysis-button" onClick={() => { void tryAnalysis() }}>Try analysis</button>}
      {record && !pending && <details className="photo-analysis-download"><summary>Analysis details</summary><button type="button" className="photo-analysis-button" onClick={() => downloadMetadata(record)}>Download analysis JSON ↓</button></details>}
    </>}
  </section>
}
