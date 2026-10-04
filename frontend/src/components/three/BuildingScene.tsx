import { useMemo } from 'react'
import { Grid } from '@react-three/drei'
import type { Anomaly, Building } from '@/types'
import type { FloorState } from '@/utils/floorState'
import { deriveBuildingPulse } from '@/utils/floorState'
import type { SceneQuality } from '@/hooks/useDeviceProfile'
import { BuildingMesh } from './BuildingMesh'
import { CameraRig } from './CameraRig'
import { EnergyFlow } from './EnergyFlow'
import { EnergyMeter } from './EnergyMeter'
import { EnergyParticles } from './EnergyParticles'
import { FloorNode } from './FloorNode'
import { COLORS, buildFlowPaths } from './sceneLayout'

interface BuildingSceneProps {
  building: Building | null
  floors: FloorState[]
  anomalies: Anomaly[]
  quality: SceneQuality
  shadows: boolean
  animate: boolean
  particleBudget: number
  hoveredFloor: number | null
  selectedFloor: number | null
  onFloorHover: (index: number | null) => void
  onFloorSelect: (index: number) => void
  resetSignal: number
  zoomSignal: number
  zoomDirection: 1 | -1
}

/**
 * Scene graph for the smart building. Rendered inside `<Canvas>` by
 * `Building3D` — never mounted directly by a page.
 */
export function BuildingScene({
  building,
  floors,
  anomalies,
  quality,
  shadows,
  animate,
  particleBudget,
  hoveredFloor,
  selectedFloor,
  onFloorHover,
  onFloorSelect,
  resetSignal,
  zoomSignal,
  zoomDirection,
}: BuildingSceneProps) {
  const floorCount = building?.floors ?? Math.max(3, floors.length)
  const paths = useMemo(() => buildFlowPaths(floors), [floors])

  const pulse = useMemo(() => deriveBuildingPulse(anomalies), [anomalies])

  /** Meter utilisation derived from floor intensities — presentation only. */
  const load = useMemo(() => {
    if (floors.length === 0) return 0.4
    const total = floors.reduce((acc, f) => acc + f.intensity, 0)
    return Math.min(1, total / floors.length / 0.75)
  }, [floors])

  const tint =
    pulse.severity === 'critical' || pulse.severity === 'high'
      ? COLORS.crit
      : pulse.severity === 'medium'
        ? COLORS.alert
        : null

  return (
    <>
      {/* ── Lighting: cool key, warm rim, soft ambient ── */}
      <ambientLight intensity={0.45} color="#8fa9c9" />
      <hemisphereLight args={['#4a6a92', '#05080f', 0.5]} />
      <directionalLight
        position={[8, 14, 9]}
        intensity={1.05}
        color="#dbeafe"
        castShadow={shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={48}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={18}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0008}
      />
      <pointLight position={[0, 2.4, 6.5]} intensity={11} distance={16} decay={2} color={COLORS.flux} />
      <pointLight position={[-7, 6, -6]} intensity={8} distance={22} decay={2} color={COLORS.iris} />
      <pointLight
        position={[0, 1.6, 3.4]}
        intensity={pulse.level > 0 ? 5 * pulse.level : 0}
        distance={12}
        decay={2}
        color={tint ?? COLORS.alert}
      />

      {/* ── Ground ── */}
      <Grid
        args={[46, 46]}
        position={[0, -0.02, 0]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#16243a"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#1f3550"
        fadeDistance={38}
        fadeStrength={1.4}
        followCamera={false}
        infiniteGrid
      />

      <BuildingMesh floors={floors} shadows={shadows} animate={animate} detailed={quality !== 'low'} />

      {floors.map((floor) => (
        <FloorNode
          key={floor.floorId}
          floor={floor}
          hovered={hoveredFloor === floor.index}
          selected={selectedFloor === floor.index}
          shadows={shadows}
          animate={animate}
          onHover={onFloorHover}
          onSelect={onFloorSelect}
        />
      ))}

      <EnergyMeter load={load} animate={animate} tint={tint} />

      <EnergyFlow paths={paths} speed={animate ? 1 : 0} opacity={quality === 'low' ? 0.4 : 0.55} />

      <EnergyParticles
        paths={paths}
        budget={particleBudget}
        speed={animate ? 1 : 0}
        animate={animate}
        opacity={quality === 'low' ? 0.7 : 0.9}
      />

      <CameraRig
        floors={floorCount}
        resetSignal={resetSignal}
        focusFloor={hoveredFloor ?? selectedFloor}
        zoomSignal={zoomSignal}
        zoomDirection={zoomDirection}
        enableRotate={quality !== 'low'}
        enablePan
      />
    </>
  )
}
