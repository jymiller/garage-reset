import { useState } from 'react'
import { latestPhotoSurvey, photoSurvey } from './surveyData'

const allPhotos = [...latestPhotoSurvey, ...photoSurvey]
const findings = [
  {
    id: 'IMG_1929', label: '01 / PROTECT THE PARKING', title: 'The white line is the limit.',
    alt: 'Storage racks behind the white parking clearance line',
    detail: 'You confirmed this is the parking clearance boundary. Keep both car spaces and their access free of sorting piles.',
  },
  {
    id: 'IMG_1927', label: '02 / FIRST PHYSICAL MOVES', title: 'Clear the floor at the tool corner.',
    alt: 'Chair, carton and stool in front of the wooden cupboard and tool chest',
    detail: 'Store the folding chair, reposition the stool and carton, and secure the pink cord. Give each a home off the carry route.',
  },
  {
    id: 'IMG_1930', label: '03 / USE WHAT YOU HAVE', title: 'One shelf section. One open box.',
    alt: 'Wall shelving with existing labeled totes and loose gear above',
    detail: 'Start with a small patch of loose shelf items. Put keepers into the existing labeled containers; finish the batch before opening another.',
  },
]
const destinations = [
  { label: 'KEEP', detail: 'Straight to its assigned shelf or labeled container.' },
  { label: 'SACK', detail: 'Approved, bag-compatible waste goes directly outside.' },
  { label: 'DONATE', detail: 'One outbound box with a departure date.' },
  { label: 'ASK OWNER', detail: 'One labeled holding tote; resolve it when full.' },
]

export function CurrentSurvey() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('IMG_1929')
  const [batch, setBatch] = useState<'latest' | 'morning'>('latest')
  const photo = allPhotos.find(p => p.id === selected) ?? latestPhotoSurvey[0]
  const isLatest = latestPhotoSurvey.some(p => p.id === photo.id)
  const visiblePhotos = batch === 'latest' ? latestPhotoSurvey : photoSurvey

  function selectBatch(next: 'latest' | 'morning') {
    setBatch(next)
    setSelected(next === 'latest' ? 'IMG_1929' : 'IMG_1912')
  }

  return <section className="current-survey" id="current-survey">
    <div className="survey-header">
      <div>
        <span className="eyebrow">LATEST CONDITIONS · SEPTEMBER 9, 2026</span>
        <h2>Two cars. One box at a time.</h2>
        <p>6 new photos from 1:49–1:50 PM · {allPhotos.length} photos across today’s two surveys.</p>
      </div>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="survey-review">
        {open ? 'Close photo review' : `Review ${allPhotos.length} photos`} <span>↗</span>
      </button>
    </div>
    <div className="parking-rule">
      <span>CONFIRMED BY YOU</span>
      <p>The white floor line marks parking clearance. Preserve both car spaces, door clearance and the route out at the end of every batch.</p>
    </div>
    <div className="survey-findings">
      {findings.map(finding => <button key={finding.id} onClick={() => { setSelected(finding.id); setBatch('latest'); setOpen(true) }}>
        <img src={`/evidence/2026-09-09/${finding.id}.jpg`} alt={finding.alt} loading="lazy" />
        <span><small>{finding.label}</small><strong>{finding.title}</strong><p>{finding.detail}</p></span>
      </button>)}
    </div>
    <div className="sorting-flow" aria-label="Four sorting destinations">
      {destinations.map(destination => <div key={destination.label}><strong>{destination.label}</strong><p>{destination.detail}</p></div>)}
    </div>
    <p className="survey-boundary">The latest views show the shelf fronts and one SUV near the rack end. They do not establish the second car’s position or measured clearance. Object ownership and disposal decisions remain yours; the garage model now uses the June scan outline with approximate photo-based object positions.</p>
    {open && <div className="survey-review" id="survey-review">
      <div className="survey-photo"><a href={photo.src} target="_blank" rel="noreferrer"><img src={photo.src} alt={photo.observed} /></a></div>
      <div className="survey-caption">
        <span className="eyebrow">{photo.id} · {isLatest ? '1:49–1:50 PM UPDATE' : '10:46–10:47 AM REFERENCE'}</span>
        <h3>{photo.title}</h3><p>{photo.observed}</p>
        <div className="survey-next-step"><span className="eyebrow">NEXT MOVE TO CONSIDER</span><p>{photo.nextStep}</p></div>
        <a href={photo.src} target="_blank" rel="noreferrer">Open full photo ↗</a>
        <div className="survey-batches" role="group" aria-label="Choose a photo survey">
          <button aria-pressed={batch === 'latest'} onClick={() => selectBatch('latest')}>Latest · 6</button>
          <button aria-pressed={batch === 'morning'} onClick={() => selectBatch('morning')}>Morning · 11</button>
        </div>
        <div className="survey-thumbs" role="group" aria-label="Choose a garage photo">
          {visiblePhotos.map(p => <button key={p.id} onClick={() => setSelected(p.id)} aria-label={`Review ${p.id}: ${p.title}`} aria-pressed={p.id === selected}>
            <img src={p.src} alt="" loading="lazy" /><span>{p.id.slice(-4)}</span>
          </button>)}
        </div>
      </div>
    </div>}
  </section>
}
