import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { COLORS, SCENE } from './sceneLayout'

interface EnergyMeterProps {
  /** 0–1 utilisation, drives the dial sweep and core brightness. */
  load: number
  animate: boolean
  /** Building-wide severity tint. */
  tint: string | null
}

/**
 * Central energy meter at the base of the tower — the origin of the flow.
 * Purely decorative: the numeric readouts live in the DOM overlay so they stay
 * crisp and accessible.
 */
export function EnergyMeter({ load, animate, tint }: EnergyMeterProps) {
  const dialRef = useRef<THREE.Mesh>(null)
  const coreRef = useRef<THREE.MeshBasicMaterial>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const sweepRef = useRef<THREE.Mesh>(null)

  const clamped = Math.max(0.04, Math.min(1, load))
  const accent = tint ?? COLORS.flux

  const bezelSegments = useMemo(() => new THREE.TorusGeometry(0.42, 0.045, 10, 40), [])

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime

    if (sweepRef.current) {
      // Rotating sweep = "meter is live".
      sweepRef.current.rotation.z = animate ? time * 0.9 : 0
    }

    if (dialRef.current) {
      // The lit arc grows with utilisation.
      const target = 0.2 + clamped * 1.35
      dialRef.current.scale.x += (target - dialRef.current.scale.x) * Math.min(1, delta * 3)
    }

    if (coreRef.current) {
      const breathe = animate ? 0.55 + Math.sin(time * 2.1) * 0.18 : 0.6
      coreRef.current.opacity = breathe
    }

    if (haloRef.current) {
      const material = haloRef.current.material as THREE.MeshBasicMaterial
      material.opacity = animate ? 0.12 + Math.sin(time * 1.6) * 0.05 : 0.1
    }
  })

  return (
    <group position={[SCENE.meterPosition.x, SCENE.meterPosition.y, SCENE.meterPosition.z]}>
      {/* Pedestal */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.74, 0.12, 28]} />
        <meshStandardMaterial color={COLORS.slab} roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Meter body */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.86, 0.86, 0.34]} />
        <meshStandardMaterial color="#0d1728" roughness={0.3} metalness={0.65} />
      </mesh>

      {/* Bezel */}
      <mesh position={[0, 0.5, 0.19]} rotation={[0, 0, 0]}>
        <primitive object={bezelSegments} attach="geometry" />
        <meshStandardMaterial color={COLORS.fluxDim} roughness={0.25} metalness={0.8} />
      </mesh>

      {/* Dial face */}
      <mesh position={[0, 0.5, 0.185]}>
        <circleGeometry args={[0.36, 32]} />
        <meshBasicMaterial color="#050a12" toneMapped={false} />
      </mesh>

      {/* Utilisation arc (scaled horizontally to fake a radial gauge) */}
      <mesh ref={dialRef} position={[0, 0.5, 0.195]} scale={[0.6, 0.6, 1]}>
        <ringGeometry args={[0.24, 0.33, 28, 1, Math.PI * 0.75, Math.PI * 1.5]} />
        <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={0.9} />
      </mesh>

      {/* Rotating sweep */}
      <mesh ref={sweepRef} position={[0, 0.5, 0.2]}>
        <ringGeometry args={[0.08, 0.35, 24, 1, 0, 0.5]} />
        <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={0.22} />
      </mesh>

      {/* Emissive core */}
      <mesh position={[0, 0.5, 0.21]}>
        <circleGeometry args={[0.075, 16]} />
        <meshBasicMaterial ref={coreRef} color={accent} toneMapped={false} transparent opacity={0.6} />
      </mesh>

      {/* Soft halo (cheap stand-in for bloom) */}
      <mesh ref={haloRef} position={[0, 0.5, 0.16]}>
        <circleGeometry args={[0.62, 28]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
