import { useEffect, useRef, type ElementRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SCENE, towerHeight } from './sceneLayout'

type ControlsRef = ElementRef<typeof OrbitControls>

interface CameraRigProps {
  floors: number
  /** Increment to snap the camera back to the default view. */
  resetSignal: number
  /** When set, the camera eases to frame this floor. */
  focusFloor: number | null
  /** Increment to apply one zoom step in `zoomDirection`. */
  zoomSignal: number
  zoomDirection: 1 | -1
  enableRotate: boolean
  enablePan: boolean
}

function defaultPositionFor(floors: number): THREE.Vector3 {
  const height = towerHeight(floors)
  const distance = Math.max(11.5, height * 2.35)
  return new THREE.Vector3(distance * 0.6, distance * 0.46, distance * 0.84)
}

function defaultTargetFor(floors: number): THREE.Vector3 {
  return new THREE.Vector3(0, towerHeight(floors) * 0.45, 0)
}

/**
 * Orbit / zoom / pan controls plus imperative reset and smooth floor framing.
 * Polar angle is clamped so the tower is never viewed from below the ground.
 */
export function CameraRig({
  floors,
  resetSignal,
  focusFloor,
  zoomSignal,
  zoomDirection,
  enableRotate,
  enablePan,
}: CameraRigProps) {
  const controlsRef = useRef<ControlsRef>(null)
  const { camera } = useThree()

  const desiredTarget = useRef<THREE.Vector3>(defaultTargetFor(floors))
  const desiredPosition = useRef<THREE.Vector3>(defaultPositionFor(floors))
  const easing = useRef(0)

  // Re-frame whenever the building height changes.
  useEffect(() => {
    desiredTarget.current.copy(defaultTargetFor(floors))
    desiredPosition.current.copy(defaultPositionFor(floors))
  }, [floors])

  // Reset signal → snap.
  useEffect(() => {
    if (resetSignal === 0) return
    desiredTarget.current.copy(defaultTargetFor(floors))
    desiredPosition.current.copy(defaultPositionFor(floors))
    camera.position.copy(desiredPosition.current)
    const controls = controlsRef.current
    if (controls) {
      controls.target.copy(desiredTarget.current)
      controls.update()
    }
  }, [resetSignal, floors, camera])

  // Focus signal → ease towards the requested floor.
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    if (focusFloor === null) {
      desiredTarget.current.copy(defaultTargetFor(floors))
      desiredPosition.current.copy(defaultPositionFor(floors))
    } else {
      const y = (focusFloor - 0.5) * SCENE.floorHeight
      desiredTarget.current.set(0, y, 0)
      // Pull in slightly for a closer, more deliberate look at the floor.
      const distance = Math.max(8.5, towerHeight(floors) * 1.9)
      desiredPosition.current.set(distance * 0.52, y + distance * 0.3, distance * 0.78)
    }
    easing.current = 1
  }, [focusFloor, floors])

  // Zoom signal → dolly along the view vector.
  useEffect(() => {
    if (zoomSignal === 0) return
    const controls = controlsRef.current
    const target = controls?.target ?? desiredTarget.current
    const offset = camera.position.clone().sub(target)
    const next = Math.min(34, Math.max(6, offset.length() * (zoomDirection === -1 ? 0.82 : 1.22)))
    camera.position.copy(target.clone().add(offset.normalize().multiplyScalar(next)))
    controls?.update()
  }, [zoomSignal, zoomDirection, camera])

  useFrame((_, delta) => {
    if (easing.current <= 0) return
    const controls = controlsRef.current
    if (!controls) return

    const factor = Math.min(1, delta * 3.2)
    camera.position.lerp(desiredPosition.current, factor)
    controls.target.lerp(desiredTarget.current, factor)
    controls.update()

    if (camera.position.distanceTo(desiredPosition.current) < 0.05) {
      easing.current = 0
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.085}
      enableRotate={enableRotate}
      enablePan={enablePan}
      enableZoom
      minDistance={6}
      maxDistance={34}
      minPolarAngle={0.26}
      maxPolarAngle={Math.PI / 2.14}
      rotateSpeed={0.62}
      zoomSpeed={0.72}
      panSpeed={0.6}
    />
  )
}
