import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { FloorState } from '@/utils/floorState'
import { COLORS, SCENE, floorBaseY, severityColor } from './sceneLayout'

interface FloorNodeProps {
  floor: FloorState
  hovered: boolean
  selected: boolean
  shadows: boolean
  animate: boolean
  onHover: (index: number | null) => void
  onSelect: (index: number) => void
}

/**
 * One interactive floor of the tower.
 *
 * Normal floor   → steady accent edge, gentle load-driven emissive breathing.
 * Anomalous floor→ pulsing ring marker, stronger edge glow and a soft additive
 *                  wash on the slab so the deviation is visible at a glance.
 */
export function FloorNode({
  floor,
  hovered,
  selected,
  shadows,
  animate,
  onHover,
  onSelect,
}: FloorNodeProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const edgeRef = useRef<THREE.MeshBasicMaterial>(null)

  const accent = useMemo(
    () => (floor.isAnomalous ? severityColor(floor.severity) : COLORS.flux),
    [floor.isAnomalous, floor.severity],
  )

  const y = floorBaseY(floor.index)
  const halfHeight = SCENE.floorHeight / 2
  const active = hovered || selected

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const intensity = 0.12 + floor.intensity * 0.5
    const breathe = animate ? 1 + Math.sin(time * (floor.isAnomalous ? 3.4 : 1.1) + floor.index) * (floor.isAnomalous ? 0.45 : 0.16) : 1

    if (materialRef.current) {
      materialRef.current.emissiveIntensity = intensity * breathe + (active ? 0.28 : 0)
    }
    if (edgeRef.current) {
      edgeRef.current.opacity = Math.min(1, (0.32 + floor.intensity * 0.5) * breathe + (active ? 0.3 : 0))
    }
  })

  return (
    <group position={[0, y, 0]}>
      {/* Interaction volume — deliberately invisible, generous hit target. */}
      <mesh
        position={[0, halfHeight, 0]}
        onPointerOver={(event) => {
          event.stopPropagation()
          onHover(floor.index)
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          onHover(null)
        }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(floor.index)
        }}
      >
        <boxGeometry args={[SCENE.buildingWidth, SCENE.floorHeight, SCENE.buildingDepth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Floor plate */}
      <mesh position={[0, SCENE.slabThickness / 2, 0]} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry
          args={[SCENE.buildingWidth + 0.26, SCENE.slabThickness, SCENE.buildingDepth + 0.26]}
        />
        <meshStandardMaterial
          ref={materialRef}
          color={COLORS.slab}
          roughness={0.42}
          metalness={0.35}
          emissive={accent}
          emissiveIntensity={0.2}
          transparent
          opacity={0.94}
        />
      </mesh>

      {/* Luminous front edge — the primary at-a-glance state signal */}
      <mesh position={[0, SCENE.slabThickness / 2 + 0.004, SCENE.buildingDepth / 2 + 0.14]}>
        <boxGeometry args={[SCENE.buildingWidth + 0.26, 0.05, 0.035]} />
        <meshBasicMaterial
          ref={edgeRef}
          color={accent}
          toneMapped={false}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>

      {/* Side edge accents (left/right) so the tower reads from any angle */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[
            side * (SCENE.buildingWidth / 2 + 0.14),
            SCENE.slabThickness / 2 + 0.004,
            0,
          ]}
        >
          <boxGeometry args={[0.035, 0.05, SCENE.buildingDepth + 0.26]} />
          <meshBasicMaterial
            color={accent}
            toneMapped={false}
            transparent
            opacity={floor.isAnomalous ? 0.42 : 0.18}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Anomaly wash across the slab */}
      {floor.isAnomalous ? (
        <mesh position={[0, SCENE.slabThickness + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[SCENE.buildingWidth, SCENE.buildingDepth]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.08}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}

      {/* Hover / selection highlight */}
      {active ? (
        <mesh position={[0, halfHeight, 0]}>
          <boxGeometry
            args={[SCENE.buildingWidth + 0.06, SCENE.floorHeight - 0.06, SCENE.buildingDepth + 0.06]}
          />
          <meshBasicMaterial
            color={COLORS.flux}
            wireframe
            transparent
            opacity={selected ? 0.34 : 0.16}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}

      {floor.isAnomalous ? (
        <PulseMarker
          position={[SCENE.buildingWidth / 2 - 0.42, 0.2, SCENE.buildingDepth / 2 + 0.24]}
          color={accent}
          animate={animate}
          severity={floor.severity}
        />
      ) : null}
    </group>
  )
}

/** Expanding ring used as the "something is wrong here" beacon. */
function PulseMarker({
  position,
  color,
  animate,
  severity,
}: {
  position: [number, number, number]
  color: string
  animate: boolean
  severity: FloorState['severity']
}) {
  const ringRef = useRef<THREE.Mesh>(null)
  const coreRef = useRef<THREE.Mesh>(null)

  const period = severity === 'critical' ? 1.05 : severity === 'high' ? 1.35 : 1.8

  useFrame((state) => {
    if (!animate) return
    const t = (state.clock.elapsedTime % period) / period
    if (ringRef.current) {
      const scale = 0.4 + t * 1.5
      ringRef.current.scale.setScalar(scale)
      const material = ringRef.current.material as THREE.MeshBasicMaterial
      material.opacity = (1 - t) * 0.7
    }
    if (coreRef.current) {
      const material = coreRef.current.material as THREE.MeshBasicMaterial
      material.opacity = 0.55 + Math.sin(state.clock.elapsedTime * 4) * 0.2
    }
  })

  return (
    <group position={position}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.7}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
