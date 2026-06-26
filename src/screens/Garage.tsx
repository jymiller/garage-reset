import { useState, lazy, Suspense } from 'react'
import { garage } from '../garage/model'
import type { Box, PlacedObject } from '../garage/model'
import { zoneName, personName } from '../data'
import { zoneColors, arcDecision } from '../theme'

const Plan3D = lazy(() => import('../garage/Plan3D').then((m) => ({ default: m.Plan3D })))

type View = '2d' | '3d'

const SCALE = 15 // px per foot
const M = 16 // margin px
const W = garage.width // back wall → allotment line
const D = garage.depth
const PB = garage.parkingBeyond // faded shared strip east of the line
const TOTX = W + PB
const svgW = TOTX * SCALE + M * 2
const svgH = D * SCALE + M * 2

type Mode = 'now' | 'plan'

const px = (b: Box) => ({
  x: M + b.x * SCALE,
  y: M + b.y * SCALE,
  width: b.w * SCALE,
  height: b.d * SCALE,
})

const colorOf = (o: PlacedObject) => zoneColors[o.id === 'car' ? 'car' : o.zone ?? 'shared-storage']

export function Garage() {
  const [mode, setMode] = useState<Mode>('now')
  const [view, setView] = useState<View>('2d')
  const [selected, setSelected] = useState<string | null>(null)
  const { features, objects } = garage
  const sel = objects.find((o) => o.id === selected) ?? null

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-pixel text-sm text-[#2bd14a]">MAP — YOUR SECTION</h1>
        <p className="arc-vt mt-1 text-[#8a8aa6]">
          <span className="text-[#ffd23f]">NOW</span> = STUFF OVER THE LINE · <span className="text-[#2bd14a]">PLAN</span> = CONTAINED
        </p>
      </header>

      <div className="flex gap-2">
        <div className="arc-panel arc-panel-dim flex flex-1 gap-1 p-1">
          {(['2d', '3d'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`font-pixel flex-1 py-2 text-[9px] transition ${
                view === v ? 'bg-[#36e0e0] text-[#06343a]' : 'text-[#6a6a82]'
              }`}
            >
              {v === '2d' ? 'MAP' : '3D'}
            </button>
          ))}
        </div>
        <div className="arc-panel arc-panel-dim flex flex-1 gap-1 p-1">
          {(['now', 'plan'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`font-pixel flex-1 py-2 text-[9px] transition ${
                mode === m ? 'bg-[#2bd14a] text-[#04210d]' : 'text-[#6a6a82]'
              }`}
            >
              {m === 'now' ? 'NOW' : 'PLAN'}
            </button>
          ))}
        </div>
      </div>

      {view === '3d' && (
        <Suspense
          fallback={
            <div className="arc-panel arc-vt flex h-[360px] items-center justify-center text-[#6cf08a]">
              LOADING 3D...
            </div>
          }
        >
          <Plan3D mode={mode} selected={selected} onSelect={setSelected} />
        </Suspense>
      )}

      <div className={`arc-panel overflow-hidden p-2 ${view === '3d' ? 'hidden' : ''}`}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" role="img" aria-label="Floor plan of your garage section">
          {/* shared strip beyond the line (parking + laundry) */}
          <rect x={M + W * SCALE} y={M} width={PB * SCALE} height={D * SCALE} rx="4" fill="#f1f5f9" />
          <text
            x={M + (W + PB / 2) * SCALE}
            y={M + (D * SCALE) / 2}
            textAnchor="middle"
            fontSize="8"
            fill="#94a3b8"
            fontWeight="700"
            transform={`rotate(-90 ${M + (W + PB / 2) * SCALE} ${M + (D * SCALE) / 2})`}
          >
            shared · laundry · parking
          </text>

          {/* your section floor */}
          <rect x={M} y={M} width={W * SCALE} height={D * SCALE} rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />

          {/* allotment line (east edge of your section) */}
          <line
            x1={M + W * SCALE}
            y1={M}
            x2={M + W * SCALE}
            y2={M + D * SCALE}
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeDasharray="6 4"
          />
          <text
            x={M + W * SCALE - 6}
            y={M + (D * SCALE) / 2}
            textAnchor="middle"
            fontSize="8"
            fill="#b45309"
            fontWeight="700"
            transform={`rotate(-90 ${M + W * SCALE - 6} ${M + (D * SCALE) / 2})`}
          >
            YOUR LINE
          </text>

          {/* back wall (west): backyard door + window */}
          <line x1={M} y1={M + features.peopleDoor.y * SCALE} x2={M} y2={M + (features.peopleDoor.y + features.peopleDoor.h) * SCALE} stroke="#64748b" strokeWidth="5" strokeLinecap="round" />
          <line x1={M} y1={M + features.window.y * SCALE} x2={M} y2={M + (features.window.y + features.window.h) * SCALE} stroke="#7dd3fc" strokeWidth="4" strokeLinecap="round" />

          {/* direction labels */}
          <text x={M + (W * SCALE) / 2} y={M + 11} textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="700">
            NORTH · fitness + bikes
          </text>
          <text x={M + (W * SCALE) / 2} y={M + D * SCALE - 5} textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="700">
            SOUTH · storage racks
          </text>
          <text
            x={M + 10}
            y={M + (D * SCALE) / 2}
            textAnchor="middle"
            fontSize="8"
            fill="#0369a1"
            fontWeight="700"
            transform={`rotate(-90 ${M + 10} ${M + (D * SCALE) / 2})`}
          >
            BACK · door to yard
          </text>
          <FeatureRect box={features.cabinets} label="cabinets" />
          <FeatureRect box={features.miniFridge} />
          <FeatureRect box={features.stairs} dashed label="stairs" />
          <circle
            cx={M + features.waterHeater.cx * SCALE}
            cy={M + features.waterHeater.cy * SCALE}
            r={features.waterHeater.r * SCALE}
            fill="#e2e8f0"
            stroke="#94a3b8"
            strokeWidth="1.5"
          />

          {/* objects */}
          {objects.map((o, i) => {
            const b = mode === 'now' ? o.now : o.plan
            const r = px(b)
            const c = colorOf(o)
            const isSel = selected === o.id
            const overLine = b.x + b.w / 2 > W
            return (
              <g key={o.id} onClick={() => setSelected(isSel ? null : o.id)} className="cursor-pointer">
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  rx="3"
                  fill={c.fill}
                  stroke={isSel ? '#0f172a' : overLine ? '#dc2626' : c.stroke}
                  strokeWidth={isSel ? 2.5 : overLine ? 2.5 : 1.5}
                  strokeDasharray={overLine ? '4 2' : undefined}
                  opacity={selected && !isSel ? 0.45 : 0.92}
                  style={{ transition: 'x .6s ease, y .6s ease, width .6s ease, height .6s ease' }}
                />
                <text
                  x={r.x + r.width / 2}
                  y={r.y + r.height / 2 + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill={overLine ? '#dc2626' : c.stroke}
                  style={{ transition: 'x .6s ease, y .6s ease', pointerEvents: 'none' }}
                >
                  {i}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* selected detail */}
      {sel && (
        <div className="arc-panel arc-panel-yellow p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="arc-vt text-lg text-[#e8e8f5]">
                <span className="font-pixel mr-2 bg-[#1d1d2e] px-1.5 py-1 text-[8px] text-[#36e0e0]">
                  {objects.indexOf(sel)}
                </span>
                {sel.label}
              </p>
              <p className="arc-vt mt-1 text-[#8a8aa6]">
                {zoneName(sel.zone).toUpperCase()}
                {sel.owner ? ` · ${personName(sel.owner).toUpperCase()}` : ''}
              </p>
            </div>
            <span
              className="font-pixel shrink-0 px-1.5 py-1 text-[7px] text-[#07070e]"
              style={{ background: arcDecision[sel.decision].color }}
            >
              {arcDecision[sel.decision].label}
            </span>
          </div>
          {sel.note && <p className="arc-vt mt-2 text-[#8a8aa6]">{sel.note}</p>}
        </div>
      )}

      {/* legend / object list */}
      <section>
        <h2 className="font-pixel mb-2 text-[10px] text-[#ff3ca6]">OBJECTS</h2>
        <div className="space-y-1.5">
          {objects
            .filter((o) => o.id !== 'car')
            .map((o) => {
              const c = colorOf(o)
              return (
                <button
                  key={o.id}
                  onClick={() => setSelected(selected === o.id ? null : o.id)}
                  className={`arc-panel flex w-full items-center gap-2.5 px-3 py-2 text-left ${
                    selected === o.id ? 'arc-panel-yellow' : 'arc-panel-dim'
                  }`}
                >
                  <span
                    className="font-pixel flex h-5 w-5 shrink-0 items-center justify-center text-[8px]"
                    style={{ background: c.fill, color: c.stroke }}
                  >
                    {objects.indexOf(o)}
                  </span>
                  <span className="arc-vt min-w-0 flex-1 truncate text-[#e8e8f5]">{o.label}</span>
                  <span className="arc-vt shrink-0 text-[#6a6a82]">{zoneName(o.zone).toUpperCase()}</span>
                </button>
              )
            })}
        </div>
      </section>

      <p className="arc-vt px-1 text-center text-[#5a5a70]">
        INFERRED FROM PHOTOS — POSITIONS ARE A DRAFT. TELL ME WHAT TO FIX.
      </p>
    </div>
  )
}

function FeatureRect({ box, label, dashed }: { box: Box; label?: string; dashed?: boolean }) {
  const r = px(box)
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect
        x={r.x}
        y={r.y}
        width={r.width}
        height={r.height}
        rx="2"
        fill="#f1f5f9"
        stroke="#94a3b8"
        strokeWidth="1.2"
        strokeDasharray={dashed ? '3 3' : undefined}
      />
      {label && (
        <text x={r.x + r.width / 2} y={r.y + r.height / 2 + 3} textAnchor="middle" fontSize="7" fill="#94a3b8">
          {label}
        </text>
      )}
    </g>
  )
}
