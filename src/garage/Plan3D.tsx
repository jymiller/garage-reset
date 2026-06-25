import { useLayoutEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Edges } from '@react-three/drei'
import * as THREE from 'three'
import { garage } from './model'
import type { PlacedObject } from './model'
import { zoneColors } from '../theme'

const W = garage.width
const D = garage.depth
const PB = garage.parkingBeyond
const WALL_H = 3.5

type Mode = 'now' | 'plan'

// Approximate object heights in feet (footprint comes from the model).
const HEIGHTS: Record<string, number> = {
  car: 4.6,
  'tool-chest': 3,
  'parts-cabinet': 5.5,
  'storage-shelf': 6,
  'white-table': 2.5,
  'banker-boxes': 2,
  dresser: 3.4,
  'weight-bench': 1.6,
  bikes: 3.6,
  'gray-wardrobe': 6,
  'oak-wardrobe': 6,
  'ne-clutter': 4,
  'recycle-bins': 3.2,
}

const colorOf = (o: PlacedObject) => zoneColors[o.id === 'car' ? 'car' : o.zone ?? 'shared-storage']

function ObjectBox({
  o,
  index,
  mode,
  selected,
  onSelect,
}: {
  o: PlacedObject
  index: number
  mode: Mode
  selected: boolean
  onSelect: (id: string) => void
}) {
  const ref = useRef<THREE.Mesh>(null)
  const box = mode === 'now' ? o.now : o.plan
  const h = HEIGHTS[o.id] ?? 3
  const target = useRef(new THREE.Vector3())
  target.current.set(box.x + box.w / 2 - W / 2, h / 2, box.y + box.d / 2 - D / 2)

  useLayoutEffect(() => {
    ref.current?.position.copy(target.current)
  }, [])

  useFrame(() => {
    const m = ref.current
    if (!m) return
    m.position.lerp(target.current, 0.14)
    const s = selected ? 1.08 : 1
    m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x, s, 0.2))
  })

  const c = colorOf(o)
  return (
    <mesh
      ref={ref}
      castShadow
      onClick={(e) => {
        e.stopPropagation()
        onSelect(o.id)
      }}
    >
      <boxGeometry args={[box.w, h, box.d]} />
      <meshStandardMaterial
        color={c.fill}
        roughness={0.75}
        metalness={0.05}
        emissive={selected ? c.stroke : '#000000'}
        emissiveIntensity={selected ? 0.25 : 0}
      />
      <Edges threshold={15} color={selected ? '#0f172a' : c.stroke} />
      <Html center distanceFactor={26} position={[0, h / 2 + 0.7, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: selected ? '#0f172a' : '#ffffff',
            color: selected ? '#ffffff' : c.stroke,
            border: `1.5px solid ${c.stroke}`,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            padding: '1px 7px',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 2px rgba(0,0,0,.15)',
          }}
        >
          {o.id === 'car' ? 'Car' : index}
        </div>
      </Html>
    </mesh>
  )
}

function Wall({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#f1f5f9" transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Scene({ mode, selected, onSelect }: { mode: Mode; selected: string | null; onSelect: (id: string | null) => void }) {
  const { peopleDoor } = garage.features
  return (
    <>
      <color attach="background" args={['#f8fafc']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[12, 18, 8]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />

      {/* your section floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      {/* faded shared strip beyond your line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2 + PB / 2, -0.01, 0]}>
        <planeGeometry args={[PB, D]} />
        <meshStandardMaterial color="#eef2f6" />
      </mesh>
      <gridHelper args={[Math.max(W, D), Math.max(W, D) / 2, '#cbd5e1', '#e2e8f0']} position={[0, 0.02, 0]} />

      {/* low walls: back (west), north, south. The east side is the OPEN allotment line. */}
      <Wall position={[0, WALL_H / 2, -D / 2]} size={[W, WALL_H, 0.3]} />
      <Wall position={[0, WALL_H / 2, D / 2]} size={[W, WALL_H, 0.3]} />
      <Wall position={[-W / 2, WALL_H / 2, 0]} size={[0.3, WALL_H, D]} />

      {/* allotment line — a low amber bar at the east edge */}
      <mesh position={[W / 2, 0.4, 0]}>
        <boxGeometry args={[0.2, 0.8, D]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.3} />
      </mesh>

      {/* people door (west / back, to the yard) */}
      <mesh position={[-W / 2, WALL_H / 2, peopleDoor.y + peopleDoor.h / 2 - D / 2]}>
        <boxGeometry args={[0.4, WALL_H, peopleDoor.h]} />
        <meshStandardMaterial color="#64748b" transparent opacity={0.7} />
      </mesh>

      {garage.objects.map((o, i) => (
        <ObjectBox key={o.id} o={o} index={i} mode={mode} selected={selected === o.id} onSelect={(id) => onSelect(selected === id ? null : id)} />
      ))}

      <OrbitControls enablePan={false} minDistance={14} maxDistance={55} maxPolarAngle={Math.PI / 2.05} />
    </>
  )
}

export function Plan3D({
  mode,
  selected,
  onSelect,
}: {
  mode: Mode
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div className="h-[360px] w-full overflow-hidden rounded-2xl ring-1 ring-slate-200">
      <Canvas shadows camera={{ position: [20, 19, 22], fov: 42 }} onPointerMissed={() => onSelect(null)}>
        <Scene mode={mode} selected={selected} onSelect={onSelect} />
      </Canvas>
    </div>
  )
}
