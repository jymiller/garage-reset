import { Component, useLayoutEffect, useMemo, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { BAGS, evaluatePlacement, footprint } from './placement'

export interface PickupSceneProps {
  site: { width: number; depth: number; roadWidth: number; sidewalkDepth: number }
  placement: { x: number; y: number; rotated: boolean }
  size: 'large' | 'medium'
  onPlace: (x: number, y: number) => void
  view: 'perspective' | 'top'
  valid: boolean
  fill: number
}

const labelStyle: CSSProperties = {
  color: '#c2d1cb', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', whiteSpace: 'nowrap',
  pointerEvents: 'none', textTransform: 'uppercase', textShadow: '0 1px 6px #071211',
}

function SceneLabel({ position, children, color, pill = false }: {
  position: [number, number, number]; children: ReactNode; color?: string; pill?: boolean
}) {
  return <Html center position={position} zIndexRange={[2, 0]} style={{ pointerEvents: 'none' }}>
    <div style={{ ...labelStyle, color: color ?? labelStyle.color,
      ...(pill ? { padding: '6px 9px', borderRadius: 5, background: '#132523eb', border: '1px solid #4a61574d' } : {}),
    }}>{children}</div>
  </Html>
}

/** Fit both camera types to the modeled site, including the road and context strip. */
function FittedCamera({ site, view }: Pick<PickupSceneProps, 'site' | 'view'>) {
  const camera = useThree((s) => s.camera)
  const screen = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const center = useMemo(() => new THREE.Vector3(site.width / 2, 0, (site.depth + 4 - site.roadWidth) / 2), [site.width, site.depth, site.roadWidth])
  const spanX = Math.max(site.width + 9, 21)
  const spanZ = site.depth + site.roadWidth + 10
  const span = Math.max(spanX, spanZ)

  useLayoutEffect(() => {
    const aspect = screen.width / Math.max(1, screen.height)
    if (camera instanceof THREE.OrthographicCamera) {
      camera.position.set(center.x, span * 2, center.z)
      camera.up.set(0, 0, -1)
      camera.lookAt(center)
      camera.zoom = Math.min(screen.width / spanX, screen.height / spanZ) * 0.91
      camera.updateProjectionMatrix()
    } else if (camera instanceof THREE.PerspectiveCamera) {
      camera.up.set(0, 1, 0)
      const direction = new THREE.Vector3(0.5, 0.94, -1.13).normalize()
      camera.position.copy(center).addScaledVector(direction, span * 2)
      camera.lookAt(center)
      camera.updateMatrixWorld()
      const horizontalFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * aspect)
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
      const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      const horizontalTangent = Math.tan(horizontalFov / 2)
      let distance = 0
      for (const x of [-4, site.width + 4]) for (const y of [0, 7]) {
        for (const z of [-site.roadWidth - 2, site.depth + 6]) {
          const p = new THREE.Vector3(x, y, z).sub(center)
          const alongView = p.dot(direction)
          distance = Math.max(distance, alongView + Math.abs(p.dot(right)) / horizontalTangent,
            alongView + Math.abs(p.dot(up)) / verticalTangent)
        }
      }
      camera.position.copy(center).addScaledVector(direction, distance * 1.09)
      camera.lookAt(center)
      camera.updateProjectionMatrix()
    }
    invalidate()
  }, [camera, screen.width, screen.height, center, span, spanX, spanZ, site.width, site.depth, site.roadWidth, view, invalidate])

  return <OrbitControls makeDefault target={center} enableRotate={view !== 'top'} enablePan={false}
    minDistance={span * 0.35} maxDistance={span * 4} minZoom={2} maxZoom={100}
    minPolarAngle={view === 'top' ? 0 : 0.14} maxPolarAngle={view === 'top' ? Math.PI : Math.PI / 2.25} enableDamping={false} />
}

function ApronGrid({ width, depth }: { width: number; depth: number }) {
  const { minor, major } = useMemo(() => {
    const minor: number[] = []
    const major: number[] = []
    for (let x = 1; x < width; x++) (x % 5 ? minor : major).push(x, 0.026, 0, x, 0.026, depth)
    for (let z = 1; z < depth; z++) (z % 5 ? minor : major).push(0, 0.026, z, width, 0.026, z)
    return { minor: new Float32Array(minor), major: new Float32Array(major) }
  }, [width, depth])
  return <>
    <lineSegments>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[minor, 3]} /></bufferGeometry>
      <lineBasicMaterial color="#3a5653" transparent opacity={0.4} />
    </lineSegments>
    <lineSegments>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[major, 3]} /></bufferGeometry>
      <lineBasicMaterial color="#789386" transparent opacity={0.28} />
    </lineSegments>
  </>
}

function Sidewalk({ width, depth }: { width: number; depth: number }) {
  const hatch = useMemo(() => {
    const points: number[] = []
    for (let start = -depth; start < width; start += 1.8) {
      const x1 = Math.max(0, start)
      const z1 = Math.max(0, -start)
      const x2 = Math.min(width, start + depth)
      const z2 = Math.min(depth, width - start)
      if (x2 > x1) points.push(x1, 0.07, z1, x2, 0.07, z2)
    }
    return new Float32Array(points)
  }, [width, depth])
  if (depth <= 0) return null
  return <>
    <mesh position={[width / 2, 0.04, depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} /><meshStandardMaterial color="#6b7467" transparent opacity={0.42} roughness={1} depthWrite={false} />
    </mesh>
    <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[hatch, 3]} /></bufferGeometry>
      <lineBasicMaterial color="#b7b6a0" transparent opacity={0.2} />
    </lineSegments>
    <Line points={[[0, 0.09, depth], [width, 0.09, depth]]} color="#bebca3" transparent opacity={0.7} lineWidth={1.2} dashed dashSize={0.35} gapSize={0.2} />
    <SceneLabel position={[width * 0.24, 0.2, depth / 2]} color="#d7d2b9" pill>Sidewalk · keep clear</SceneLabel>
  </>
}

/** A slightly bowed and slumped cloth wall, open at the top. */
function clothGeometry(width: number, depth: number, height: number, side: number) {
  const vertices: number[] = []
  const indices: number[] = []
  const count = 18
  const rows = 6
  for (let row = 0; row <= rows; row++) {
    const v = row / rows
    for (let column = 0; column <= count; column++) {
      const u = column / count
      const along = u - 0.5
      const taper = 0.86 + v * 0.14
      const wave = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.11
      const y = v * (height - 0.14 * Math.sin(u * Math.PI))
      const ripple = Math.sin(u * Math.PI * 8) * Math.sin(v * Math.PI) * 0.018
      if (side < 2) vertices.push(along * width * taper, y, (side ? 1 : -1) * (depth / 2 * taper + wave + ripple))
      else vertices.push((side === 2 ? -1 : 1) * (width / 2 * taper + wave + ripple), y, along * depth * taper)
      if (row < rows && column < count) {
        const i = row * (count + 1) + column
        indices.push(i, i + 1, i + count + 1, i + 1, i + count + 2, i + count + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function Handle({ x, z, height }: { x: number; z: number; height: number }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(x - 0.21, height - 0.2, z),
    new THREE.Vector3(x - 0.26, height + 0.45, z),
    new THREE.Vector3(x, height + 0.7, z),
    new THREE.Vector3(x + 0.26, height + 0.45, z),
    new THREE.Vector3(x + 0.21, height - 0.2, z),
  ]), [x, z, height])
  return <mesh castShadow><tubeGeometry args={[curve, 24, 0.055, 5, false]} />
    <meshStandardMaterial color="#dfb121" roughness={1} />
  </mesh>
}

function Sack({ placement, size, valid, fill }: Pick<PickupSceneProps, 'placement' | 'size' | 'valid' | 'fill'>) {
  const { width, depth } = footprint(size, placement.rotated)
  const height = BAGS[size].height
  const walls = useMemo(() => [0, 1, 2, 3].map((side) => clothGeometry(width, depth, height, side)), [width, depth, height])
  useLayoutEffect(() => () => walls.forEach((g) => g.dispose()), [walls])
  const fillFraction = Math.max(0, Math.min(1, fill / 100))
  const center: [number, number, number] = [placement.x + width / 2, 0.045, placement.y + depth / 2]
  const corners: [number, number, number][] = [
    [-width / 2 - 0.13, 0.012, -depth / 2 - 0.13], [width / 2 + 0.13, 0.012, -depth / 2 - 0.13],
    [width / 2 + 0.13, 0.012, depth / 2 + 0.13], [-width / 2 - 0.13, 0.012, depth / 2 + 0.13],
    [-width / 2 - 0.13, 0.012, -depth / 2 - 0.13],
  ]
  return <group position={center} onClick={(event) => event.stopPropagation()}>
    <Line points={corners} color={valid ? '#f3d15d' : '#f18064'} lineWidth={2} dashed dashSize={0.2} gapSize={0.12} />
    <mesh position={[0, 0.045, 0]} receiveShadow><boxGeometry args={[width * 0.87, 0.09, depth * 0.87]} />
      <meshStandardMaterial color="#be991e" roughness={1} />
    </mesh>
    {walls.map((geometry, index) => <mesh key={index} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={index % 2 ? '#e7bc2b' : '#eec933'} roughness={0.92} metalness={0} side={THREE.DoubleSide} />
    </mesh>)}
    {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Handle key={`${sx}-${sz}`} x={sx * width * 0.32} z={sz * depth * 0.49} height={height} />))}
    {[-1, 1].map((side) => <group key={side}>
      {[-1, 1].map((band) => <mesh key={band} position={[band * width * 0.32, height / 2, side * depth * 0.497]}>
        <boxGeometry args={[0.095, height * 0.95, 0.025]} /><meshStandardMaterial color="#d3a91e" roughness={1} />
      </mesh>)}
    </group>)}
    {fillFraction > 0.05 && <group>
      <mesh position={[0, Math.max(0.08, height * fillFraction * 0.62), 0]} castShadow receiveShadow>
        <boxGeometry args={[width * 0.75, Math.max(0.08, height * fillFraction * 0.5), depth * 0.72]} />
        <meshStandardMaterial color="#a89772" roughness={1} />
      </mesh>
      <mesh position={[-width * 0.2, height * fillFraction * 0.9, depth * 0.06]} rotation={[0, 0.2, -0.08]} castShadow>
        <boxGeometry args={[width * 0.28, Math.max(0.08, height * fillFraction * 0.19), depth * 0.52]} />
        <meshStandardMaterial color="#bca77e" roughness={1} />
      </mesh>
      <mesh position={[width * 0.16, height * fillFraction * 0.88, -depth * 0.12]} rotation={[0.12, -0.3, 0.05]} castShadow>
        <boxGeometry args={[width * 0.32, Math.max(0.06, height * fillFraction * 0.11), depth * 0.32]} />
        <meshStandardMaterial color="#c6bca4" roughness={1} />
      </mesh>
    </group>}
    <SceneLabel position={[0, height + 1.3, 0]} color="#f4d872" pill>{size} sack · {width.toFixed(1)} × {depth.toFixed(1)} ft</SceneLabel>
  </group>
}

/** Deliberately illustrative truck: only its location on the road carries meaning. */
function RoadTruck({ width, roadWidth }: { width: number; roadWidth: number }) {
  const truckWidth = Math.min(5.2, roadWidth * 0.62)
  const wheelZ = truckWidth / 2 + 0.03
  return <group position={[width / 2, 0, -roadWidth / 2]}>
    <mesh position={[0, 0.75, 0]} castShadow><boxGeometry args={[12.8, 0.35, truckWidth]} /><meshStandardMaterial color="#172a29" roughness={0.85} /></mesh>
    <mesh position={[4.2, 2, 0]} castShadow><boxGeometry args={[3.4, 2.5, truckWidth]} /><meshStandardMaterial color="#9caaa1" roughness={0.6} metalness={0.25} /></mesh>
    <mesh position={[4.3, 2.7, -truckWidth / 2 - 0.016]}><boxGeometry args={[2.4, 0.95, 0.035]} /><meshStandardMaterial color="#1e4245" roughness={0.2} metalness={0.45} /></mesh>
    <mesh position={[5.92, 2.7, 0]}><boxGeometry args={[0.035, 0.95, truckWidth * 0.85]} /><meshStandardMaterial color="#264b4b" roughness={0.2} metalness={0.4} /></mesh>
    <mesh position={[-2, 1.18, 0]} castShadow><boxGeometry args={[8.6, 0.25, truckWidth]} /><meshStandardMaterial color="#526762" roughness={0.9} /></mesh>
    <mesh position={[-2, 1.62, truckWidth / 2]} castShadow><boxGeometry args={[8.6, 0.65, 0.12]} /><meshStandardMaterial color="#4c615b" roughness={0.8} /></mesh>
    <mesh position={[1.1, 2.0, 0]} castShadow><boxGeometry args={[0.62, 2, 0.7]} /><meshStandardMaterial color="#aaa268" roughness={0.7} /></mesh>
    <mesh position={[-0.5, 3.1, 0]} rotation={[0, 0, -0.13]} castShadow><boxGeometry args={[3.8, 0.4, 0.5]} /><meshStandardMaterial color="#aaa268" roughness={0.7} /></mesh>
    {[-4.2, -2.2, 4.25].flatMap((x) => [-wheelZ, wheelZ].map((z) => <group key={`${x}-${z}`} position={[x, 0.74, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow><cylinderGeometry args={[0.73, 0.73, 0.36, 16]} /><meshStandardMaterial color="#0d1718" roughness={1} /></mesh>
      <mesh position={[0, z > 0 ? -0.2 : 0.2, 0]}><cylinderGeometry args={[0.33, 0.33, 0.045, 12]} /><meshStandardMaterial color="#85918a" metalness={0.65} roughness={0.6} /></mesh>
    </group>))}
  </group>
}

function GarageContext({ width, depth }: { width: number; depth: number }) {
  return <group>
    <mesh position={[width / 2, -0.02, depth + 2]} receiveShadow><boxGeometry args={[width, 0.18, 4]} /><meshStandardMaterial color="#152e2a" /></mesh>
    {[-0.12, width + 0.12].map((x) => <mesh key={x} position={[x, 3.45, depth + 2]}>
      <boxGeometry args={[0.22, 7, 4]} /><meshStandardMaterial color="#6a9081" transparent opacity={0.12} depthWrite={false} />
    </mesh>)}
    <mesh position={[width / 2, 6.95, depth + 2]}>
      <boxGeometry args={[width + 0.4, 0.14, 4.15]} /><meshStandardMaterial color="#557568" transparent opacity={0.13} depthWrite={false} />
    </mesh>
    <Line points={[[0, 0.06, depth], [0, 7, depth], [width, 7, depth], [width, 0.06, depth]]} color="#577c6b" transparent opacity={0.5} lineWidth={1} />
    <Line points={[[0, 7, depth + 4], [width, 7, depth + 4]]} color="#3b5e4f" transparent opacity={0.5} lineWidth={1} />
    <SceneLabel position={[width / 2, 7.65, depth + 1.3]} color="#8faa9d">Garage · context only</SceneLabel>
    <Line points={[[0, 0.06, depth], [width, 0.06, depth]]} color="#70887a" lineWidth={1.2} dashed dashSize={0.5} gapSize={0.3} />
  </group>
}

function Scene(props: PickupSceneProps) {
  const { site, placement, size, onPlace, valid, fill, view } = props
  const bag = footprint(size, placement.rotated)
  const laneStart = site.width / 2 - 2
  const roadDistance = evaluatePlacement(site, placement, size).roadDistance
  const farEdge = Math.abs(placement.y) > Math.abs(placement.y + bag.depth) ? placement.y : placement.y + bag.depth
  const measureX = placement.x + bag.width + 0.7
  return <>
    <color attach="background" args={['#102420']} />
    <ambientLight intensity={1.4} />
    <hemisphereLight args={['#ecf0d5', '#36594c', 1.6]} />
    <directionalLight position={[-8, 28, -15]} intensity={3.2} castShadow shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={50} shadow-camera-bottom={-50}
      shadow-camera-far={120} shadow-normalBias={0.05} />
    {view === 'top' ? <OrthographicCamera makeDefault position={[0, 70, 0]} near={0.1} far={500} />
      : <PerspectiveCamera makeDefault position={[28, 30, -30]} fov={38} near={0.1} far={500} />}
    <FittedCamera site={site} view={view} />

    <mesh position={[site.width / 2, -0.19, (site.depth - site.roadWidth) / 2]} receiveShadow>
      <boxGeometry args={[site.width + 16, 0.22, site.depth + site.roadWidth + 12]} />
      <meshStandardMaterial color="#112821" roughness={1} />
    </mesh>
    <mesh position={[site.width / 2, -0.025, -site.roadWidth / 2]} receiveShadow>
      <boxGeometry args={[site.width + 14, 0.14, site.roadWidth]} /><meshStandardMaterial color="#192c2b" roughness={1} />
    </mesh>
    <Line points={[[-6, 0.055, -site.roadWidth * 0.83], [site.width + 6, 0.055, -site.roadWidth * 0.83]]}
      color="#76847a" transparent opacity={0.35} lineWidth={1.2} dashed dashSize={2} gapSize={2} />
    <RoadTruck width={site.width} roadWidth={site.roadWidth} />
    <SceneLabel position={[site.width / 2, 0.1, -site.roadWidth + 0.5]} color="#7f9789" pill>Public road · illustrative truck</SceneLabel>

    <mesh position={[site.width / 2, -0.12, site.depth / 2]} receiveShadow>
      <boxGeometry args={[site.width, 0.24, site.depth]} /><meshStandardMaterial color="#2b4540" roughness={1} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[site.width / 2, 0.015, site.depth / 2]}
      onClick={(event) => {
        if (event.delta > 5) return
        event.stopPropagation()
        onPlace(Math.round((event.point.x - bag.width / 2) * 4) / 4, Math.round((event.point.z - bag.depth / 2) * 4) / 4)
      }}>
      <planeGeometry args={[site.width, site.depth]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    <ApronGrid width={site.width} depth={site.depth} />
    <Sidewalk width={site.width} depth={Math.min(site.sidewalkDepth, site.depth)} />
    <Line points={[[0, 0.055, 0], [site.width, 0.055, 0]]} color="#bdc2a9" lineWidth={2} />

    <mesh position={[site.width / 2, 0.045, site.depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[4, site.depth]} /><meshBasicMaterial color="#61c4b7" transparent opacity={0.055} depthWrite={false} />
    </mesh>
    {[laneStart, laneStart + 4].map((x) => <Line key={x} points={[[x, 0.07, 0], [x, 0.07, site.depth]]}
      color="#76b8ab" lineWidth={1.1} transparent opacity={0.6} dashed dashSize={0.38} gapSize={0.28} />)}

    {site.depth >= 20 && <>
      <Line points={[[0, 0.1, 20], [site.width, 0.1, 20]]} color="#ce9b53" lineWidth={1.3} dashed dashSize={0.55} gapSize={0.3} />
      <SceneLabel position={[site.width / 2, 0.4, 20]} color="#d2b784" pill>20 ft road reach boundary</SceneLabel>
    </>}

    <Line points={[[measureX, 0.16, 0], [measureX, 0.16, farEdge]]} color="#d9b747" lineWidth={1.5} dashed dashSize={0.2} gapSize={0.12} />
    {[0, farEdge].map((y, index) => <Line key={index} points={[[measureX - 0.22, 0.16, y], [measureX + 0.22, 0.16, y]]} color="#e2c769" lineWidth={1.5} />)}
    <SceneLabel position={[measureX + 0.3, 0.5, farEdge / 2]} color="#efd47a" pill>{roadDistance.toFixed(1)} ft</SceneLabel>
    <Sack placement={placement} size={size} valid={valid} fill={fill} />
    <GarageContext width={site.width} depth={site.depth} />

    <Line points={[[0, 0.07, -0.4], [site.width, 0.07, -0.4]]} color="#6b8273" lineWidth={1} />
    <SceneLabel position={[site.width / 2, 0.16, -0.6]} color="#98ab9d">{site.width} ft · apron width</SceneLabel>
    <SceneLabel position={[-0.8, 0.2, site.depth / 2]} color="#98ab9d">{site.depth} ft</SceneLabel>
  </>
}

function Unavailable() {
  return <div role="status" style={{ display: 'grid', alignContent: 'center', justifyItems: 'center', gap: 12,
    minHeight: 0, height: '100%', padding: 32, color: '#c7d5c8', textAlign: 'center', background: '#102420',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
    <span style={{ fontSize: 28, color: '#e4c46b' }} aria-hidden="true">◇</span>
    <strong style={{ fontSize: 16 }}>3D preview is unavailable in this browser</strong>
    <p style={{ maxWidth: 330, margin: 0, fontSize: 13, lineHeight: 1.7, color: '#93ac9a' }}>Use the 2D plan or position fields to place your sack. Your placement and measurements still work.</p>
  </div>
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <Unavailable /> : this.props.children }
}

export function PickupScene(props: PickupSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  return <div style={{ position: 'relative', height: '100%', minHeight: 0, width: '100%', overflow: 'hidden', background: '#102420' }}>
    <SceneBoundary>
      <Canvas ref={canvasRef} shadows frameloop="demand" dpr={[1, 1.8]} fallback={<Unavailable />}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%', minHeight: 0 }}>
        <Scene {...props} />
      </Canvas>
    </SceneBoundary>
    <div style={{ position: 'absolute', right: 18, bottom: 17, pointerEvents: 'none', color: '#6f8878',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', fontSize: 9 }}>1 ft grid</div>
  </div>
}

export default PickupScene
