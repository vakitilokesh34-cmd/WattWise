import type { Anomaly, EnergyPoint, Severity } from '@/types'
import { formatHour, formatDate, isSameDay } from '@/utils/date'

export const CHART = {
  flux: '#22d3ee',
  fluxSoft: 'rgba(34,211,238,0.22)',
  watt: '#34d399',
  iris: '#a78bfa',
  alert: '#fbbf24',
  crit: '#fb7185',
  grid: 'rgba(148,163,196,0.09)',
  axis: '#4d5b7c',
  actual: '#67e8f9',
  expected: '#64748b',
  tooltipBg: 'rgba(7,11,20,0.94)',
} as const

export const SEVERITY_HEX: Record<Severity, string> = {
  low: CHART.flux,
  medium: CHART.alert,
  high: CHART.crit,
  critical: CHART.crit,
}

export function severityFill(severity: Severity, alpha = 0.1): string {
  const hex = SEVERITY_HEX[severity]
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export const AXIS_STYLE = {
  stroke: CHART.axis,
  tick: { fill: CHART.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

/** Time labels adapt to the visible span so axes never overlap. */
export function labelFormatterFor(spanMs: number): (iso: string) => string {
  if (spanMs <= 36 * 3600_000) return formatHour
  if (spanMs <= 5 * 86400_000) return (iso: string) => {
    const d = new Date(iso)
    const today = new Date()
    if (isSameDay(iso, today.toISOString())) return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${formatHour(iso)}`
    return formatDate(iso)
  }
  return formatDate
}

export interface ChartDatum extends EnergyPoint {
  /** Epoch milliseconds — the numeric X axis key. */
  ts: number
  /** Human-readable X label (tooltip + accessibility). */
  label: string
  /** Actual − expected, floored at zero for area rendering. */
  excessKwh: number
  /** Signed deviation percentage for the tooltip. */
  deviationPercent: number | null
}

export function toChartData(points: EnergyPoint[], maxPoints = 480): ChartDatum[] {
  const spanMs = points.length > 1 ? Date.parse(points[points.length - 1].timestamp) - Date.parse(points[0].timestamp) : 0
  const label = labelFormatterFor(spanMs)

  const reduced = strideSample(points, maxPoints)

  return reduced.map((point) => {
    const excess = Math.max(0, point.actualKwh - point.expectedKwh)
    const deviationPercent = point.expectedKwh > 0 ? ((point.actualKwh - point.expectedKwh) / point.expectedKwh) * 100 : null
    return {
      ...point,
      ts: Date.parse(point.timestamp),
      label: label(point.timestamp),
      excessKwh: Number(excess.toFixed(2)),
      deviationPercent: deviationPercent === null ? null : Number(deviationPercent.toFixed(1)),
    }
  })
}

/**
 * Tick formatter for the numeric time axis, chosen from the visible span so
 * ticks never collide on a 24-hour or 30-day window.
 */
export function timeTickFormatterFor(data: ChartDatum[]): (ts: number) => string {
  const spanMs = data.length > 1 ? data[data.length - 1].ts - data[0].ts : 0
  const label = labelFormatterFor(spanMs)
  return (ts: number) => label(new Date(ts).toISOString())
}

/**
 * Even-stride sampling that always preserves anomaly buckets, so a down-sampled
 * chart still shows every flagged period.
 */
function strideSample(points: EnergyPoint[], maxPoints: number): EnergyPoint[] {
  if (points.length <= maxPoints) return points

  const stride = Math.ceil(points.length / maxPoints)
  const picked = new Set<number>()
  for (let i = 0; i < points.length; i += stride) picked.add(i)
  picked.add(points.length - 1)
  points.forEach((point, index) => {
    if (point.anomalyId) picked.add(index)
  })

  return Array.from(picked)
    .sort((a, b) => a - b)
    .map((index) => points[index])
}

export interface AnomalyBand {
  id: string
  /** Epoch ms bounds so the band lands exactly on the numeric time axis. */
  fromMs: number
  toMs: number
  severity: Severity
  reference: string
  excessKwh: number
}

/** Converts anomalies into shaded bands aligned to the chart's time axis. */
export function toBands(anomalies: Anomaly[]): AnomalyBand[] {
  return anomalies
    .map((anomaly) => {
      const fromMs = Date.parse(anomaly.start)
      const toMs = Date.parse(anomaly.end)
      return {
        id: anomaly.id,
        fromMs: Number.isFinite(fromMs) ? fromMs : 0,
        toMs: Number.isFinite(toMs) ? toMs : fromMs,
        severity: anomaly.severity,
        reference: anomaly.reference,
        excessKwh: anomaly.excessKwh,
      }
    })
    .filter((band) => band.toMs > 0)
}

export function niceCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 10
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalised = value / magnitude
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10
  return step * magnitude
}
