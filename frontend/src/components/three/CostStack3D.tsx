import { Suspense, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { motion } from 'framer-motion'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { useDeviceProfile } from '@/hooks/useDeviceProfile'
import { formatCurrency } from '@/utils/format'

interface CostStack3DProps {
  expectedCost: number
  excessCost: number
  tariff: number
  currency?: string
  onTariffChange?: (tariff: number) => void
  className?: string
}

const TARIFFS = [6, 7, 8, 8.4, 9.2, 11]

function Bar({ position, height, color, emissive }: { position: [number, number, number]; height: number; color: string; emissive: string }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ref.current) {
      const s = 1 + Math.sin(t * 1.6 + position[0]) * 0.012
      ref.current.scale.set(s, 1, s)
    }
  })
  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[1.15, Math.max(0.12, height), 1.15]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.45} roughness={0.35} metalness={0.35} transparent opacity={0.94} />
    </mesh>
  )
}

/**
 * Cost intelligence: Expected + Excess = Total as a 3D stacked bar pair.
 * Tariff pills re-price instantly with animated count-ups (Expected/Excess/Total).
 */
export function CostStack3D({ expectedCost, excessCost, tariff, currency = 'INR', onTariffChange, className }: CostStack3DProps) {
  const profile = useDeviceProfile()
  const total = expectedCost + excessCost
  const max = Math.max(1, expectedCost, excessCost, total / 2)
  const animatedExpected = useAnimatedNumber(expectedCost)
  const animatedExcess = useAnimatedNumber(excessCost)
  const animatedTotal = useAnimatedNumber(total)

  return (
    <div className={className}>
      <div className="glass overflow-hidden p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="panel-title">Cost intelligence</p>
            <p className="tnum mt-1 text-2xl font-semibold tracking-tight text-ink-50">{formatCurrency(animatedTotal, currency)}</p>
            <p className="mt-0.5 text-2xs text-ink-500">Expected + Excess = Total · estimates only</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-2xs font-medium uppercase tracking-[0.14em] text-ink-500">Tariff</span>
            {TARIFFS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onTariffChange?.(option)}
                aria-pressed={tariff === option}
                className={`tnum rounded-full border px-2.5 py-1 text-2xs font-semibold transition duration-200 ${tariff === option ? 'border-flux-400/40 bg-flux-500/15 text-flux-200' : 'border-white/[0.08] bg-white/[0.02] text-ink-500 hover:text-ink-200'}`}
              >
                ₹{option}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
          <div className="relative h-56 overflow-hidden rounded-xl border border-white/[0.06] bg-base-950/60">
            {profile.enable3D ? (
              <Canvas dpr={profile.dpr} camera={{ position: [4.4, 3.4, 6.4], fov: 40 }} onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}>
                <Suspense fallback={null}>
                  <ambientLight intensity={0.7} />
                  <pointLight position={[4, 5, 4]} intensity={1} color="#22d3ee" />
                  <Bar position={[-1.1, (expectedCost / max) * 1.6, 0]} height={(expectedCost / max) * 3.2} color="#0e3a44" emissive="#22d3ee" />
                  <Bar position={[0.35, (excessCost / max) * 1.6, 0]} height={(excessCost / max) * 3.2} color="#451a24" emissive="#f43f5e" />
                  <Bar position={[1.8, (total / 2 / max) * 1.6, 0]} height={(total / 2 / max) * 3.2} color="#1a2140" emissive="#a78bfa" />
                  <gridHelper args={[10, 16, '#22d3ee', '#101c30']} position={[0, -0.4, 0]} />
                </Suspense>
                <OrbitControls enablePan={false} enableZoom={false} enableDamping autoRotate autoRotateSpeed={0.9} maxPolarAngle={Math.PI / 1.8} />
              </Canvas>
            ) : null}
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-6 text-[9px] font-semibold uppercase tracking-[0.16em]">
              <span className="text-flux-300">Expected</span>
              <span className="text-crit-300">Excess</span>
              <span className="text-iris-300">Total ÷ 2</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {[
              { label: 'Energy cost', hint: 'Total recorded', value: animatedTotal, color: 'text-ink-50', bar: 'bg-iris-400/70', pct: 100 },
              { label: 'Expected cost', hint: `Baseline @ ₹${tariff}/kWh`, value: animatedExpected, color: 'text-flux-300', bar: 'bg-flux-400/70', pct: total > 0 ? (expectedCost / total) * 100 : 0 },
              { label: 'Excess cost', hint: 'Waste to recover', value: animatedExcess, color: 'text-crit-300', bar: 'bg-crit-400/70', pct: total > 0 ? (excessCost / total) * 100 : 0 },
            ].map((row, i) => (
              <motion.div key={row.label} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, duration: 0.35 }} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-2xs font-medium text-ink-400">{row.label}</p>
                  <p className={`tnum text-sm font-semibold ${row.color}`}>{formatCurrency(row.value, currency)}</p>
                </div>
                <p className="mt-0.5 text-2xs text-ink-600">{row.hint}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div className={`h-full rounded-full ${row.bar}`} animate={{ width: `${Math.max(3, row.pct)}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
