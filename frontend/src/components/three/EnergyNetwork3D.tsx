import { Suspense, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { useDeviceProfile } from '@/hooks/useDeviceProfile'
import type { Severity } from '@/types'

export interface FlowNode {
  id: string
  label: string
  sub: string
  consumptionKwh: number
  expectedKwh: number
  status: 'normal' | 'anomaly'
  severity?: Severity
  detail: string
}

interface EnergyNetwork3DProps {
  nodes?: FlowNode[]
  className?: string
  onSelect?: (node: FlowNode) => void
}

const DEFAULT_NODES: FlowNode[] = [
  { id: 'source', label: 'Power Source', sub: 'Grid intake · 11 kV', consumptionKwh: 180, expectedKwh: 100, status: 'normal', detail: 'Utility feed stable. Voltage within tolerance.' },
  { id: 'building', label: 'Building', sub: 'Aurora Business Park', consumptionKwh: 180, expectedKwh: 100, status: 'normal', detail: 'Whole-building meter. Deviation originates downstream.' },
  { id: 'floor', label: 'Floor 3', sub: 'East wing · AHU zone', consumptionKwh: 96, expectedKwh: 52, status: 'anomaly', severity: 'high', detail: 'Floor submeter carries 55% of total excess.' },
  { id: 'equipment', label: 'HVAC-01', sub: 'Chiller + AHU loop', consumptionKwh: 72, expectedKwh: 40, status: 'anomaly', severity: 'high', detail: 'Runtime 19:00–01:00 vs scheduled 09:00–19:00.' },
  { id: 'consumption', label: 'Energy Consumption', sub: '180 kWh recorded', consumptionKwh: 180, expectedKwh: 100, status: 'anomaly', severity: 'medium', detail: 'Total window consumption vs learned baseline.' },
]

function Travellers({ from, to, color, count, speed }: { from: THREE.Vector3; to: THREE.Vector3; color: string; count: number; speed: number }) {
  const ref = useRef<THREE.Points>(null)
  const offsets = useMemo(() => Float32Array.from({ length: count }, () => Math.random()), [count])
  const positions = useMemo(() => new Float32Array(count * 3), [count])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    const points = ref.current
    if (!points) return
    const t = clock.getElapsedTime() * speed
    const pos = points.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < count; i += 1) {
      const k = (offsets[i] + t * 0.12) % 1
      tmp.lerpVectors(from, to, k)
      tmp.y += Math.sin(k * Math.PI) * 0.35
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z)
    }
    pos.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.09} color={color} transparent opacity={0.95} depthWrite={false} sizeAttenuation />
    </points>
  )
}

function NetNode({ position, node, active, hovered, onHover, onClick }: {
  position: [number, number, number]
  node: FlowNode
  active: boolean
  hovered: boolean
  onHover: (id: string | null) => void
  onClick: () => void
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const color = node.status === 'anomaly' ? (node.severity === 'high' || node.severity === 'critical' ? '#f43f5e' : '#fbbf24') : '#22d3ee'
  useFrame(({ clock }) => {
    if (!mesh.current) return
    const t = clock.getElapsedTime()
    const s = 1 + Math.sin(t * 2 + position[0]) * (node.status === 'anomaly' ? 0.09 : 0.04)
    mesh.current.scale.setScalar(active || hovered ? s * 1.25 : s)
  })
  return (
    <group position={position}>
      <mesh
        ref={mesh}
        onPointerOver={(e) => { e.stopPropagation(); onHover(node.id) }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { e.stopPropagation(); onClick() }}
      >
        <sphereGeometry args={[0.42, 28, 28]} />
        <meshStandardMaterial color="#0a1424" emissive={color} emissiveIntensity={active || hovered ? 1.4 : 0.75} roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.62, 20, 14]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {(active || hovered) && (
        <mesh>
          <sphereGeometry args={[0.85, 20, 14]} />
          <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

/**
 * 3D connected energy network: Power Source → Building → Floor → Equipment → Consumption.
 * Glowing particles travel along each edge; hover/click a node for the forensic tooltip.
 * Drag to rotate, scroll to zoom (damped OrbitControls, GPU-cheap line segments).
 */
export function EnergyNetwork3D({ nodes = DEFAULT_NODES, className, onSelect }: EnergyNetwork3DProps) {
  const profile = useDeviceProfile()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>(nodes[3]?.id ?? 'equipment')

  const positions = useMemo(() => {
    const n = nodes.length
    return nodes.map((node, i) => {
      const x = (i - (n - 1) / 2) * 2.6
      const y = Math.sin(i * 1.1) * 0.55
      return { node, pos: new THREE.Vector3(x, y, 0), flat: [x, y, 0] as [number, number, number] }
    })
  }, [nodes])

  const active = positions.find((p) => p.node.id === (hoveredId ?? selectedId)) ?? positions[0]

  if (!profile.enable3D) {
    return (
      <div className={className}>
        <div className="grid gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          {nodes.map((node) => (
            <button key={node.id} type="button" onClick={() => { setSelectedId(node.id); onSelect?.(node) }} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-base-900/60 px-3 py-2 text-left">
              <span className="text-xs font-semibold text-ink-100">{node.label}</span>
              <span className="tnum text-2xs text-ink-400">{node.consumptionKwh} kWh</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="relative h-[22rem] w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[radial-gradient(120%_110%_at_50%_0%,#0b1524_0%,#05080f_62%,#04070d_100%)] sm:h-[26rem]">
        <div className="pointer-events-none absolute inset-0 bg-grid-fade" />
        <Canvas dpr={profile.dpr} camera={{ position: [0, 2.6, 9.5], fov: 44 }} onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.6} />
            <pointLight position={[5, 5, 5]} intensity={1} color="#22d3ee" />
            {positions.slice(0, -1).map((slot, i) => {
              const next = positions[i + 1]
              const anomalyEdge = next.node.status === 'anomaly'
              return (
                <group key={`${slot.node.id}-${next.node.id}`}>
                  <Line points={[slot.pos, next.pos]} color={anomalyEdge ? '#f43f5e' : '#22d3ee'} lineWidth={1.6} transparent opacity={anomalyEdge ? 0.85 : 0.5} dashed dashSize={0.16} gapSize={0.12} depthWrite={false} />
                  <Travellers from={slot.pos} to={next.pos} color={anomalyEdge ? '#fda4af' : '#a5f3fc'} count={profile.quality === 'low' ? 6 : 12} speed={anomalyEdge ? 1.6 : 0.8} />
                </group>
              )
            })}
            {positions.map((slot) => (
              <NetNode
                key={slot.node.id}
                position={slot.flat}
                node={slot.node}
                active={selectedId === slot.node.id}
                hovered={hoveredId === slot.node.id}
                onHover={setHoveredId}
                onClick={() => { setSelectedId(slot.node.id); onSelect?.(slot.node) }}
              />
            ))}
            <gridHelper args={[20, 30, '#22d3ee', '#101c30']} position={[0, -2.2, 0]} />
          </Suspense>
          <OrbitControls enablePan={false} minDistance={5} maxDistance={16} maxPolarAngle={Math.PI / 1.7} enableDamping dampingFactor={0.08} />
        </Canvas>

        {/* axis labels */}
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center gap-1.5 px-3">
          {positions.map((slot) => (
            <span key={slot.node.id} className={`hidden rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider backdrop-blur-md md:inline-block ${slot.node.status === 'anomaly' ? 'border-crit-500/40 bg-crit-500/10 text-crit-300' : 'border-flux-400/30 bg-flux-500/10 text-flux-300'}`}>
              {slot.node.label}
            </span>
          ))}
        </div>

        {/* hover / selection tooltip — matches the spec card */}
        <div className="absolute bottom-3 left-3 z-20 w-60 max-w-[calc(100%-1.5rem)] rounded-xl border border-white/[0.09] bg-base-950/80 p-3.5 shadow-lift backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-ink-500">Equipment</p>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${active.node.status === 'anomaly' ? 'bg-crit-500/15 text-crit-300' : 'bg-watt-400/12 text-watt-300'}`}>
              {active.node.status === 'anomaly' ? 'Anomaly' : 'Normal'}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-ink-50">{active.node.id === 'equipment' ? 'HVAC-01' : active.node.label}</p>
          <dl className="tnum mt-2 space-y-1 text-2xs">
            <div className="flex justify-between"><dt className="text-ink-500">Consumption</dt><dd className="font-semibold text-ink-100">{active.node.consumptionKwh} kWh</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Expected</dt><dd className="text-ink-300">{active.node.expectedKwh} kWh</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Deviation</dt><dd className="font-semibold text-alert-300">+{Math.round(((active.node.consumptionKwh - active.node.expectedKwh) / Math.max(1, active.node.expectedKwh)) * 100)}%</dd></div>
          </dl>
          <p className="mt-2 border-t border-white/[0.06] pt-2 text-2xs leading-relaxed text-ink-400">{active.node.detail}</p>
          <p className="mt-2 text-[10px] text-ink-600">Hover nodes · drag to rotate · scroll to zoom</p>
        </div>
      </div>
    </div>
  )
}
