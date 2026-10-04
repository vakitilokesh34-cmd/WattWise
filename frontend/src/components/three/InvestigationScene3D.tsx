import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { useDeviceProfile } from '@/hooks/useDeviceProfile'

export interface InvestigationFact {
  label: string
  value: string
  tone: 'flux' | 'alert' | 'crit' | 'watt' | 'iris'
}

interface InvestigationScene3DProps {
  reference: string
  facts: InvestigationFact[]
  severityColor?: string
  className?: string
}

const TONE_HEX: Record<InvestigationFact['tone'], string> = {
  flux: '#22d3ee',
  alert: '#fbbf24',
  crit: '#f43f5e',
  watt: '#34d399',
  iris: '#a78bfa',
}

function Core({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    ref.current?.scale.setScalar(1 + Math.sin(t * 2.4) * 0.07)
    if (ring.current) ring.current.rotation.z = t * 0.6
  })
  return (
    <group>
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.8, 1]} />
        <meshStandardMaterial color="#0a1424" emissive={color} emissiveIntensity={1.1} roughness={0.3} metalness={0.5} flatShading />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.05, 20, 14]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.015, 8, 80]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Satellite({ position, color, index }: { position: THREE.Vector3; color: string; index: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    ref.current?.position.set(position.x, position.y + Math.sin(t * 1.4 + index) * 0.12, position.z)
  })
  return (
    <mesh ref={ref} position={position}>
      <octahedronGeometry args={[0.22, 0]} />
      <meshStandardMaterial color="#0a1424" emissive={color} emissiveIntensity={1} roughness={0.35} metalness={0.4} />
    </mesh>
  )
}

/**
 * Immersive AI-forensic scene: central anomaly node with satellites for
 * Expected / Actual / Deviation / Cost / Cause / Action, joined by animated links.
 * Fact cards render as HTML around the canvas (crisp text, no drei Html cost).
 */
export function InvestigationScene3D({ reference, facts, severityColor = '#f43f5e', className }: InvestigationScene3DProps) {
  const profile = useDeviceProfile()

  const satellites = useMemo(() => {
    const n = Math.max(1, facts.length)
    return facts.map((fact, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      const r = 3.1
      const pos = new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle * 1.3) * 1.15, Math.sin(angle) * r * 0.45)
      return { fact, pos, color: TONE_HEX[fact.tone] }
    })
  }, [facts])

  if (!profile.enable3D) return null

  return (
    <div className={className}>
      <div className="relative h-[24rem] w-full overflow-hidden rounded-2xl border border-crit-500/20 bg-[radial-gradient(120%_110%_at_50%_0%,#170b14_0%,#05080f_62%,#04070d_100%)] sm:h-[28rem]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-10 animate-scan-line bg-gradient-to-b from-transparent via-crit-500/[0.07] to-transparent" />
        </div>
        <Canvas dpr={profile.dpr} camera={{ position: [0, 1.6, 8.4], fov: 44 }} onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.55} />
            <pointLight position={[4, 4, 4]} intensity={1.2} color={severityColor} />
            <pointLight position={[-4, -2, -3]} intensity={0.4} color="#22d3ee" />
            <Core color={severityColor} />
            {satellites.map((sat, i) => (
              <group key={`${reference}-${i}`}>
                <Line points={[new THREE.Vector3(0, 0, 0), sat.pos]} color={sat.color} lineWidth={1.2} transparent opacity={0.6} dashed dashSize={0.12} gapSize={0.1} depthWrite={false} />
                <Satellite position={sat.pos} color={sat.color} index={i} />
              </group>
            ))}
            <gridHelper args={[16, 26, severityColor, '#1a1220']} position={[0, -2.4, 0]} />
          </Suspense>
          <OrbitControls enablePan={false} minDistance={4.5} maxDistance={14} enableDamping dampingFactor={0.08} autoRotate autoRotateSpeed={0.7} />
        </Canvas>

        <div className="absolute left-4 top-4 z-20">
          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-crit-300">AI forensic investigation</p>
          <p className="tnum mt-0.5 font-mono text-sm font-semibold text-ink-50">{reference}</p>
        </div>

        <div className="absolute inset-x-3 bottom-3 z-20 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {facts.slice(0, 6).map((fact) => (
            <div key={fact.label} className="rounded-xl border border-white/[0.08] bg-base-950/70 px-2.5 py-2 backdrop-blur-md">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-500">{fact.label}</p>
              <p className="tnum mt-0.5 truncate text-xs font-semibold" style={{ color: TONE_HEX[fact.tone] }}>{fact.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
