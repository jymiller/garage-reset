import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import type { ComponentRef } from 'react'
import { Canvas, events, useThree } from '@react-three/fiber'
import type { CanvasProps } from '@react-three/fiber'
import { Edges, Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { LayoutObject } from './currentObjects'
import type { SpatialItem } from '../crates/model'
import { scanShell } from './scanGeometry'

type Vec3 = [number, number, number]
type Scope = 'rear' | 'all'
export type CurrentSceneCameraCommand = { kind: 'left' | 'right' | 'zoom-in' | 'zoom-out' | 'reset'; seq: number }

interface CurrentSceneProps {
  objects: LayoutObject[]
  selected: string | null
  onSelect: (id: string | null) => void
  scope: Scope
  showObjects: boolean
  showParking: boolean
  spatialItems?: SpatialItem[]
  selectedSpatialId?: string | null
  onSelectSpatial?: (id: string) => void
  showSpatial?: boolean
  cameraCommand?: CurrentSceneCameraCommand
  showHint?: boolean
}

// X-ray catalog boxes remain clickable through the illustrative shelf contents.
// Their actual projected boxes get priority, not the whole rack footprint.
const spatialEvents: NonNullable<CanvasProps['events']> = (state) => ({
  ...events(state),
  filter: (intersections) => [...intersections].sort((a, b) =>
    Number(Boolean(b.object.userData.spatialItemId)) - Number(Boolean(a.object.userData.spatialItemId))
    || a.distance - b.distance),
})

function Block({
  size, at = [0, 0, 0], color, opacity = 1,
}: { size: Vec3; at?: Vec3; color: string; opacity?: number }) {
  return (
    <mesh position={at} castShadow={opacity === 1} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  )
}

function Tube({ a, b, radius = 0.025, color = '#4d514a' }: { a: Vec3; b: Vec3; radius?: number; color?: string }) {
  const { position, rotation, length } = useMemo(() => {
    const start = new THREE.Vector3(...a)
    const end = new THREE.Vector3(...b)
    const direction = end.clone().sub(start)
    return {
      position: start.add(end).multiplyScalar(0.5),
      rotation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
      length: direction.length(),
    }
  }, [a, b])
  return (
    <mesh position={position} quaternion={rotation} castShadow>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  )
}

function Tote({ w, d, h, at }: { w: number; d: number; h: number; at: Vec3 }) {
  return (
    <group position={at}>
      <Block size={[w, h, d]} at={[0, h / 2, 0]} color="#2d302e" />
      <Block size={[w * 1.04, 0.045, d * 1.04]} at={[0, h, 0]} color="#202521" />
      <Block size={[w * 0.34, 0.065, 0.035]} at={[0, h * 0.77, d / 2 + 0.012]} color="#b85543" />
    </group>
  )
}

function Rack({ w, d, h }: LayoutObject) {
  const shelfYs = [0.12, h * 0.36, h * 0.68]
  const toteW = (w - 0.2) / 2
  const toteH = Math.min(0.4, h * 0.24)
  return (
    <group>
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
        <Block key={`${x}-${z}`} size={[0.045, h, 0.045]} at={[x * (w / 2 - 0.03), h / 2, z * (d / 2 - 0.03)]} color="#66695f" />
      )))}
      {[...shelfYs, h - 0.04].map((y) => (
        <Block key={`shelf-${y}`} size={[w, 0.055, d]} at={[0, y, 0]} color="#827d6b" />
      ))}
      {shelfYs.slice(0, 2).flatMap((y, row) => [-1, 1].map((side) => (
        <Tote key={`${row}-${side}`} w={toteW} d={d * 0.82} h={toteH} at={[side * (w / 4 - 0.015), y + 0.03, 0]} />
      )))}
      {/* Mixed upper-shelf contents are silhouettes, not an item count. */}
      <Block size={[toteW * 0.94, toteH * 0.78, d * 0.76]} at={[-w / 4, shelfYs[2] + 0.03 + toteH * 0.39, 0]} color="#b6a98d" />
      <Block size={[toteW * 0.13, 0.015, d * 0.77]} at={[-w / 4, shelfYs[2] + 0.035 + toteH * 0.78, 0]} color="#d9d0b8" />
      <Block size={[toteW * 0.83, toteH * 0.14, d * 0.65]} at={[-w / 4 + 0.035, shelfYs[2] + 0.04 + toteH * 0.9, 0]} color="#d3cebc" />
      <mesh position={[w / 4 - 0.015, shelfYs[2] + 0.03 + toteH * 0.35, 0]} scale={[toteW * 0.52, toteH * 0.36, d * 0.38]} castShadow>
        <sphereGeometry args={[1, 10, 6]} />
        <meshStandardMaterial color="#747d64" roughness={1} flatShading />
      </mesh>
    </group>
  )
}

function Cabinet({ w, d, h, color, kind }: LayoutObject) {
  const isLow = h < 1.25
  const front = d / 2 + 0.006
  return (
    <group>
      <Block size={[w, h, d]} at={[0, h / 2, 0]} color={color} />
      <Block size={[w * 1.03, 0.065, d * 1.03]} at={[0, h + 0.018, 0]} color={isLow ? '#666457' : '#8c8874'} />
      {isLow ? [0.22, 0.46, 0.7].map((part) => (
        <Block key={part} size={[w * 0.82, 0.025, 0.025]} at={[0, h * part, front]} color="#dfddd1" />
      )) : (
        <>
          <Block size={[0.012, h * 0.94, 0.012]} at={[0, h / 2, front]} color="#5e6255" />
          {[-1, 1].map((side) => (
            <Block key={side} size={[0.025, kind === 'wardrobe' ? 0.22 : 0.14, 0.035]} at={[side * w * 0.055, h * 0.53, front + 0.025]} color="#d8d5c7" />
          ))}
        </>
      )}
      <Block size={[w * 0.93, 0.07, d * 0.92]} at={[0, 0.035, 0]} color="#4d5048" />
    </group>
  )
}

function Vehicle({ w, d, h, color }: LayoutObject) {
  const wheelR = Math.min(0.34, h * 0.22)
  return (
    <group>
      <Block size={[w * 0.96, h * 0.4, d * 0.93]} at={[0, h * 0.39, 0]} color={color} />
      <Block size={[w * 0.61, h * 0.37, d * 0.83]} at={[-w * 0.06, h * 0.735, 0]} color={color} />
      <Block size={[w * 0.42, h * 0.27, d * 0.845]} at={[-w * 0.05, h * 0.73, 0]} color="#647473" />
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
        <mesh key={`${x}-${z}`} position={[x * w * 0.3, wheelR, z * d * 0.46]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[wheelR, wheelR, d * 0.15, 16]} />
          <meshStandardMaterial color="#373b36" roughness={0.95} />
        </mesh>
      )))}
      {[-1, 1].map((side) => (
        <Block key={side} size={[0.035, h * 0.12, d * 0.2]} at={[w * 0.487, h * 0.48, side * d * 0.3]} color="#f0e8c4" />
      ))}
    </group>
  )
}

function Bicycle({ w, d, h, color }: LayoutObject) {
  const r = Math.min(h * 0.3, w * 0.2)
  const left = -w * 0.32
  const right = w * 0.32
  const seat: Vec3 = [-w * 0.07, h * 0.73, 0]
  const crank: Vec3 = [-w * 0.02, r * 0.82, 0]
  const stem: Vec3 = [w * 0.24, h * 0.77, 0]
  const rear: Vec3 = [left, r, 0]
  const front: Vec3 = [right, r, 0]
  return (
    <group>
      {[left, right].map((x) => (
        <mesh key={x} position={[x, r, 0]} castShadow>
          <torusGeometry args={[r, 0.035, 6, 24]} />
          <meshStandardMaterial color="#41443d" roughness={0.95} />
        </mesh>
      ))}
      {[[rear, seat], [seat, crank], [crank, rear], [seat, stem], [stem, crank], [stem, front]].map(([a, b], i) => <Tube key={i} a={a} b={b} color={color} />)}
      <Block size={[w * 0.17, 0.055, d * 0.36]} at={[seat[0], seat[1] + 0.03, 0]} color="#40473d" />
      <Tube a={[stem[0], h * 0.94, -d * 0.4]} b={[stem[0], h * 0.94, d * 0.4]} color="#595d52" />
      <Tube a={stem} b={[stem[0], h * 0.94, 0]} color="#595d52" />
    </group>
  )
}

function Bag({ w, d, h }: LayoutObject) {
  return (
    <group>
      <Block size={[w, h * 0.88, d]} at={[0, h * 0.44, 0]} color="#d7b842" />
      <Block size={[w * 0.86, 0.025, d * 0.84]} at={[0, h * 0.89, 0]} color="#a98f3f" />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * w * 0.32, h * 0.9, d * 0.35]} scale={[1, 1.4, 1]}>
          <torusGeometry args={[Math.min(w, d) * 0.09, 0.018, 5, 12]} />
          <meshStandardMaterial color="#d9c363" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function WheeledBins({ w, d, h }: LayoutObject) {
  const binW = w * 0.43
  const wheelR = Math.min(0.11, h * 0.1)
  return (
    <group>
      {['#547659', '#507f91'].map((color, index) => (
        <group key={color} position={[(index === 0 ? -1 : 1) * w * 0.25, 0, 0]}>
          <Block size={[binW, h * 0.82, d * 0.8]} at={[0, h * 0.49, 0]} color={color} />
          <Block size={[binW * 1.08, h * 0.065, d * 0.9]} at={[0, h * 0.94, 0]} color={color} />
          <Block size={[binW * 0.64, 0.04, 0.04]} at={[0, h * 0.88, -d * 0.45]} color="#414f45" />
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * binW * 0.43, wheelR, -d * 0.29]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[wheelR, wheelR, 0.065, 12]} />
              <meshStandardMaterial color="#343e36" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function FoldedPanels({ w, d, h, color }: LayoutObject) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * w * 0.27, 0, 0]}>
          <Block size={[w * 0.23, h * 0.96, d * 0.94]} at={[0, h * 0.48, 0]} color={color} />
          <Tube a={[w * 0.13, h * 0.13, -d * 0.3]} b={[w * 0.13, h * 0.79, d * 0.3]} radius={0.015} color="#8f9486" />
          <Tube a={[w * 0.13, h * 0.13, d * 0.3]} b={[w * 0.13, h * 0.79, -d * 0.3]} radius={0.015} color="#8f9486" />
        </group>
      ))}
    </group>
  )
}

function ObjectGeometry({ o }: { o: LayoutObject }) {
  const { w, d, h, color } = o
  if (o.id === 'folded-tables') return <FoldedPanels {...o} />
  switch (o.kind) {
    case 'rack': return <Rack {...o} />
    case 'cabinet':
    case 'wardrobe': return <Cabinet {...o} />
    case 'vehicle': return <Vehicle {...o} />
    case 'bike': return <Bicycle {...o} />
    case 'bag': return <Bag {...o} />
    case 'heater': return (
      <group>
        <mesh position={[0, h / 2, 0]} castShadow>
          <cylinderGeometry args={[Math.min(w, d) * 0.46, Math.min(w, d) * 0.46, h * 0.93, 20]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
        <Tube a={[0, h * 0.96, 0]} b={[0, h + 0.25, 0]} radius={0.06} color="#868477" />
        <Block size={[w * 0.28, h * 0.17, 0.035]} at={[0, h * 0.3, d * 0.46]} color="#9a9587" />
      </group>
    )
    case 'table': return (
      <group>
        <Block size={[w, 0.08, d]} at={[0, h - 0.04, 0]} color={color} />
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
          <Block key={`${x}-${z}`} size={[0.05, h - 0.08, 0.05]} at={[x * w * 0.42, (h - 0.08) / 2, z * d * 0.4]} color="#75786b" />
        )))}
      </group>
    )
    case 'bins': return <WheeledBins {...o} />
    case 'loose': return (
      <group>
        <Block size={[w * 0.58, h * 0.61, d * 0.73]} at={[-w * 0.18, h * 0.305, -d * 0.12]} color={color} />
        <Block size={[w * 0.39, h * 0.8, d * 0.52]} at={[w * 0.27, h * 0.4, d * 0.2]} color="#aaa28d" />
        <Block size={[w * 0.48, h * 0.24, d * 0.64]} at={[-w * 0.12, h * 0.73, -d * 0.08]} color="#777c69" />
      </group>
    )
  }
}

function SceneObject({ o, selected, onSelect }: { o: LayoutObject; selected: boolean; onSelect: () => void }) {
  return (
    <group position={[o.x + o.w / 2, 0, o.y + o.d / 2]} onClick={(event) => { event.stopPropagation(); onSelect() }}>
      <ObjectGeometry o={o} />
      {selected && (
        <>
          <mesh position={[0, o.h / 2 + 0.015, 0]} raycast={() => {}}>
            <boxGeometry args={[o.w + 0.08, o.h + 0.07, o.d + 0.08]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            <Edges color="#b16b3b" />
          </mesh>
          <Html center position={[0, o.h + 0.3, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[30, 0]}>
            <div style={{ padding: '6px 10px', borderRadius: 6, background: '#333b31', color: '#fffdf4', font: '500 12px/1.3 system-ui, sans-serif', whiteSpace: 'nowrap', boxShadow: '0 2px 8px #0002' }}>{o.label}</div>
          </Html>
        </>
      )}
    </group>
  )
}

function SpatialBox({ item, selected, onSelect }: { item: SpatialItem; selected: boolean; onSelect?: (id: string) => void }) {
  const liters = item.w * item.d * item.h * 1000
  const volume = liters.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return (
    <mesh
      position={[item.x + item.w / 2, item.z + item.h / 2, item.y + item.d / 2]}
      renderOrder={selected ? 21 : 11}
      userData={{ spatialItemId: onSelect ? item.id : undefined }}
      onClick={onSelect ? (event) => { event.stopPropagation(); onSelect(item.id) } : undefined}
    >
      <boxGeometry args={[item.w, item.h, item.d]} />
      <meshBasicMaterial color={selected ? '#e6af31' : '#e8c869'} transparent opacity={selected ? 0.23 : 0.1} depthTest={false} depthWrite={false} toneMapped={false} />
      <Edges color={selected ? '#bd771d' : '#c3a341'} lineWidth={selected ? 2.5 : 1.15} transparent opacity={selected ? 1 : 0.85} depthTest={false} depthWrite={false} renderOrder={selected ? 22 : 12} />
      {selected && (
        <Html center position={[0, item.h / 2 + 0.24, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[40, 0]}>
          <div style={{ maxWidth: 220, minWidth: 120, padding: '7px 10px', borderRadius: 6, background: '#fff3c9', border: '1px solid #c7a14d', color: '#644b21', font: '500 12px/1.35 system-ui, sans-serif', textAlign: 'center', boxShadow: '0 2px 8px #0002' }}>
            <div>{item.name}</div>
            <div style={{ marginTop: 2, fontSize: 11, fontWeight: 400 }}>{item.dimensionBasis === 'estimated' ? '≈ ' : ''}{volume} L · outer box</div>
          </div>
        </Html>
      )}
    </mesh>
  )
}

function CameraControls({ scope, command }: { scope: Scope; command?: CurrentSceneCameraCommand }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const lastCommand = useRef<number | null>(null)
  const { camera, invalidate, size } = useThree()
  const fitScope = useCallback(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || size.width <= 0 || size.height <= 0) return

    // Rear framing includes the observed SUV, not just the rack run.
    const bounds = new THREE.Box3(
      new THREE.Vector3(scope === 'rear' ? 10.5 : 0, 0, 0),
      new THREE.Vector3(scanShell.totalLength + 0.1, scanShell.height, scanShell.width + 0.025),
    )
    const target = bounds.getCenter(new THREE.Vector3())
    const direction = new THREE.Vector3(-0.55, 0.86, 1).normalize()
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize()
    const up = new THREE.Vector3().crossVectors(direction, right).normalize()
    const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2)
    const aspect = size.width / size.height
    const tanHorizontal = tanVertical * aspect
    let distance = 0

    // Fit all eight corners in the camera's horizontal AND vertical frusta.
    // Corner depth matters at this oblique angle; a width-only fit clips the SUV
    // on tall mobile canvases. The 15% breathing room also accommodates labels.
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const offset = new THREE.Vector3(x, y, z).sub(target)
          const depth = offset.dot(direction)
          distance = Math.max(
            distance,
            depth + Math.abs(offset.dot(right)) * 1.15 / tanHorizontal,
            depth + Math.abs(offset.dot(up)) * 1.15 / tanVertical,
          )
        }
      }
    }

    camera.aspect = aspect
    camera.far = Math.max(150, distance * 3)
    camera.updateProjectionMatrix()
    camera.position.copy(target).addScaledVector(direction, distance)
    camera.lookAt(target)
    controls.current?.target.copy(target)
    if (controls.current) controls.current.maxDistance = Math.max(65, distance * 2.5)
    controls.current?.update()
    invalidate()
  }, [scope, size.width, size.height, camera, invalidate])

  // Fit on mount, scope change and resize. Selection and object edits leave the
  // user's orbit untouched; explicit reset uses this same current-scope fit.
  const fittedWith = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    // Effect replay must not undo a command already applied after the first fit.
    if (fittedWith.current === fitScope) return
    fitScope()
    fittedWith.current = fitScope
  }, [fitScope])
  useLayoutEffect(() => {
    const orbit = controls.current
    if (!command || !orbit || !Number.isSafeInteger(command.seq) || command.seq < 0
      || lastCommand.current === command.seq || size.width <= 0 || size.height <= 0) return
    lastCommand.current = command.seq
    const step = Math.PI / 8
    // Use the live controls, including a target moved by a previous pan. These
    // APIs enforce the same distance and polar limits as mouse/touch gestures.
    if (command.kind === 'reset') fitScope()
    else if (command.kind === 'left') orbit.setAzimuthalAngle(orbit.getAzimuthalAngle() - step)
    else if (command.kind === 'right') orbit.setAzimuthalAngle(orbit.getAzimuthalAngle() + step)
    else if (command.kind === 'zoom-in') orbit.dollyIn(0.8)
    else if (command.kind === 'zoom-out') orbit.dollyOut(0.8)
    invalidate()
  }, [command?.kind, command?.seq, fitScope, invalidate, size.width, size.height])
  return <OrbitControls ref={controls} makeDefault enableDamping={false} enablePan minDistance={2} minPolarAngle={0.08} maxPolarAngle={Math.PI / 2.08} />
}

function Shell() {
  const floorShape = useMemo(() => {
    const shape = new THREE.Shape()
    scanShell.outline.forEach(([x, y], index) => index === 0 ? shape.moveTo(x, -y) : shape.lineTo(x, -y))
    shape.closePath()
    return shape
  }, [])
  const perimeter: Vec3[] = [...scanShell.outline, scanShell.outline[0]].map(([x, y]) => [x, 0.014, y])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <shapeGeometry args={[floorShape]} />
        <meshStandardMaterial color="#d7d5cb" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <Line points={perimeter} color="#aaa99d" lineWidth={1} />
      {scanShell.walls.map(({ a, b }, index) => {
        const length = Math.hypot(b[0] - a[0], b[1] - a[1])
        return (
          <group key={index} position={[(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]} rotation={[0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0]}>
            <Block size={[length, 0.38, 0.1]} at={[0, 0.19, 0]} color="#bdbfb1" />
            <Block size={[length, 0.022, 0.13]} at={[0, 0.39, 0]} color="#dee0d4" />
          </group>
        )
      })}
      {scanShell.openings.filter((opening) => opening.kind === 'window').map(({ a, b }, index) => (
        <group key={`window-${index}`} position={[(a[0] + b[0]) / 2, 0.55, (a[1] + b[1]) / 2]} rotation={[0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0]}>
          <Block size={[Math.hypot(b[0] - a[0], b[1] - a[1]), 0.3, 0.028]} color="#a7b9b0" opacity={0.6} />
        </group>
      ))}
    </group>
  )
}

function OrientationLabels({ scope }: { scope: Scope }) {
  return (
    <group>
      {scanShell.openings.filter((opening) => opening.id === 'rear-door' || (scope === 'all' && opening.id === 'front-door')).map((opening) => (
        <Html key={opening.id} center position={[(opening.a[0] + opening.b[0]) / 2, 0.7, (opening.a[1] + opening.b[1]) / 2]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div style={{ color: '#626a5b', background: '#f7f7eeda', padding: '3px 6px', borderRadius: 4, font: '500 10px/1.3 system-ui, sans-serif', whiteSpace: 'nowrap' }}>{opening.id === 'rear-door' ? 'Rear · yard door' : 'Entrance · street'}</div>
        </Html>
      ))}
    </group>
  )
}

/** The floor follows the scan; object silhouettes and the optional planning wash are illustrative. */
export function CurrentScene({ objects, selected, onSelect, scope, showObjects, showParking, spatialItems = [], selectedSpatialId = null, onSelectSpatial, showSpatial = true, cameraCommand, showHint = true }: CurrentSceneProps) {
  const validSpatialItems = spatialItems.filter((item) => [item.x, item.y, item.z, item.w, item.d, item.h].every(Number.isFinite) && item.w > 0 && item.d > 0 && item.h > 0)
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 14, background: '#eeeee6', position: 'relative' }}>
      <Canvas events={spatialEvents} frameloop="demand" shadows dpr={[1, 1.5]} camera={{ position: [14, 11, 15], fov: 40, near: 0.1, far: 150 }} onPointerMissed={() => onSelect(null)}>
        <color attach="background" args={['#eeeee6']} />
        <ambientLight intensity={1.5} />
        <hemisphereLight args={['#fffef5', '#b4b29f', 0.7]} />
        <directionalLight position={[16, 20, 10]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-26} shadow-camera-right={26} shadow-camera-top={22} shadow-camera-bottom={-22} shadow-normalBias={0.03} />
        <Shell />
        {showParking && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, 0.018, 3.9]} raycast={() => {}}>
            <planeGeometry args={[8, 3.8]} />
            <meshBasicMaterial color="#7a9972" transparent opacity={0.2} depthWrite={false} />
          </mesh>
        )}
        {showObjects && objects.map((o) => <SceneObject key={o.id} o={o} selected={selected === o.id} onSelect={() => onSelect(selected === o.id ? null : o.id)} />)}
        {showSpatial && validSpatialItems.map((item) => <SpatialBox key={item.id} item={item} selected={selectedSpatialId === item.id} onSelect={onSelectSpatial} />)}
        <OrientationLabels scope={scope} />
        <CameraControls scope={scope} command={cameraCommand} />
      </Canvas>
      {showHint && <div style={{ position: 'absolute', left: 12, bottom: 12, padding: '5px 8px', borderRadius: 5, color: '#62675a', background: '#f7f7eee8', font: '11px/1.4 system-ui, sans-serif', pointerEvents: 'none' }}>Drag to orbit · Scroll to zoom · Right-drag or two fingers to pan</div>}
    </div>
  )
}
