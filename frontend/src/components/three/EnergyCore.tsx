import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { useDeviceProfile } from '@/hooks/useDeviceProfile'

export type PulseState = 'normal' | 'warning' | 'anomaly' | 'critical'

const STATE_COLOR: Record<PulseState, string> = {
  normal: '#22d3ee',
  warning: '#fbbf24',
  anomaly: '#fb923c',
  critical: '#f43f5e',
}

interface EnergyCoreProps {
  currentKwh: number
  expectedKwh: number
  state: PulseState
  efficiencyPct?: number | null
  className?: string
}

function stateFromRatio(ratio: number): PulseState {
  if (ratio >= 1.6) return 'critical'
  if (ratio >= 1.25) return 'anomaly'
  if (ratio >= 1.05) return 'warning'
  return 'normal'
}

export function resolvePulseState(currentKwh: number, expectedKwh: number, forced?: PulseState): PulseState {
  if (forced) return forced
  if (!expectedKwh || expectedKwh <= 0) return 'normal'
  return stateFromRatio(currentKwh / expectedKwh)
}

/** Inward-spiralling particle field. Speed + brightness scale with load ratio. */
function ParticleSwarm({ count, color, speed, radius = 3.4 }: { count: number; color: string; speed: number; radius?: number }) {
  const ref = useRef<THREE.Points>(null)
  const { positions, angles, radii, heights } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const angles = new Float32Array(count)
    const radii = new Float32Array(count)
    const heights = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2
      const r = radius * (0.55 + Math.random() * 0.85)
      const y = (Math.random() - 0.5) * 4.4
      angles[i] = a
      radii[i] = r
      heights[i] = y
      positions[i * 3] = Math.cos(a) * r
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = Math.sin(a) * r
    }
    return { positions, angles, radii, heights }
  }, [count, radius])

  useFrame((_, delta) => {
    const points = ref.current
    if (!points) return
    const pos = points.geometry.attributes.position as THREE.BufferAttribute
    const step = Math.min(0.05, delta) * speed
    for (let i = 0; i < count; i += 1) {
      angles[i] += step * (0.55 + (radii[i] % 1) * 0.2)
      // Slow inward drift, respawn outward — reads as "flowing toward the core".
      radii[i] -= step * 0.12
      if (radii[i] < 1.05) radii[i] = radius * (0.9 + Math.random() * 0.5)
      pos.setXYZ(i, Math.cos(angles[i]) * radii[i], heights[i] * Math.cos(angles[i] * 0.3), Math.sin(angles[i]) * radii[i])
    }
    pos.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color={color} transparent opacity={0.85} sizeAttenuation depthWrite={false} />
    </points>
  )
}

function CoreSphere({ color, intensity, animate }: { color: string; intensity: number; animate: boolean }) {
  const outer = useRef<THREE.Mesh>(null)
  const wire = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (!animate) return
    if (outer.current) {
      const s = 1 + Math.sin(t * (1.2 + intensity * 1.6)) * 0.035 * (1 + intensity)
      outer.current.scale.setScalar(s)
    }
    if (wire.current) {
      wire.current.rotation.y = t * (0.25 + intensity * 0.5)
      wire.current.rotation.x = Math.sin(t * 0.3) * 0.35
    }
    if (glow.current) {
      const material = glow.current.material as THREE.MeshBasicMaterial
      material.opacity = 0.1 + intensity * 0.08 + Math.sin(t * 2.2) * 0.03
    }
  })

  return (
    <group>
      {/* soft halo */}
      <mesh ref={glow}>
        <sphereGeometry args={[1.9, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} />
      </mesh>
      {/* solid core */}
      <mesh ref={outer}>
        <sphereGeometry args={[1.05, 48, 48]} />
        <meshStandardMaterial color="#0a1424" emissive={color} emissiveIntensity={0.55 + intensity * 0.9} roughness={0.25} metalness={0.6} />
      </mesh>
      {/* rotating grid shell */}
      <mesh ref={wire}>
        <sphereGeometry args={[1.32, 20, 14]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* orbit rings */}
      <mesh rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[2.1, 0.012, 8, 90]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 1.7, 0.4, 0]}>
        <torusGeometry args={[2.55, 0.01, 8, 90]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Scene({ currentKwh, expectedKwh, state, particleBudget, animate }: { currentKwh: number; expectedKwh: number; state: PulseState; particleBudget: number; animate: boolean }) {
  const ratio = expectedKwh > 0 ? currentKwh / expectedKwh : 1
  const intensity = Math.min(1.6, Math.max(0, ratio - 1))
  const color = STATE_COLOR[state]
  const speed = 0.5 + Math.min(2.4, Math.max(0, ratio - 0.6)) * 0.9

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 4, 4]} intensity={1.1} color={color} />
      <pointLight position={[-4, -2, -3]} intensity={0.4} color="#8b5cf6" />
      <CoreSphere color={color} intensity={intensity} animate={animate} />
      <ParticleSwarm count={particleBudget} color={color} speed={animate ? speed : 0} />
      {/* ground grid */}
      <gridHelper args={[14, 28, color, '#16233a']} position={[0, -2.6, 0]} />
    </>
  )
}

/**
 * ENERGY CORE — the visual identity of the Control Center.
 *
 * A rotating energy sphere with particles flowing inward. Speed/brightness
 * encode load; colour encodes status (cyan normal → amber warning → red critical).
 * Paired with the numeric readout beside it, this answers the 5-second UX test.
 */
export function EnergyCore({ currentKwh, expectedKwh, state, efficiencyPct, className }: EnergyCoreProps) {
  const profile = useDeviceProfile()
  const excess = Math.max(0, currentKwh - expectedKwh)
  const color = STATE_COLOR[state]

  if (!profile.enable3D) return null

  return (
    <div className={className}>
      <div className="relative h-full min-h-[340px] w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[radial-gradient(120%_110%_at_50%_0%,#0b1524_0%,#05080f_62%,#04070d_100%)]">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-70" />
        <div className="pointer-events-none absolute inset-0 bg-grid-fade" />

        <Canvas
          dpr={profile.dpr}
          gl={{ antialias: profile.quality === 'high', alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 1.4, 7.2], fov: 42, near: 0.1, far: 60 }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <Suspense fallback={null}>
            <Scene
              currentKwh={currentKwh}
              expectedKwh={expectedKwh}
              state={state}
              particleBudget={profile.particleBudget}
              animate={!profile.reducedMotion}
            />
          </Suspense>
        </Canvas>

        {/* Energy Pulse status pill — signature feature */}
        <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full" style={{ background: color }} />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          </span>
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-ink-500">Energy pulse</p>
            <p className="text-xs font-semibold capitalize" style={{ color }}>
              {state === 'normal' ? 'Stable flow' : state === 'warning' ? 'Elevated load' : state === 'anomaly' ? 'Anomaly — investigating' : 'Critical anomaly'}
            </p>
          </div>
        </div>

        {/* Real-time readout overlay */}
        <div className="absolute inset-x-0 bottom-0 z-20 grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
          {[
            { label: 'Current', value: `${currentKwh.toFixed(0)} kWh`, strong: true, c: '#f5f8ff' },
            { label: 'Expected', value: `${expectedKwh.toFixed(0)} kWh`, strong: false, c: '#a5f3fc' },
            { label: 'Excess', value: `${excess.toFixed(0)} kWh`, strong: true, c: excess > 0 ? '#fbbf24' : '#34d399' },
            { label: 'Efficiency', value: efficiencyPct != null ? `${efficiencyPct.toFixed(1)}%` : '—', strong: false, c: '#c4b5fd' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/[0.07] bg-base-950/60 px-3 py-2 backdrop-blur-md">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-500">{item.label}</p>
              <p className="tnum mt-0.5 text-sm font-semibold" style={{ color: item.c }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
