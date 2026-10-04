import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { FloorState } from '@/utils/floorState'
import { COLORS, SCENE, towerHeight } from './sceneLayout'

interface BuildingMeshProps {
  floors: FloorState[]
  shadows: boolean
  animate: boolean
  /** Renders the window instancing at all (disabled on low quality). */
  detailed: boolean
}

const WINDOW_COLS = 6
const WINDOW_ROWS = 2
const WINDOW_W = 0.44
const WINDOW_H = 0.44

interface WindowSlot {
  position: [number, number, number]
  rotation: [number, number, number]
  floorIndex: number
}

/**
 * The building shell: glazing, structural core and window grid.
 *
 * Windows are a single `InstancedMesh` (one draw call for the whole tower).
 * Lit windows pulse only on floors that currently carry an anomaly, which keeps
 * per-frame work proportional to the number of *problem* floors, not total
 * windows.
 */
export function BuildingMesh({ floors, shadows, animate, detailed }: BuildingMeshProps) {
  const height = towerHeight(floors.length)
  const windowsRef = useRef<THREE.InstancedMesh>(null)
  const shellRef = useRef<THREE.MeshStandardMaterial>(null)

  const slots = useMemo<WindowSlot[]>(() => {
    if (!detailed) return []
    const result: WindowSlot[] = []
    const halfW = SCENE.buildingWidth / 2
    const halfD = SCENE.buildingDepth / 2

    floors.forEach((floor) => {
      const floorCentre = (floor.index - 1) * SCENE.floorHeight + SCENE.floorHeight / 2

      for (let row = 0; row < WINDOW_ROWS; row += 1) {
        const y = floorCentre + (row - (WINDOW_ROWS - 1) / 2) * (WINDOW_H + 0.16)

        // Front + back faces
        for (let col = 0; col < WINDOW_COLS; col += 1) {
          const x = (col - (WINDOW_COLS - 1) / 2) * (WINDOW_W + 0.28)
          result.push({ position: [x, y, halfD + 0.02], rotation: [0, 0, 0], floorIndex: floor.index })
          result.push({ position: [x, y, -halfD - 0.02], rotation: [0, Math.PI, 0], floorIndex: floor.index })
        }

        // Left + right faces
        const sideCols = 4
        for (let col = 0; col < sideCols; col += 1) {
          const z = (col - (sideCols - 1) / 2) * (WINDOW_W + 0.3)
          result.push({ position: [halfW + 0.02, y, z], rotation: [0, Math.PI / 2, 0], floorIndex: floor.index })
          result.push({ position: [-halfW - 0.02, y, z], rotation: [0, -Math.PI / 2, 0], floorIndex: floor.index })
        }
      }
    })

    return result
  }, [floors, detailed])

  /** Windows that belong to an anomalous floor — recoloured each frame. */
  const alertSlotIndices = useMemo(
    () =>
      slots
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot }) => floors.find((f) => f.index === slot.floorIndex)?.isAnomalous)
        .map(({ index }) => index),
    [slots, floors],
  )

  const litColor = useMemo(() => new THREE.Color(COLORS.flux), [])
  const dimColor = useMemo(() => new THREE.Color(COLORS.glass), [])
  const alertColor = useMemo(() => new THREE.Color(COLORS.crit), [])
  const scratchColor = useMemo(() => new THREE.Color(), [])
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const quaternion = useMemo(() => new THREE.Quaternion(), [])
  const scale = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const position = useMemo(() => new THREE.Vector3(), [])
  const euler = useMemo(() => new THREE.Euler(), [])

  // Reused edge source so re-renders never allocate a BoxGeometry.
  const edgeSource = useMemo(
    () => new THREE.BoxGeometry(SCENE.buildingWidth, height, SCENE.buildingDepth),
    [height],
  )
  useEffect(() => () => edgeSource.dispose(), [edgeSource])

  useLayoutEffect(() => {
    const mesh = windowsRef.current
    if (!mesh || slots.length === 0) return

    slots.forEach((slot, index) => {
      euler.set(slot.rotation[0], slot.rotation[1], slot.rotation[2])
      quaternion.setFromEuler(euler)
      position.set(slot.position[0], slot.position[1], slot.position[2])
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true

    // Baseline colouring: deterministic "occupied" pattern.
    slots.forEach((_, index) => {
      const lit = ((index * 2654435761) % 100) / 100
      mesh.setColorAt(index, lit > 0.38 ? litColor : dimColor)
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [slots, matrix, quaternion, scale, position, euler, litColor, dimColor])

  useFrame((state) => {
    const mesh = windowsRef.current
    if (!mesh || alertSlotIndices.length === 0) return

    const time = state.clock.elapsedTime
    const pulse = animate ? 0.5 + 0.5 * Math.sin(time * 3.2) : 0.5
    scratchColor.copy(dimColor).lerp(alertColor, 0.35 + pulse * 0.65)

    for (const index of alertSlotIndices) {
      mesh.setColorAt(index, scratchColor)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    if (shellRef.current) {
      shellRef.current.emissiveIntensity = 0.05 + pulse * 0.06
    }
  })

  return (
    <group>
      {/* Structural core — always-on base load */}
      <mesh position={[0, height / 2, 0]} castShadow={shadows}>
        <boxGeometry args={[SCENE.buildingWidth - 1.1, height - 0.1, SCENE.buildingDepth - 1.1]} />
        <meshStandardMaterial
          color={COLORS.shell}
          roughness={0.85}
          metalness={0.1}
          emissive={COLORS.fluxDim}
          emissiveIntensity={0.06}
        />
      </mesh>

      {/* Glazing shell */}
      <mesh position={[0, height / 2, 0]} renderOrder={1}>
        <boxGeometry args={[SCENE.buildingWidth, height, SCENE.buildingDepth]} />
        <meshStandardMaterial
          ref={shellRef}
          color={COLORS.glass}
          roughness={0.18}
          metalness={0.55}
          transparent
          opacity={0.24}
          side={THREE.DoubleSide}
          emissive={COLORS.fluxDim}
          emissiveIntensity={0.06}
        />
      </mesh>

      {/* Crisp structural edges — the "premium enterprise" read */}
      <lineSegments position={[0, height / 2, 0]}>
        <edgesGeometry args={[edgeSource]} />
        <lineBasicMaterial color={COLORS.flux} transparent opacity={0.28} toneMapped={false} />
      </lineSegments>

      {/* Window grid */}
      {detailed ? (
        <instancedMesh
          ref={windowsRef}
          args={[undefined, undefined, slots.length]}
          frustumCulled={false}
        >
          <planeGeometry args={[WINDOW_W, WINDOW_H]} />
          <meshBasicMaterial
            toneMapped={false}
            transparent
            opacity={0.92}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </instancedMesh>
      ) : null}

      {/* Roof cap */}
      <mesh position={[0, height + 0.06, 0]} castShadow={shadows}>
        <boxGeometry args={[SCENE.buildingWidth + 0.4, 0.12, SCENE.buildingDepth + 0.4]} />
        <meshStandardMaterial color={COLORS.slab} roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  )
}
