import type { Anomaly, Building, Severity } from '@/types'
import { SEVERITY_ORDER } from '@/utils/format'

/**
 * Pure presentation logic that turns API anomalies into per-floor visual state.
 *
 * This is NOT detection logic — no thresholding, no scoring. It only reads the
 * `floorId` / `floorLabel` the backend attached to each anomaly and aggregates
 * it so the 3D scene and the floor legend can render consistently.
 */

export interface FloorState {
  /** 1-based floor number as rendered in the scene. */
  index: number
  floorId: string
  label: string
  anomalyCount: number
  excessKwh: number
  estimatedCost: number
  maxScore: number
  severity: Severity | null
  /** 0–1 animated load intensity. */
  intensity: number
  /** True when at least one anomaly is active on this floor right now. */
  isAnomalous: boolean
  /** Most recent anomaly start on this floor (for "since" copy). */
  latestStart: string | null
}

const QUIET_INTENSITY = 0.34

function floorIndexFrom(anomaly: Anomaly): number | null {
  const fromId = anomaly.floorId?.match(/(\d+)/)
  if (fromId) return Number(fromId[1])
  const fromLabel = anomaly.floorLabel?.match(/(\d+)/)
  if (fromLabel) return Number(fromLabel[1])
  return null
}

export function deriveFloorStates(building: Building | null, anomalies: Anomaly[]): FloorState[] {
  const floors = building?.floors ?? 4
  const states: FloorState[] = []

  for (let index = 1; index <= floors; index += 1) {
    states.push({
      index,
      floorId: `f${index}`,
      label: `Floor ${index}`,
      anomalyCount: 0,
      excessKwh: 0,
      estimatedCost: 0,
      maxScore: 0,
      severity: null,
      intensity: QUIET_INTENSITY,
      isAnomalous: false,
      latestStart: null,
    })
  }

  const localised = anomalies.filter((a) => a.status !== 'dismissed')
  const maxExcess = localised.reduce((max, a) => Math.max(max, a.excessKwh), 0)

  for (const anomaly of localised) {
    const index = floorIndexFrom(anomaly)
    if (index === null) continue
    const state = states.find((s) => s.index === index)
    if (!state) continue

    state.anomalyCount += 1
    state.excessKwh += anomaly.excessKwh
    state.estimatedCost += anomaly.estimatedCost
    state.maxScore = Math.max(state.maxScore, anomaly.score)
    if (!state.severity || SEVERITY_ORDER[anomaly.severity] > SEVERITY_ORDER[state.severity]) {
      state.severity = anomaly.severity
    }
    if (!state.latestStart || Date.parse(anomaly.start) > Date.parse(state.latestStart)) {
      state.latestStart = anomaly.start
    }
    state.isAnomalous = true
  }

  for (const state of states) {
    const share = maxExcess > 0 ? state.excessKwh / maxExcess : 0
    const severityBoost =
      state.severity === 'critical'
        ? 0.42
        : state.severity === 'high'
          ? 0.3
          : state.severity === 'medium'
            ? 0.2
            : 0.12
    state.intensity = Math.min(1, QUIET_INTENSITY + share * 0.4 + severityBoost * state.anomalyCount)
  }

  return states
}

/** Anomalies that could not be localised to a floor — surfaced as a notice. */
export function buildingLevelAnomalies(anomalies: Anomaly[]): Anomaly[] {
  return anomalies.filter((a) => floorIndexFrom(a) === null && a.status !== 'dismissed')
}

export interface BuildingPulse {
  /** Overall intensity of the building shell glow, 0–1. */
  level: number
  severity: Severity | null
  anomalyCount: number
}

export function deriveBuildingPulse(anomalies: Anomaly[]): BuildingPulse {
  const active = anomalies.filter((a) => a.status === 'new' || a.status === 'investigating')
  if (active.length === 0) return { level: 0, severity: null, anomalyCount: 0 }

  let severity: Severity | null = null
  let weight = 0
  for (const anomaly of active) {
    weight += anomaly.score
    if (!severity || SEVERITY_ORDER[anomaly.severity] > SEVERITY_ORDER[severity]) {
      severity = anomaly.severity
    }
  }
  const average = weight / active.length
  return {
    level: Math.min(1, 0.35 + average * 0.5 + Math.min(active.length, 4) * 0.04),
    severity,
    anomalyCount: active.length,
  }
}
