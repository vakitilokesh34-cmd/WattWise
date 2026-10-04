import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { COLORS, sampleCurve, severityColor, type FlowPath } from './sceneLayout'

interface EnergyFlowProps {
  paths: FlowPath[]
  /** Multiplies dash travel speed; 0 freezes the flow. */
  speed: number
  opacity?: number
  lineWidth?: number
  segments?: number
}

/**
 * Meter → building → floor energy conduits.
 *
 * Rendered as dashed polylines whose dash offset advances every frame, giving
 * directional motion without any particle budget.
 */
// Drei's <Line> renders a three-stdlib Line2 (an Object3D-backed mesh), so the
// refs are typed loosely and the material is read through a narrow cast.
type DashCapable = THREE.Mesh | null

export function EnergyFlow({
  paths,
  speed,
  opacity = 0.55,
  lineWidth = 1.4,
  segments = 40,
}: EnergyFlowProps) {
  const lineRefs = useRef<DashCapable[]>([])

  const prepared = useMemo(
    () =>
      paths.map((path) => ({
        id: path.id,
        points: sampleCurve(path.curve, segments),
        color: path.floorIndex === 0 ? COLORS.flux : severityColor(path.severity),
        dashed: true,
      })),
    [paths, segments],
  )

  useFrame((_, delta) => {
    if (speed <= 0) return
    const step = Math.min(0.05, delta) * speed
    for (const line of lineRefs.current) {
      if (!line) continue
      const material = line.material as THREE.Material & { dashOffset?: number }
      if (Array.isArray(material)) continue
      if (typeof material.dashOffset === 'number') {
        material.dashOffset -= step
      }
    }
  })

  return (
    <group>
      {prepared.map((path, index) => (
        <Line
          key={path.id}
          ref={(instance) => {
            lineRefs.current[index] = instance as DashCapable
          }}
          points={path.points}
          color={path.color}
          lineWidth={lineWidth}
          dashed
          dashSize={0.14}
          gapSize={0.12}
          transparent
          opacity={opacity}
          depthWrite={false}
          toneMapped={false}
        />
      ))}
    </group>
  )
}
