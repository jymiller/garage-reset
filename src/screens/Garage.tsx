import { useState, lazy, Suspense } from 'react'
import { garage } from '../garage/model'
import type { Box, PlacedObject } from '../garage/model'
import { zoneName, personName } from '../data'
import { zoneColors, decisionMeta } from '../theme'

const Plan3D = lazy(() => import('../garage/Plan3D').then((m) => ({ default: m.Plan3D })))

type View = '2d' | '3d'

const SCALE = 15 // px per foot
const M = 16 // margin px
const W = garage.width
const D = garage.depth
const svgW = W * SCALE + M * 2
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
        <h1 className="text-2xl font-bold tracking-tight">Garage layout</h1>
        <p className="text-sm text-slate-500">Drafted from your photos. Drag to orbit the 3D. Tap a block for detail.</p>
      </header>

      <div className="flex gap-2">
        <div className="flex flex-1 gap-1 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-100">
          {(['2d', '3d'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                view === v ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              {v === '2d' ? 'Map' : '3D'}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-1 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-100">
          {(['now', 'plan'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                mode === m ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              {m === 'now' ? 'Now' : 'Plan'}
            </button>
          ))}
        </div>
      </div>

      {view === '3d' && (
        <Suspense
          fallback={
            <div className="flex h-[360px] items-center justify-center rounded-2xl bg-white text-sm text-slate-400 ring-1 ring-slate-100">
              Loading 3D…
            </div>
          }
        >
          <Plan3D mode={mode} selected={selected} onSelect={setSelected} />
        </Suspense>
      )}

      <div className={`overflow-hidden rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-100 ${view === '3d' ? 'hidden' : ''}`}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" role="img" aria-label="Garage floor plan">
          {/* floor */}
          <rect x={M} y={M} width={W * SCALE} height={D * SCALE} rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />

          {/* garage door — EAST wall (right edge) */}
          <line
            x1={M + W * SCALE}
            y1={M + features.garageDoor.y * SCALE}
            x2={M + W * SCALE}
            y2={M + (features.garageDoor.y + features.garageDoor.h) * SCALE}
            stroke="#10b981"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* people door + window — WEST wall (left edge) */}
          <line
            x1={M}
            y1={M + features.peopleDoor.y * SCALE}
            x2={M}
            y2={M + (features.peopleDoor.y + features.peopleDoor.h) * SCALE}
            stroke="#64748b"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <line
            x1={M}
            y1={M + features.window.y * SCALE}
            x2={M}
            y2={M + (features.window.y + features.window.h) * SCALE}
            stroke="#7dd3fc"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* direction labels */}
          <text x={M + (W * SCALE) / 2} y={M + 11} textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="700">
            NORTH · wardrobe + fitness
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
            WEST · door to yard
          </text>
          <text
            x={M + W * SCALE - 9}
            y={M + (D * SCALE) / 2}
            textAnchor="middle"
            fontSize="8"
            fill="#059669"
            fontWeight="700"
            transform={`rotate(-90 ${M + W * SCALE - 9} ${M + (D * SCALE) / 2})`}
          >
            EAST · garage door
          </text>
          <FeatureRect box={features.cabinets} label="cabinets" />
          <FeatureRect box={features.miniFridge} />
          <FeatureRect box={features.soffit} dashed label="low ceiling" />
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
            const r = px(mode === 'now' ? o.now : o.plan)
            const c = colorOf(o)
            const isSel = selected === o.id
            return (
              <g key={o.id} onClick={() => setSelected(isSel ? null : o.id)} className="cursor-pointer">
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  rx="3"
                  fill={c.fill}
                  stroke={isSel ? '#0f172a' : c.stroke}
                  strokeWidth={isSel ? 2.5 : 1.5}
                  opacity={selected && !isSel ? 0.45 : 0.92}
                  style={{ transition: 'x .6s ease, y .6s ease, width .6s ease, height .6s ease' }}
                />
                <text
                  x={r.x + r.width / 2}
                  y={r.y + r.height / 2 + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill={c.stroke}
                  style={{ transition: 'x .6s ease, y .6s ease', pointerEvents: 'none' }}
                >
                  {o.id === 'car' ? 'CAR' : i}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* selected detail */}
      {sel && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-800">
                {sel.id !== 'car' && (
                  <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">
                    {objects.indexOf(sel)}
                  </span>
                )}
                {sel.label}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {zoneName(sel.zone)}
                {sel.owner ? ` · ${personName(sel.owner)}` : ''}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${decisionMeta[sel.decision].chip}`}>
              {decisionMeta[sel.decision].label}
            </span>
          </div>
          {sel.note && <p className="mt-2 text-sm text-slate-600">{sel.note}</p>}
        </div>
      )}

      {/* legend / object list */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Main objects</h2>
        <div className="space-y-1.5">
          {objects
            .filter((o) => o.id !== 'car')
            .map((o) => {
              const c = colorOf(o)
              return (
                <button
                  key={o.id}
                  onClick={() => setSelected(selected === o.id ? null : o.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm ring-1 transition ${
                    selected === o.id ? 'bg-slate-50 ring-slate-300' : 'bg-white ring-slate-100'
                  }`}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                    style={{ background: c.fill, color: c.stroke }}
                  >
                    {objects.indexOf(o)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{o.label}</span>
                  <span className="shrink-0 text-xs text-slate-400">{zoneName(o.zone)}</span>
                </button>
              )
            })}
        </div>
      </section>

      <p className="px-1 text-center text-xs text-slate-400">
        Inferred from photos — dimensions and positions are a first draft. Tell me what to fix.
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
