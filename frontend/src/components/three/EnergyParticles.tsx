import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { COLORS, severityColor, type FlowPath } from './sceneLayout'

interface EnergyParticlesProps {
  paths: FlowPath[]
  /** Hard cap on simultaneously rendered particles. */
  budget: number
  /** Global animation multiplier; 0 freezes. */
  speed: number
  animate: boolean
  opacity?: number
}

interface Particle {
  pathIndex: number
  offset: number
  rate: number
  phase: number
}

function createSprite(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.6)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

/**
 * Energy packets travelling along the flow paths.
 *
 * Performance notes:
 *  - one `THREE.Points` draw call for the entire system
 *  - positions are written into a preallocated Float32Array (never reallocated)
 *  - total count is capped by `budget` (quality tier)
 *  - anomalous floors receive a larger share of the budget and a faster rate
 */
export function EnergyParticles({
  paths,
  budget,
  speed,
  animate,
  opacity = 0.9,
}: EnergyParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const sprite = useMemo(() => createSprite(), [])

  const { particles, positions, colors, count } = useMemo(() => {
    const total = Math.max(12, Math.min(budget, 420))

    const weights = paths.map((p) => Math.max(0.2, p.weight))
    const weightSum = weights.reduce((a, b) => a + b, 0) || 1

    const list: Particle[] = []
    for (let i = 0; i < total; i += 1) {
      // Weighted pick so busy / anomalous floors carry visibly more traffic.
      let roll = (i / total) * weightSum
      let pathIndex = paths.length - 1
      for (let p = 0; p < weights.length; p += 1) {
        roll -= weights[p]
        if (roll <= 0) {
          pathIndex = p
          break
        }
      }
      const path = paths[pathIndex]
      const intensity = path?.floorIndex === 0 ? 0.5 : ((path?.weight ?? 0.55) - 0.55) / 1.15
      list.push({
        pathIndex,
        offset: (i / total) % 1,
        rate: 0.055 + intensity * 0.08 + ((i * 37) % 11) / 240,
        phase: ((i * 53) % 100) / 100 * Math.PI * 2,
      })
    }

    const positionArray = new Float32Array(total * 3)
    const colorArray = new Float32Array(total * 3)

    // Per-path colour: cyan for trunk, severity colour for floor branches.
    paths.forEach((path, pathIndex) => {
      const color = new THREE.Color(path.floorIndex === 0 ? COLORS.flux : severityColor(path.severity))
      list.forEach((particle, i) => {
        if (particle.pathIndex !== pathIndex) return
        colorArray[i * 3] = color.r
        colorArray[i * 3 + 1] = color.g
        colorArray[i * 3 + 2] = color.b
      })
    })

    // Seed each particle along its own curve (one pass — never per path).
    list.forEach((particle, i) => {
      const curve = paths[particle.pathIndex]?.curve
      if (!curve) return
      const point = curve.getPointAt(particle.offset)
      positionArray[i * 3] = point.x
      positionArray[i * 3 + 1] = point.y
      positionArray[i * 3 + 2] = point.z
    })

    return { particles: list, positions: positionArray, colors: colorArray, count: total }
  }, [paths, budget])

  useEffect(() => () => sprite.dispose(), [sprite])

  useFrame((state, delta) => {
    const points = pointsRef.current
    if (!points) return
    if (!animate || speed <= 0) return

    const step = Math.min(0.05, delta) * speed
    const time = state.clock.elapsedTime

    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i]
      const curve = paths[particle.pathIndex]?.curve
      if (!curve) continue

      particle.offset = (particle.offset + particle.rate * step) % 1
      const point = curve.getPointAt(particle.offset)
      // Gentle bob keeps the motion organic rather than mechanical.
      const bob = Math.sin(time * 1.6 + particle.phase) * 0.014
      positions[i * 3] = point.x
      positions[i * 3 + 1] = point.y + bob
      positions[i * 3 + 2] = point.z
    }

    points.geometry.attributes.position.needsUpdate = true
  })

  if (paths.length === 0) return null

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        size={0.14}
        sizeAttenuation
        vertexColors
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}
