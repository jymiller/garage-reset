import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Tab } from '../App'
import { useStore } from '../store'
import { useWorkspace } from '../crates/useWorkspace'
import { missionProgress } from '../play/mission'
import { BAGS, evaluatePlacement, footprint, sanitizeSettings, suggestPlacement } from './placement'
import type { BagSize, Placement, Site } from './placement'
import './pickup.css'
import { CurrentSurvey } from './CurrentSurvey'

const PickupScene = lazy(() => import('./PickupScene').then(m => ({ default: m.PickupScene })))
const KEY = 'garage-reset-pickup-v1'
const initial = () => { try { return sanitizeSettings(JSON.parse(localStorage.getItem(KEY) ?? 'null')) } catch { return sanitizeSettings(null) } }
const feet = (n: number) => `${Math.floor(n)}′ ${Math.round((n % 1) * 12)}″`

function PlanMap({ site, placement, size, onPlace, valid }: { site: Site; placement: Placement; size: BagSize; onPlace: (x: number, y: number) => void; valid: boolean }) {
  const ref = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const bag = footprint(size, placement.rotated)
  const margin = 5, w = site.width + margin * 2, h = site.depth + 13
  function move(e: ReactPointerEvent<SVGSVGElement>) {
    const svg = ref.current
    if (!svg) return
    const matrix = svg.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse())
    onPlace(Math.round((point.x - margin - bag.width / 2) * 4) / 4, Math.round((site.depth + 5 - point.y - bag.depth / 2) * 4) / 4)
  }
  return <svg ref={ref} className="pickup-map" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Editable pickup footprint. Yellow bag on outdoor apron; road at bottom. Use position fields for keyboard placement."
    onPointerDown={e => { if (e.button !== 0) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); move(e) }}
    onPointerMove={e => { if (dragging.current) move(e) }} onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }}>
    <defs><pattern id="pickup-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#334a48" strokeWidth=".025" /></pattern></defs>
    <rect width={w} height={h} fill="#152323" />
    <rect x={margin} y="0" width={site.width} height="5" fill="#263838" />
    <text x={w / 2} y="2.1" textAnchor="middle" className="map-label">COVERED GARAGE · NO PICKUP</text>
    <text x={w / 2} y="3.7" textAnchor="middle" className="map-small">to your storage section ↑</text>
    <rect x={margin} y="5" width={site.width} height={site.depth} fill="url(#pickup-grid)" stroke="#79938b" strokeWidth=".07" />
    <rect x={margin} y={site.depth + 5 - site.sidewalkDepth} width={site.width} height={site.sidewalkDepth} fill="#ac7964" opacity=".25" />
    <text x={w / 2} y={site.depth + 5 - site.sidewalkDepth / 2} textAnchor="middle" className="map-label">SIDEWALK · KEEP CLEAR</text>
    <rect x={margin + site.width / 2 - 2} y="5" width="4" height={site.depth} fill="#8bf0d0" opacity=".07" />
    <line x1={w / 2} y1="6" x2={w / 2} y2={site.depth + 4} stroke="#74cab0" strokeWidth=".08" strokeDasharray=".3 .3" />
    {site.depth > 20 && <line x1={margin} x2={margin + site.width} y1={site.depth - 15} y2={site.depth - 15} stroke="#ee9978" strokeWidth=".1" strokeDasharray=".5 .3" />}
    <rect x="0" y={site.depth + 5.2} width={w} height="7.8" fill="#0d181b" />
    <line x1="0" x2={w} y1={site.depth + 5.3} y2={site.depth + 5.3} stroke="#b6bfaa" strokeWidth=".16" />
    <line x1="0" x2={w} y1={site.depth + 9.2} y2={site.depth + 9.2} stroke="#c6b886" strokeWidth=".1" strokeDasharray="1.5 1.5" />
    <text x={w / 2} y={site.depth + 8} textAnchor="middle" className="map-label">PUBLIC ROAD · TRUCK STAYS HERE</text>
    <g transform={`translate(${margin + placement.x},${site.depth + 5 - placement.y - bag.depth})`}>
      <rect width={bag.width} height={bag.depth} rx=".15" fill="#f2d458" stroke={valid ? '#fff1a6' : '#fc997c'} strokeWidth=".16" />
      <rect x=".25" y=".25" width={Math.max(.1, bag.width - .5)} height={Math.max(.1, bag.depth - .5)} fill="#b89633" opacity=".6" />
      <text x={bag.width / 2} y={bag.depth / 2 + .15} textAnchor="middle" className="map-bag">YELLOWSACK</text>
    </g>
    <line x1={margin + placement.x + bag.width + .6} x2={margin + placement.x + bag.width + .6} y1={site.depth + 5 - placement.y - bag.depth} y2={site.depth + 5} stroke="#f2d458" strokeWidth=".1" strokeDasharray=".2 .2" />
    <text x={margin + site.width / 2} y={site.depth + 12} textAnchor="middle" className="map-small">Click or drag to place · dimensions in feet</text>
  </svg>
}

export function PickupPlanner({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [settings, setSettings] = useState(initial)
  const [view, setView] = useState<'perspective' | 'map' | 'photo'>('photo')
  const [saved, setSaved] = useState(true)
  const [evidence, setEvidence] = useState(false)
  const [exported, setExported] = useState(false)
  const { items } = useStore()
  const sharedWorkspace = useWorkspace()
  const rounds = missionProgress(sharedWorkspace.data.missions)
  const { site, placement, size, checks, fill } = settings
  const bag = BAGS[size], dimensions = footprint(size, placement.rotated)
  const evaluation = evaluatePlacement(site, placement, size)
  const complete = Object.values(checks).every(Boolean)
  const geometryGood = evaluation.inside && evaluation.sidewalkClear && evaluation.withinReach && evaluation.roadWideEnough && evaluation.walkwayClear
  const confirmed = Object.values(checks).filter(Boolean).length
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(settings)); setSaved(true) } catch { setSaved(false) } }, [settings])
  function place(x: number, y: number) { if (!Number.isFinite(x) || !Number.isFinite(y)) return; if (view === 'photo') setView('map'); setSettings(s => ({ ...s, placement: { ...s.placement, x: Math.min(100, Math.max(-20, x)), y: Math.min(100, Math.max(-20, y)) }, checks: { ...s.checks, openSky: false, privateGround: false, truckAccess: false, handles: false } })) }
  function adjustSite(key: keyof Site, value: number) {
    if (!Number.isFinite(value)) return
    setSettings(s => ({ ...s, site: { ...s.site, [key]: Math.max(key === 'sidewalkDepth' ? 0 : 4, Math.min(key === 'sidewalkDepth' ? 20 : key === 'roadWidth' ? 60 : 80, value)) }, checks: { measured: false, openSky: false, privateGround: false, truckAccess: false, handles: false } }))
  }
  function chooseSize(next: BagSize) { setSettings(s => ({ ...s, size: next, checks: { ...s.checks, openSky: false, privateGround: false, truckAccess: false, handles: false } })) }
  function suggest(side: 'left' | 'right') {
    if (view === 'photo') setView('map')
    const next = suggestPlacement(site, size, side)
    setSettings(s => ({ ...s, placement: next, checks: { ...s.checks, openSky: false, privateGround: false, truckAccess: false, handles: false } }))
  }
  function exportPlan() {
    const text = ['GARAGE RESET — PICKUP PLAN', new Date().toLocaleString(), '', 'Candidate to measure: apron outside the garage, right of center when facing street, left of the pale utility strip, behind the pedestrian path. Long bag side parallel curb. Photos do not establish dimensions, ownership boundary or overhead clearance.',
      `Status: ${complete && geometryGood ? 'User checks complete; confirm collection with Yellowsack.' : 'Unverified candidate — complete measurements and access checks before filling.'}`,
      `Bag: ${size}, ${feet(bag.width)} × ${feet(bag.depth)} × ${feet(bag.height)}, ${bag.volume} cubic yards, 3,000 lb maximum.`,
      `Frontage: ${site.width} ft wide × ${site.depth} ft road-to-roof deep. Reserved sidewalk depth from road: ${site.sidewalkDepth} ft. Road: ${site.roadWidth} ft wide. ${checks.measured ? 'User marked measured.' : 'ILLUSTRATIVE dimensions, not measured.'}`,
      `Bag min corner: ${placement.x} ft from left apron edge (top-down map), ${placement.y} ft from road edge. Rotated: ${placement.rotated}.`,
      `Modeled farthest-edge distance to road: ${evaluation.roadDistance.toFixed(2)} ft. Provider rule: less than 20 ft. Measurement convention is ours, not a provider guarantee.`,
      `Geometry: inside frontage ${evaluation.inside}; sidewalk clear ${evaluation.sidewalkClear}; reach ${evaluation.withinReach}; road at least 14ft ${evaluation.roadWideEnough}; chosen 4ft center carry lane clear ${evaluation.walkwayClear}.`,
      ...Object.entries(checks).map(([key, value]) => `${key}: ${value ? 'USER CONFIRMED' : 'NOT CONFIRMED'}`),
      '', 'Keep both car spaces usable. The user confirmed the white floor line marks parking clearance. Sort one small batch at a time, with keepers returned to assigned containers and approved bag-compatible waste taken to the outdoor sack. Place the empty sack at its collection spot before filling; avoid a plan that requires moving it loaded.',
      'Yellowsack says public-sidewalk placement requires scheduling pickup right away; no universal overnight limit was found. San Francisco permission requirements still need checking for public-right-of-way placement.',
      'Keep lifting handles accessible and contents below walls. Propane, paint, batteries and hazardous waste need separate disposal.',
      'Official rules: https://yellowsack.com/how-to-use', 'Official sizes and access: https://yellowsack.com/faq', 'Waste rules: https://yellowsack.com/pricing',
      'This is a planning aid; no pickup has been booked or approved.'].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a'); a.href = url; a.download = 'garage-pickup-plan.txt'; a.click(); URL.revokeObjectURL(url); setExported(true)
  }
  return <div className="pickup-app">
    <aside className="pickup-sidebar">
      <button className="pickup-brand" onClick={() => onNavigate('pickup')} aria-label="Garage Reset pickup planner"><span className="brand-mark">G<span>↗</span></span><span>GARAGE<br /><strong>RESET</strong></span></button>
      <span className="nav-caption">YOUR WORKSPACE</span>
      <nav aria-label="Workspace"><button className="active"><span>▱</span> Pickup planner <i /></button><button onClick={() => onNavigate('crates')}><span>▣</span> Crate lab</button><button onClick={() => onNavigate('layout')}><span>◇</span> Garage model</button><button onClick={() => onNavigate('play')}><span>▶</span> Photo missions</button><button onClick={() => onNavigate('capture')}><span>⊞</span> Inventory <small>{items.length}</small></button><button onClick={() => onNavigate('people')}><span>♧</span> The crew</button></nav>
      <div className="sidebar-mission"><span className="nav-caption">THE BIG PICTURE</span><h3>Less stuff.<br />More garage.</h3><div className="mission-progress"><i style={{ width: `${(rounds.completedCount%3)/3*100}%` }} /></div><p>{rounds.completedCount} photo rounds · {rounds.points} XP</p><button onClick={() => onNavigate('play')}>Make the next small win <span>↗</span></button></div>
      <div className="sidebar-footer"><span className="user-avatar">J</span><div>John’s garage<small>Personal workspace</small></div><span className="online-dot" /></div>
    </aside>
    <div className="pickup-workspace">
      <header className="pickup-topbar"><div><span>WORKSPACE</span><b>/</b> Pickup planner</div><span className="save-status"><i className={saved ? 'online-dot' : 'warning-dot'} />{saved ? 'Saved on this device' : 'Storage unavailable · export your plan'}</span></header>
      <div className="pickup-content">
        <div className="crate-entry"><div><span className="eyebrow">NEW / THE GARAGE IS THE GAME</span><strong>Less crap. More victory.</strong><p>Take a before photo. Finish one small patch. Capture the win.</p></div><button onClick={() => onNavigate('play')}>Play a photo mission →</button></div><div className="pickup-heading"><div><div className="eyebrow">OPERATION: GET IT OUT</div><h1>Give the bag a home.</h1><p>Find the pickup spot. Clear the path. Reclaim your garage.</p></div><button className="export-button" onClick={exportPlan}>↓ {exported ? 'Download again' : 'Export pickup plan'}</button></div>
        <div className="placement-recommendation"><span className="recommendation-icon">↗</span><div><strong>Test the apron, just left of the pale utility strip.</strong><p>Outside the doorway, right of center facing the street. Long side parallel to the curb. Keep behind the pedestrian path and off the utility covers; verify slope, property boundary, overhead wires and vehicle access before filling.</p></div><button onClick={() => setEvidence(!evidence)}>{evidence ? 'Hide evidence' : 'Why this spot?'} <span>↗</span></button></div>
        {evidence && <section className="evidence-panel"><a href="/evidence/street.jpg" target="_blank" rel="noreferrer"><img src="/evidence/street.jpg" alt="Your new photo looking from the garage onto the apron, pedestrian route and street, with wires overhead" /><span>Your photo · Apron, pedestrian route & wires</span></a><div><h3>Your photos narrow the search.</h3><p>The central apron is the area to measure. The pale strip contains utility access covers, the pedestrian route crosses the frontage, and wires are visible toward the street. The photos cannot establish an exact footprint, property line or crane clearance.</p><a href="/evidence/polycam-june-25.png" target="_blank" rel="noreferrer">Open original interior Polycam floor plan ↗</a><button onClick={() => onNavigate('layout')}>Open the updated garage model →</button></div></section>}
        <section className="pickup-timing"><div><span className="eyebrow">TIMING MATTERS · GUIDANCE CHECKED SEPTEMBER 9</span><h2>Fill the bag. Keep both car spaces.</h2><p>Your working plan is an outdoor sack and two usable car spaces. Fill the bag where it will be collected, and sort one small batch at a time along the shelves. Yellowsack requests immediate pickup scheduling for public-sidewalk placement; no blanket private-property overnight limit was found.</p><div className="timing-links"><a href="https://yellowsack.com/how-to-use" target="_blank" rel="noreferrer">Yellowsack placement & timing ↗</a><a href="https://sfpublicworks.org/services/permits/debris-box-permit" target="_blank" rel="noreferrer">SF sidewalk permission guidance ↗</a></div><p className="fine-print">Scheduling pickup does not itself grant permission to occupy public space. Ask Yellowsack / SF Public Works about the requirements for your exact sack and location.</p></div><button onClick={() => document.getElementById('current-survey')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}><strong>6 new photos</strong><span>Two-car sorting plan ↓</span></button></section>
        <div className="planner-grid">
          <section className="scene-panel">
            <div className="scene-toolbar"><div><span className="eyebrow">PICKUP AREA</span><h2>Street-side placement</h2></div><div className="view-switch" aria-label="View mode"><button aria-pressed={view === 'photo'} className={view === 'photo' ? 'selected' : ''} onClick={() => setView('photo')}>Photo</button><button aria-pressed={view === 'perspective'} className={view === 'perspective' ? 'selected' : ''} onClick={() => setView('perspective')}>◇ 3D</button><button aria-pressed={view === 'map'} className={view === 'map' ? 'selected' : ''} onClick={() => setView('map')}>▱ Plan</button></div></div>
            <div className={`scene-stage ${view === 'photo' ? 'photo-stage' : ''}`}><div className={`scene-tag ${checks.measured ? 'verified' : ''}`}><i />{view === 'photo' ? 'Your photo · proposed area, not a scaled bag' : checks.measured ? 'Dimensions confirmed by you' : 'Illustrative exterior · not measured'}</div>
              {view === 'photo' ? <svg className="photo-plan" viewBox="0 0 1280 960" role="img" aria-label="Your apron photo with an approximate area to measure outlined in yellow below the pedestrian route, left of the utility covers. Not a scaled bag or a confirmed position."><image href="/evidence/apron.jpg" width="1280" height="960" /><path d="M0 204 L1205 194 L1240 467 L0 475 Z" fill="#f19871" opacity=".18" /><path d="M420 560 L720 548 L790 820 L350 836 Z" fill="#f4d058" fillOpacity=".24" stroke="#ffe58d" strokeWidth="6" strokeDasharray="16 9" /><path d="M830 324 L718 568" stroke="#ffe58d" strokeWidth="4" /><rect x="675" y="265" width="440" height="66" rx="8" fill="#1c312a" /><text x="695" y="308" fill="#ffe195" fontFamily="Arial,sans-serif" fontSize="26" fontWeight="700">MEASURE THIS AREA FIRST</text><rect x="30" y="220" width="550" height="54" rx="6" fill="#352b25" /><text x="49" y="256" fill="#ffcfb3" fontFamily="Arial,sans-serif" fontSize="23">PEDESTRIAN ROUTE · KEEP CLEAR</text></svg> : view === 'perspective' ? <Suspense fallback={<div className="scene-loading">Building your pickup scene…</div>}><PickupScene site={site} placement={placement} size={size} onPlace={place} view="perspective" valid={geometryGood} fill={fill} /></Suspense> : <PlanMap site={site} placement={placement} size={size} onPlace={place} valid={geometryGood} />}
              <div className="scene-help">{view === 'photo' ? 'Approximate area only · sidewalk and property boundaries need checking' : view === 'perspective' ? 'Drag to orbit · Scroll to zoom · Click apron to place bag' : 'Click or drag to place the bag · Use fields below for precise placement'}</div>
            </div>
            <div className="scene-legend"><span><i className="legend-bag" />Your bag</span><span><i className="legend-lane" />4 ft carry lane · your planning buffer</span><span><i className="legend-road" />Illustrative truck</span></div>
            <div className="placement-tools"><span>Try a candidate</span><button onClick={() => suggest('left')}>↙ Left side</button><button onClick={() => suggest('right')}>Right side ↘</button><button onClick={() => { if (view === 'photo') setView('map'); setSettings(s => ({ ...s, placement: { ...s.placement, rotated: !s.placement.rotated }, checks: { ...s.checks, openSky: false, privateGround: false, truckAccess: false, handles: false } })) }}>⟳ Rotate 90°</button></div>
            <div className="position-fields"><label>From left edge <span><input aria-label="Bag distance from left edge" type="number" min="-20" max="100" step="0.25" value={placement.x} onChange={e => { if (e.target.value !== '') place(e.target.valueAsNumber, placement.y) }} />ft</span></label><label>From road edge <span><input aria-label="Bag distance from road edge" type="number" min="-20" max="100" step="0.25" value={placement.y} onChange={e => { if (e.target.value !== '') place(placement.x, e.target.valueAsNumber) }} />ft</span></label><p>Coordinates follow the Plan view.<br />Bag footprint: {feet(dimensions.width)} × {feet(dimensions.depth)}</p></div>
          </section>
          <aside className="pickup-inspector">
            <section className="bag-card"><div className="eyebrow">YOUR HEAVY LIFTER</div><div className="bag-card-title"><h2>Yellowsack</h2><span>↗</span></div><div className="bag-choice">{(['large', 'medium'] as BagSize[]).map(s => <button key={s} aria-pressed={size === s} className={size === s ? 'selected' : ''} onClick={() => chooseSize(s)}><strong>{s === 'large' ? 'Large' : 'Medium'}</strong><small>{BAGS[s].volume} yd³</small></button>)}</div><div className="bag-spec"><span>{feet(bag.width)} × {feet(bag.depth)}<small>FOOTPRINT</small></span><span>3,000 lb<small>MAX WEIGHT</small></span></div><p>{feet(bag.height)} high · Confirm the size on your bag.</p></section>
            <section className="pickup-checks"><div className="eyebrow">{checks.measured ? 'PLACEMENT CHECK' : 'EXAMPLE MODEL · NOT PHOTO MEASUREMENTS'}</div><div className={`placement-status ${complete && geometryGood ? 'ready' : ''}`}><span>{!geometryGood ? '↔' : complete ? '✓' : '◌'}</span><h2>{!geometryGood ? 'Adjust this position' : complete ? 'Candidate checks complete' : 'Candidate, not confirmed'}</h2></div><p className="status-explainer">{complete && geometryGood ? 'Your checks are complete. Confirm collection suitability with Yellowsack before filling.' : checks.measured ? 'The drawing can check distance. You confirm the real-world clearance.' : 'These checks use example dimensions until you enter measurements. The photo outline is a separate area to investigate.'}</p>
              <div className="distance-metric"><strong>{evaluation.roadDistance.toFixed(1)}<span> ft</span></strong><span>modeled distance<br />to public road</span><b className={evaluation.withinReach ? 'pass' : 'fail'}>{evaluation.withinReach ? '< 20 ft' : 'OUT OF REACH'}</b></div>
              <ul className="geometry-list"><li className={evaluation.inside ? 'pass' : 'fail'}><span>{evaluation.inside ? '✓' : '!'}</span>{evaluation.inside ? 'Bag fits inside the drawn frontage' : 'Bag extends outside the drawn frontage'}</li><li className={evaluation.sidewalkClear ? 'pass' : 'fail'}><span>{evaluation.sidewalkClear ? '✓' : '!'}</span>{evaluation.sidewalkClear ? 'Reserved sidewalk stays clear' : 'Bag overlaps the reserved sidewalk'}</li><li className={evaluation.walkwayClear ? 'pass' : 'fail'}><span>{evaluation.walkwayClear ? '✓' : '!'}</span>{evaluation.walkwayClear ? 'Chosen center carry lane stays clear' : 'Bag overlaps your center carry lane'}</li><li className={evaluation.roadWideEnough ? 'pass' : 'fail'}><span>{evaluation.roadWideEnough ? '✓' : '!'}</span>{evaluation.roadWideEnough ? 'Entered road width meets 14 ft minimum' : 'Entered road width is below 14 ft minimum'}</li></ul>
              <p className="measurement-note">Distance uses the farthest bag edge to the modeled road edge, a conservative planning convention. Truck location does not extend the 20 ft zone.</p>
            </section>
          </aside>
        </div>
        <CurrentSurvey />
        <div className="planning-details">
          <section className="site-card"><div className="section-heading"><div><span className="eyebrow">01 / MEASURE THE SPOT</span><h2>Make this your driveway.</h2></div><span className={`small-pill ${checks.measured ? 'checked' : ''}`}>{checks.measured ? 'Measured' : 'Example dimensions'}</span></div><p>Measure road edge to garage roof, then reserve the full pedestrian route. Only use ground you’re allowed to occupy; do not infer ownership from paving.</p><div className="site-inputs">{([['width','Frontage width'],['depth','Road → roof'],['roadWidth','Road width'],['sidewalkDepth','Road → path back']] as const).map(([key,label]) => <label key={key}>{label}<span><input type="number" min={key === 'sidewalkDepth' ? '0' : '4'} max={key === 'sidewalkDepth' ? '20' : key === 'roadWidth' ? '60' : '80'} step="0.5" value={site[key]} onChange={e => { if (e.target.value !== '') adjustSite(key, e.target.valueAsNumber) }} />ft</span></label>)}</div><label className="check-row"><input type="checkbox" checked={checks.measured} onChange={e => setSettings(s => ({ ...s, checks: { ...s.checks, measured: e.target.checked } }))} /><span>I measured these dimensions on site.</span></label><p className="fine-print">For the large bag, test a 6′7″ × 3′3″ rectangle behind the pedestrian route. Your apron slopes: ask Yellowsack whether that exact spot is suitable.</p></section>
          <section className="field-card"><div className="section-heading"><div><span className="eyebrow">02 / CHECK IT IN PERSON</span><h2>Walk the pickup spot.</h2></div><span className="check-count">{confirmed}/5</span></div><p>Recheck these after moving or rotating the bag.</p>{([
            ['openSky','Open sky above the bag','No roof, garage door, wires or branches in the lifting path.'],
            ['privateGround','Ground and access are suitable','Allowed location; clear of sidewalk, utility covers and vehicle route. Slope checked with Yellowsack.'],
            ['truckAccess','Truck can access the public road','No blocking cars; road width checked. No assumed driveway entry.'],
            ['handles','Walking route and lifting handles accessible','Keep contents below the walls and the handles free.']
          ] as const).map(([key,title,note]) => <label className="check-row" key={key}><input type="checkbox" checked={checks[key]} onChange={e => setSettings(s => ({ ...s, checks: { ...s.checks, [key]: e.target.checked } }))} /><span><strong>{title}</strong><small>{note}</small></span></label>)}</section>
          <section className="load-card"><div className="section-heading"><div><span className="eyebrow">03 / THEN FILL IT</span><h2>Let the purge begin.</h2></div><span>↗</span></div><p>Keep the bag at its collection spot. Each finished sorting batch sends approved waste straight outside, with both car spaces left clear.</p><div className="fill-heading"><span>Your fill estimate</span><strong>{fill}%</strong></div><input aria-label="Estimated bag fill percentage" className="fill-slider" type="range" min="0" max="100" step="5" value={fill} onChange={e => setSettings(s => ({ ...s, fill: Number(e.target.value) }))} /><p className="fine-print">Volume estimate only. This does not measure weight.</p><div className="keep-out"><strong>Separate pile, please.</strong><p>Propane cylinders, paint, batteries, chemicals and treated wood stay out. Dirt and concrete require the medium bag.</p></div><button className="inventory-link" onClick={() => onNavigate('capture')}>Open your inventory <span>→</span></button></section>
        </div>
        <footer className="planner-footer"><span>Built from your garage, with room for what’s next.</span><div><a href="https://yellowsack.com/how-to-use" target="_blank" rel="noreferrer">Placement rules ↗</a><a href="https://yellowsack.com/faq" target="_blank" rel="noreferrer">Bag & access specs ↗</a><a href="https://yellowsack.com/pricing" target="_blank" rel="noreferrer">Waste rules ↗</a></div></footer>
      </div>
    </div>
  </div>
}
