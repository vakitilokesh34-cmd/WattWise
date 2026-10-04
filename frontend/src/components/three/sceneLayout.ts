import * as THREE from 'three'
import type { FloorState } from '@/utils/floorState'
import { SEVERITY_STYLES } from '@/utils/format'

/**
 * Layout of the 3D tower. All scene units are arbitrary "metres" — kept small
 * so default camera near/far planes behave well on mobile.
 */
export const SCENE = {
  floorHeight: 1.15,
  slabThickness: 0.16,
  buildingWidth: 6.2,
  buildingDepth: 4.8,
  /** Position of the central energy meter, in front of the building. */
  meterPosition: new THREE.Vector3(0, 0, 4.6),
  /** Vertical riser that distributes energy up the building. */
  riserX: 2.5,
  riserZ: 2.9,
  baseY: 0,
} as const

export function floorBaseY(index: number): number {
  return SCENE.baseY + (index - 1) * SCENE.floorHeight
}

export function towerHeight(floors: number): number {
  return floors * SCENE.floorHeight
}

/* ── Palette ────────────────────────────────────────────────── */

export const COLORS = {
  flux: '#22d3ee',
  fluxDim: '#0e7490',
  watt: '#34d399',
  alert: '#fbbf24',
  crit: '#fb7185',
  iris: '#a78bfa',
  shell: '#0b1424',
  slab: '#111c30',
  glass: '#1b2b45',
  ground: '#060a12',
} as const

export function severityColor(severity: FloorState['severity']): string {
  if (!severity) return COLORS.flux
  switch (severity) {
    case 'critical':
    case 'high':
      return COLORS.crit
    case 'medium':
      return COLORS.alert
    default:
      return COLORS.flux
  }
}

/** Tailwind classes for the HTML overlay chips that match a severity colour. */
export function severityChipClass(severity: FloorState['severity']): string {
  if (!severity) return SEVERITY_STYLES.low.text
  return SEVERITY_STYLES[severity].text
}

/* ── Flow paths ─────────────────────────────────────────────── */

export interface FlowPath {
  id: string
  curve: THREE.CatmullRomCurve3
  floorIndex: number
  severity: FloorState['severity']
  /** Relative particle density multiplier. */
  weight: number
}

/**
 * Builds the energy-flow topology required by the brief:
 *
 *   METER → BUILDING BASE → RISER → FLOOR BRANCHES
 *
 * Returns pre-sampled curves so both the line renderer and the particle system
 * share the exact same geometry.
 */
export function buildFlowPaths(floors: FloorState[]): FlowPath[] {
  const paths: FlowPath[] = []

  const meterTop = new THREE.Vector3(
    SCENE.meterPosition.x,
    SCENE.meterPosition.y + 0.95,
    SCENE.meterPosition.z,
  )
  const baseEntry = new THREE.Vector3(SCENE.riserX, 0.22, SCENE.riserZ)
  const riserBottom = baseEntry.clone()

  // METER → building base
  paths.push({
    id: 'meter-base',
    curve: new THREE.CatmullRomCurve3(
      [
        meterTop,
        new THREE.Vector3(SCENE.meterPosition.x, 0.55, SCENE.meterPosition.z - 1.4),
        new THREE.Vector3(SCENE.riserX - 0.6, 0.16, SCENE.riserZ + 0.9),
        baseEntry,
      ],
      false,
      'catmullrom',
      0.4,
    ),
    floorIndex: 0,
    severity: null,
    weight: 1.35,
  })

  const topY = floorBaseY(Math.max(1, floors.length)) + SCENE.floorHeight * 0.6

  // RISER (vertical distribution spine)
  paths.push({
    id: 'riser',
    curve: new THREE.CatmullRomCurve3(
      [
        riserBottom,
        new THREE.Vector3(SCENE.riserX, topY * 0.5, SCENE.riserZ),
        new THREE.Vector3(SCENE.riserX, topY, SCENE.riserZ),
      ],
      false,
      'catmullrom',
      0.2,
    ),
    floorIndex: 0,
    severity: null,
    weight: 1.1,
  })

  // FLOOR BRANCHES
  for (const floor of floors) {
    const y = floorBaseY(floor.index) + SCENE.slabThickness * 0.5 + 0.06
    paths.push({
      id: `branch-${floor.index}`,
      curve: new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(SCENE.riserX, y, SCENE.riserZ),
          new THREE.Vector3(SCENE.riserX * 0.55, y + 0.05, SCENE.riserZ * 0.6),
          new THREE.Vector3(0, y + 0.02, SCENE.buildingDepth / 2 - 0.06),
        ],
        false,
        'catmullrom',
        0.3,
      ),
      floorIndex: floor.index,
      severity: floor.severity,
      weight: 0.55 + floor.intensity * 1.15,
    })
  }

  return paths
}

/** Converts a curve into a flat array for `<Line points={...} />`. */
export function sampleCurve(curve: THREE.CatmullRomCurve3, segments = 48): [number, number, number][] {
  return curve.getPoints(segments).map((point) => [point.x, point.y, point.z])
}
