import type {
  Anomaly,
  AnomalyStatus,
  Building,
  CostBucket,
  CostImpact,
  EnergyPoint,
  EnergySeries,
  EvidenceItem,
  Investigation,
  PossibleFactor,
  RecommendedCheck,
  Severity,
  TimelineEvent,
  TopCostPeriod,
} from '@/types'
import { severityFromScore } from '@/utils/format'
import { DAY, HOUR, MINUTE, toDateInputValue } from '@/utils/date'

/* ─────────────────────────────────────────────────────────────
   Deterministic synthetic data for the mock transport.

   IMPORTANT: this module is the *only* place WattWise fabricates numbers,
   and it is reachable exclusively through `services/mock/transport.ts`,
   which is selected by `VITE_API_MODE`. No UI component imports it.

   Everything here is a pure function of (buildingId, time window) so the
   dashboard, chart, 3D scene and cost pages always agree with each other.
   ───────────────────────────────────────────────────────────── */

/* ── Seeded PRNG (mulberry32) ───────────────────────────────── */

function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ── Catalogue ──────────────────────────────────────────────── */

export const MOCK_BUILDINGS: Building[] = [
  {
    id: 'bld_aurora',
    name: 'Aurora Business Park',
    location: 'Bengaluru, Karnataka',
    floors: 5,
    areaSqFt: 168_400,
    tariffRatePerKwh: 8.4,
    currency: 'INR',
    meta: { buildingType: 'Corporate office', timezone: 'Asia/Kolkata' },
  },
  {
    id: 'bld_helix',
    name: 'Helix Tech Campus',
    location: 'Hyderabad, Telangana',
    floors: 4,
    areaSqFt: 124_900,
    tariffRatePerKwh: 7.9,
    currency: 'INR',
    meta: { buildingType: 'Technology campus', timezone: 'Asia/Kolkata' },
  },
  {
    id: 'bld_meridian',
    name: 'Meridian Hospital Annex',
    location: 'Pune, Maharashtra',
    floors: 3,
    areaSqFt: 88_600,
    tariffRatePerKwh: 9.2,
    currency: 'INR',
    meta: { buildingType: 'Healthcare', timezone: 'Asia/Kolkata' },
  },
]

export function findBuilding(id: string | null | undefined): Building {
  return MOCK_BUILDINGS.find((b) => b.id === id) ?? MOCK_BUILDINGS[0]
}

/* ── Load shape ─────────────────────────────────────────────── */

/** Human-occupancy driven load curve, 0–1. Office-style: low at night. */
function occupancyProfile(hour: number, dayOfWeek: number): number {
  const weekend = dayOfWeek === 0 || dayOfWeek === 6
  const base = weekend
    ? 0.22 + 0.1 * Math.sin(((hour - 6) / 24) * Math.PI * 2)
    : 0.16 +
      0.62 * Math.exp(-((hour - 13) ** 2) / 34) +
      0.2 * Math.exp(-((hour - 10) ** 2) / 12) +
      0.16 * Math.exp(-((hour - 19) ** 2) / 16)
  return Math.min(1, Math.max(0.06, base))
}

/** Continuous baseload (always-on systems: lifts, servers, safety, cooling). */
function baseLoadFactor(hour: number): number {
  return 0.34 + 0.08 * Math.sin(((hour - 2) / 24) * Math.PI * 2)
}

function intervalForRange(fromIso: string, toIso: string): number {
  const span = Date.parse(toIso) - Date.parse(fromIso)
  if (span <= 0) return 15
  if (span <= 48 * HOUR) return 15
  if (span <= 8 * DAY) return 60
  if (span <= 40 * DAY) return 240
  return 1440
}

/** Instantaneous building demand in kW for a given instant. */
function demandKw(building: Building, date: Date, rng: () => number): number {
  const hour = date.getHours() + date.getMinutes() / 60
  const occupancy = occupancyProfile(hour, date.getDay())
  const floorsFactor = building.floors * building.areaSqFt
  const peakDemand = 22 + floorsFactor / 12_500 // ~kW at full occupancy
  const demand =
    peakDemand * (baseLoadFactor(hour) * 0.55 + occupancy * 0.72) +
    6 * Math.sin(rng() * Math.PI * 2)
  return Math.max(4, demand * (0.97 + rng() * 0.06))
}

/* ── Anomaly window planning ────────────────────────────────── */

interface PlannedWindow {
  start: number
  end: number
  /** Multiplier applied to actual consumption across the window. */
  multiplier: number
  floorIndex: number
}

/**
 * Deterministic anomaly placement. Evening and overnight windows are favoured
 * because extended-hours operation is the most common real-world cause.
 */
function planWindows(building: Building, from: number, to: number): PlannedWindow[] {
  const windows: PlannedWindow[] = []
  const dayMs = DAY
  let dayCursor = Math.floor(from / dayMs) * dayMs

  while (dayCursor < to) {
    const dayStart = new Date(dayCursor)
    const isWeekend = dayStart.getDay() === 0 || dayStart.getDay() === 6
    const count = isWeekend ? 1 : 2

    for (let i = 0; i < count; i += 1) {
      const rng = makeRng(hashString(`${building.id}:${dayCursor}:${i}`))
      // Bias toward 18:00–01:00.
      const startHour = 18 + Math.floor(rng() * 7)
      const startMinute = Math.floor(rng() * 4) * 15
      const durationHours = 1 + Math.floor(rng() * 3)
      const start = dayCursor + startHour * HOUR + startMinute * MINUTE
      const end = start + durationHours * HOUR

      if (start < from || start > to) continue
      const roll = rng()
      const multiplier = roll > 0.9 ? 1.9 + rng() * 0.6 : roll > 0.6 ? 1.45 + rng() * 0.4 : 1.22 + rng() * 0.22

      windows.push({
        start,
        end: Math.min(end, to),
        multiplier,
        floorIndex: 1 + Math.floor(rng() * building.floors),
      })
    }
    dayCursor += dayMs
  }

  return windows.sort((a, b) => a.start - b.start)
}

/* ── Stable anomaly serials ("ANOMALY #024") ────────────────── */

const serialCache = new Map<string, number>()

function serialFor(buildingId: string, startIso: string): string {
  const key = `${buildingId}:${startIso}`
  const existing = serialCache.get(key)
  if (existing !== undefined) return `ANOMALY #${String(existing).padStart(3, '0')}`
  const rng = makeRng(hashString(key))
  const serial = 20 + Math.floor(rng() * 480)
  serialCache.set(key, serial)
  return `ANOMALY #${String(serial).padStart(3, '0')}`
}

/* ── Series + anomalies ─────────────────────────────────────── */

export interface GeneratedSeries {
  series: EnergySeries
  anomalies: Anomaly[]
}

export function generateSeries(buildingId: string, fromIso: string, toIso: string): GeneratedSeries {
  const building = findBuilding(buildingId)
  const from = Date.parse(fromIso)
  const to = Date.parse(toIso)
  const intervalMinutes = intervalForRange(fromIso, toIso)
  const stepMs = intervalMinutes * MINUTE
  const rng = makeRng(hashString(`${buildingId}:${fromIso}:${toIso}`))

  const windows = planWindows(building, from, to)
  const windowAt = (ts: number): PlannedWindow | null =>
    windows.find((w) => ts >= w.start && ts < w.end) ?? null

  const points: EnergyPoint[] = []
  const intervalHours = intervalMinutes / 60

  for (let ts = from; ts <= to; ts += stepMs) {
    const date = new Date(ts)
    const hour = date.getHours() + date.getMinutes() / 60
    const dayOfWeek = date.getDay()

    const expectedRaw = demandKw(building, date, rng) * intervalHours
    const noise = 0.985 + rng() * 0.03
    const window = windowAt(ts)
    const spike = window ? window.multiplier : 1
    const actual = Math.max(0, expectedRaw * noise * spike)

    // Optional channels appear only for some timestamps, mirroring sparse IoT feeds.
    const hasTemp = rng() > 0.25
    const hasOccupancy = rng() > 0.4

    points.push({
      timestamp: new Date(ts).toISOString(),
      actualKwh: round(actual, 2),
      expectedKwh: round(expectedRaw, 2),
      intervalMinutes,
      anomalyId: null,
      temperature: hasTemp ? round(22 + occupancyProfile(hour, dayOfWeek) * 6 + (rng() - 0.5) * 1.6, 1) : null,
      occupancy: hasOccupancy ? Math.round(occupancyProfile(hour, dayOfWeek) * 100) : null,
    })
  }

  /* Aggregate windows into anomalies and tag the points. */
  const anomalies: Anomaly[] = []

  windows.forEach((window) => {
    const slice = points.filter(
      (p) => Date.parse(p.timestamp) >= window.start && Date.parse(p.timestamp) < window.end,
    )
    if (slice.length === 0) return

    const expectedKwh = round(sum(slice, 'expectedKwh'), 2)
    const actualKwh = round(sum(slice, 'actualKwh'), 2)
    const excessKwh = round(Math.max(0, actualKwh - expectedKwh), 2)
    if (excessKwh <= 0.5) return

    const ratio = excessKwh / Math.max(1, expectedKwh)
    const hours = slice.length * intervalHours
    // Heuristic score in [0.55, 0.98] — magnitude weighted by duration.
    const score = clamp(0.55 + ratio * 0.32 + Math.min(hours, 6) * 0.02, 0.55, 0.98)
    const severity: Severity = severityFromScore(score)
    const startIso = slice[0].timestamp
    const endIso = slice[slice.length - 1].timestamp
    const id = `anom_${hashString(`${building.id}:${startIso}`).toString(36)}`

    const status: AnomalyStatus =
      hashString(`${id}:status`) % 7 === 0 ? 'investigating' : hashString(`${id}:status2`) % 23 === 0 ? 'resolved' : 'new'

    const anomaly: Anomaly = {
      id,
      reference: serialFor(building.id, startIso),
      buildingId: building.id,
      start: startIso,
      end: endIso,
      expectedKwh,
      actualKwh,
      excessKwh,
      estimatedCost: round(excessKwh * building.tariffRatePerKwh, 2),
      score: round(score, 2),
      severity,
      floorId: `f${window.floorIndex}`,
      floorLabel: `Floor ${window.floorIndex}`,
      status,
      detectedAt: new Date(Date.parse(endIso) + 12 * MINUTE).toISOString(),
    }

    slice.forEach((p) => {
      p.anomalyId = id
    })
    anomalies.push(anomaly)
  })

  return {
    series: {
      buildingId: building.id,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      intervalMinutes,
      currency: building.currency,
      tariffRatePerKwh: building.tariffRatePerKwh,
      points,
    },
    anomalies,
  }
}

/** Widened window used by the anomalies explorer so filters have room to work. */
export function generateAnomalyWindow(buildingId: string, fromIso: string, toIso: string): Anomaly[] {
  const { anomalies } = generateSeries(buildingId, fromIso, toIso)
  return anomalies.sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
}

export function generateEnergyOnly(buildingId: string, fromIso: string, toIso: string): EnergySeries {
  return generateSeries(buildingId, fromIso, toIso).series
}

export function generateSummary(buildingId: string, fromIso: string, toIso: string) {
  const building = findBuilding(buildingId)
  const { series, anomalies } = generateSeries(buildingId, fromIso, toIso)
  const currentUsageKwh = round(sum(series.points, 'actualKwh'), 2)
  const expectedUsageKwh = round(sum(series.points, 'expectedKwh'), 2)
  const excessKwh = round(Math.max(0, currentUsageKwh - expectedUsageKwh), 2)
  const active = anomalies.filter((a) => a.status === 'new' || a.status === 'investigating')
  const trailing = trailingDelta(series)

  const lastPoint = series.points[series.points.length - 1]
  const lagMinutes = lastPoint ? Math.round((Date.now() - Date.parse(lastPoint.timestamp)) / MINUTE) : 9999

  return {
    buildingId: building.id,
    generatedAt: new Date().toISOString(),
    currency: building.currency,
    tariffRatePerKwh: building.tariffRatePerKwh,
    currentUsageKwh,
    expectedUsageKwh,
    excessKwh,
    estimatedExcessCost: round(excessKwh * building.tariffRatePerKwh, 2),
    activeAnomalyCount: active.length,
    deltaPercent: trailing,
    dataStatus: {
      state: lagMinutes <= series.intervalMinutes * 3 ? ('ok' as const) : lagMinutes <= 60 ? ('delayed' as const) : ('stale' as const),
      lastReadingAt: lastPoint?.timestamp ?? null,
      coveragePercent: 99.2,
      intervalMinutes: series.intervalMinutes,
      message:
        lagMinutes <= series.intervalMinutes * 3
          ? 'Meter feed is current.'
          : 'Meter feed is behind the expected interval — ingestion may be delayed.',
    },
    modelStatus: {
      state: 'ready' as const,
      version: 'wb-anomaly-2.4.1',
      trainedAt: new Date(Date.now() - 6 * DAY).toISOString(),
      accuracy: 0.93,
      baselineMethod: 'Seasonal hourly profile + robust residual thresholding',
      message: 'Baseline model is trained and serving predictions.',
    },
  }
}

export type SummaryShape = ReturnType<typeof generateSummary>

/* ── Cost impact ────────────────────────────────────────────── */

export function generateCostImpact(buildingId: string, fromIso: string, toIso: string): CostImpact {
  const building = findBuilding(buildingId)
  const tariff = building.tariffRatePerKwh
  const now = Date.now()

  // Daily — last 14 days, independent of the selected range so the page has depth.
  const dailyStart = now - 14 * DAY
  const { anomalies } = generateSeries(building.id, new Date(dailyStart).toISOString(), new Date(now).toISOString())

  const byDay = new Map<string, { excessKwh: number; estimatedCost: number }>()
  for (const anomaly of anomalies) {
    const key = toDateInputValue(anomaly.start)
    const bucket = byDay.get(key) ?? { excessKwh: 0, estimatedCost: 0 }
    bucket.excessKwh += anomaly.excessKwh
    bucket.estimatedCost += anomaly.estimatedCost
    byDay.set(key, bucket)
  }

  const daily: CostBucket[] = []
  for (let i = 13; i >= 0; i -= 1) {
    const ts = now - i * DAY
    const bucket = byDay.get(toDateInputValue(new Date(ts).toISOString()))
    daily.push({
      label: new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      date: new Date(ts).toISOString(),
      excessKwh: round(bucket?.excessKwh ?? 0, 2),
      estimatedCost: round(bucket?.estimatedCost ?? 0, 2),
    })
  }

  // Weekly — group the daily buckets into ISO weeks.
  const weekly: CostBucket[] = []
  for (let w = 7; w >= 0; w -= 1) {
    const weekEnd = now - w * 7 * DAY
    const weekStart = weekEnd - 7 * DAY
    const slice = daily.filter((d) => {
      const ts = Date.parse(d.date)
      return ts >= weekStart && ts <= weekEnd
    })
    weekly.push({
      label: `W${w === 0 ? 'current' : `${8 - w}`}`,
      date: new Date(weekEnd).toISOString(),
      excessKwh: round(sumBuckets(slice, 'excessKwh'), 2),
      estimatedCost: round(sumBuckets(slice, 'estimatedCost'), 2),
    })
  }

  // Monthly projection — recent daily average extrapolated over 30 days.
  const recentDailyAvgCost = daily.slice(-7).reduce((a, d) => a + d.estimatedCost, 0) / 7
  const recentDailyAvgKwh = daily.slice(-7).reduce((a, d) => a + d.excessKwh, 0) / 7
  const monthlyProjection: CostBucket[] = []
  for (let d = 1; d <= 30; d += 1) {
    const ts = now + d * DAY
    // Gentle weekday/weekend shape so the projection is not a flat line.
    const day = new Date(ts).getDay()
    const shape = day === 0 || day === 6 ? 0.7 : 1.05
    monthlyProjection.push({
      label: new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      date: new Date(ts).toISOString(),
      excessKwh: round(recentDailyAvgKwh * shape, 2),
      estimatedCost: round(recentDailyAvgCost * shape, 2),
    })
  }

  const topPeriods: TopCostPeriod[] = [...anomalies]
    .sort((a, b) => b.estimatedCost - a.estimatedCost)
    .slice(0, 8)
    .map((a) => ({
      anomalyId: a.id,
      reference: a.reference,
      start: a.start,
      end: a.end,
      excessKwh: a.excessKwh,
      estimatedCost: a.estimatedCost,
      severity: a.severity,
    }))

  return {
    buildingId: building.id,
    currency: building.currency,
    tariffRatePerKwh: tariff,
    daily,
    weekly,
    monthlyProjection,
    totals: {
      dailyExcessKwh: round(sumBuckets(daily.slice(-1), 'excessKwh'), 2),
      dailyExcessCost: round(sumBuckets(daily.slice(-1), 'estimatedCost'), 2),
      weeklyExcessKwh: round(sumBuckets(weekly.slice(-1), 'excessKwh'), 2),
      weeklyExcessCost: round(sumBuckets(weekly.slice(-1), 'estimatedCost'), 2),
      monthlyProjectedExcessKwh: round(sumBuckets(monthlyProjection, 'excessKwh'), 2),
      monthlyProjectedExcessCost: round(sumBuckets(monthlyProjection, 'estimatedCost'), 2),
    },
    topPeriods,
    disclaimer:
      'Estimated excess cost only. Figures are derived from reported meter readings and the configured tariff; actual charges may differ.',
  }
}

/* ── Investigation ──────────────────────────────────────────── */

const FACTOR_CATALOGUE: Array<{
  category: PossibleFactor['category']
  label: string
  rationale: string
  check: string
  hours: number[]
}> = [
  {
    category: 'hvac',
    label: 'HVAC schedule',
    rationale: 'Cooling or heating load appears elevated outside the scheduled setpoints.',
    check: 'Compare BMS chiller/ahu run schedules and setpoints against the deviation window.',
    hours: [10, 11, 12, 13, 14, 15, 16, 17],
  },
  {
    category: 'lighting',
    label: 'Lighting schedule',
    rationale: 'Lighting circuits may not be switching off on the expected evening schedule.',
    check: 'Review lighting timers, motion-sensor overrides and the after-hours scene config.',
    hours: [18, 19, 20, 21, 22, 23],
  },
  {
    category: 'operation',
    label: 'Extended building operation',
    rationale: 'Consumption continues past normal occupancy hours, suggesting the building stayed open.',
    check: 'Correlate access-control and lift telemetry with the deviation window.',
    hours: [19, 20, 21, 22, 23, 0, 1],
  },
  {
    category: 'equipment',
    label: 'Equipment operating hours',
    rationale: 'A specific load group may be running beyond its logged duty cycle.',
    check: 'Inspect submeter breakdowns for UPS, DG, kitchen or lab equipment duty cycles.',
    hours: [0, 1, 2, 3, 4, 5, 21, 22, 23],
  },
  {
    category: 'occupancy',
    label: 'Unexpected occupancy',
    rationale: 'Headcount or floor density may be higher than the baseline assumes for this slot.',
    check: 'Compare badge swipes and desk-booking data with the expected occupancy profile.',
    hours: [9, 10, 11, 12, 13, 14, 15, 16],
  },
  {
    category: 'data',
    label: 'Meter / data issue',
    rationale: 'Step changes without matching sub-meter movement can indicate CT or telemetry faults.',
    check: 'Validate current transformer ratios, phase balance and meter replacement history.',
    hours: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  },
]

export function generateInvestigation(anomaly: Anomaly, buildingId: string): Investigation {
  const building = findBuilding(buildingId ?? anomaly.buildingId)
  const { series } = generateSeries(building.id, anomaly.start, new Date(Date.parse(anomaly.end) + 30 * MINUTE).toISOString())

  const slice = series.points.filter((p) => Date.parse(p.timestamp) >= Date.parse(anomaly.start))
  const peak = slice.reduce<EnergyPoint | null>(
    (best, p) => (best === null || p.actualKwh - p.expectedKwh > best.actualKwh - best.expectedKwh ? p : best),
    null,
  )

  const excessRatio = anomaly.excessKwh / Math.max(1, anomaly.expectedKwh)
  const durationHours = Math.max(
    0.25,
    (Date.parse(anomaly.end) - Date.parse(anomaly.start)) / HOUR,
  )
  const startHour = new Date(anomaly.start).getHours()

  const candidates = FACTOR_CATALOGUE.filter((f) => f.hours.includes(startHour))
  const picks = [...(candidates.length ? candidates : FACTOR_CATALOGUE.slice(0, 2))]
  // Always offer the data-quality check: it is the cheapest thing to rule out.
  const dataFactor = FACTOR_CATALOGUE.find((f) => f.category === 'data')!
  if (!picks.some((f) => f.category === 'data')) picks.push(dataFactor)

  const possibleFactors: PossibleFactor[] = picks.slice(0, 4).map((factor, i) => ({
    id: `factor_${i + 1}`,
    label: factor.label,
    category: factor.category,
    rationale: factor.rationale,
    status: 'unverified',
  }))

  const recommendedChecks: RecommendedCheck[] = possibleFactors.map((factor, i) => {
    const source = FACTOR_CATALOGUE.find((f) => f.label === factor.label)
    return {
      id: `check_${i + 1}`,
      label: source?.check ?? 'Verify with facilities team.',
      owner: null,
      priority: i === 0 ? 'high' : i === 1 ? 'medium' : 'low',
    }
  })

  const evidence: EvidenceItem[] = [
    {
      id: 'ev_ratio',
      label: 'Deviation vs baseline',
      value: `${(excessRatio * 100).toFixed(1)}% above expected`,
      detail: `Expected ${anomaly.expectedKwh.toFixed(1)} kWh vs actual ${anomaly.actualKwh.toFixed(1)} kWh over the same window.`,
      kind: 'baseline',
    },
    {
      id: 'ev_duration',
      label: 'Duration above baseline',
      value: `${durationHours.toFixed(1)} h`,
      detail: 'Total time in the window where actual consumption exceeded the learned baseline.',
      kind: 'metric',
    },
    {
      id: 'ev_peak',
      label: 'Peak deviation interval',
      value: peak
        ? `${new Date(peak.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} · ${(peak.actualKwh - peak.expectedKwh).toFixed(1)} kWh excess`
        : '—',
      detail: peak
        ? `Single ${series.intervalMinutes}-minute interval with the largest gap to baseline.`
        : 'Peak interval unavailable for this window.',
      kind: 'metric',
    },
    {
      id: 'ev_floor',
      label: 'Localisation',
      value: anomaly.floorLabel ?? 'Not localised',
      detail: anomaly.floorLabel
        ? 'The deviation was concentrated on this floor according to floor-level submetering.'
        : 'Floor-level submetering did not isolate this deviation to a single floor.',
      kind: 'correlation',
    },
    {
      id: 'ev_score',
      label: 'Anomaly score',
      value: anomaly.score.toFixed(2),
      detail: 'Model confidence that the deviation is not explainable by the learned baseline.',
      kind: 'metric',
    },
    {
      id: 'ev_context',
      label: 'Comparison window',
      value: `${durationHours.toFixed(1)} h window`,
      detail: 'Compared against the same weekday and time slot across the trailing baseline period.',
      kind: 'context',
    },
  ]

  const timeline = buildTimeline(anomaly, peak, series.intervalMinutes)

  const startLabel = new Date(anomaly.start).toLocaleString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  const endLabel = new Date(anomaly.end).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return {
    anomalyId: anomaly.id,
    reference: anomaly.reference,
    buildingId: building.id,
    generatedAt: new Date().toISOString(),
    summary: `Consumption exceeded the learned baseline by ${(excessRatio * 100).toFixed(0)}% between ${startLabel} and ${endLabel}.`,
    observation: `Across this ${durationHours.toFixed(1)}-hour window the building reported ${anomaly.actualKwh.toFixed(1)} kWh against an expected ${anomaly.expectedKwh.toFixed(1)} kWh — an excess of ${anomaly.excessKwh.toFixed(1)} kWh. The deviation persists across consecutive intervals rather than appearing as a single reading spike.`,
    expectedKwh: anomaly.expectedKwh,
    actualKwh: anomaly.actualKwh,
    excessKwh: anomaly.excessKwh,
    estimatedCost: anomaly.estimatedCost,
    score: anomaly.score,
    severity: anomaly.severity,
    start: anomaly.start,
    end: anomaly.end,
    currency: building.currency,
    tariffRatePerKwh: building.tariffRatePerKwh,
    evidence,
    possibleFactors,
    recommendedChecks,
    timeline,
    confidenceNote:
      'The deviation is confirmed against the learned baseline, but WattWise does not assert a root cause. Correlate the checks below with facilities and sub-meter data before acting.',
    modelVersion: 'wb-anomaly-2.4.1',
  }
}

function buildTimeline(anomaly: Anomaly, peak: EnergyPoint | null, intervalMinutes: number): TimelineEvent[] {
  const before = new Date(Date.parse(anomaly.start) - 2 * HOUR)
  const events: TimelineEvent[] = [
    {
      id: 't_normal_1',
      timestamp: before.toISOString(),
      label: 'Normal',
      detail: 'Consumption tracking the learned baseline.',
      kind: 'normal',
      deviationPercent: round((rngFrom(anomaly.id, 1) - 0.5) * 8, 1),
    },
    {
      id: 't_start',
      timestamp: anomaly.start,
      label: 'Anomaly Started',
      detail: 'Actual consumption moved above the baseline threshold.',
      kind: 'anomaly_start',
      deviationPercent: round(12 + rngFrom(anomaly.id, 2) * 16, 1),
    },
  ]

  if (peak) {
    events.push({
      id: 't_peak',
      timestamp: peak.timestamp,
      label: 'Peak Deviation',
      detail: `Largest single-interval excess of ${(peak.actualKwh - peak.expectedKwh).toFixed(1)} kWh.`,
      kind: 'peak',
      deviationPercent: round(((peak.actualKwh - peak.expectedKwh) / Math.max(1, peak.expectedKwh)) * 100, 1),
    })
  }

  events.push({
    id: 't_normalised',
    timestamp: anomaly.end,
    label: 'Normalized',
    detail: `Consumption returned to baseline for ${intervalMinutes}-minute intervals.`,
    kind: 'normalised',
    deviationPercent: round((rngFrom(anomaly.id, 3) - 0.5) * 6, 1),
  })

  return events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
}

/* ── Helpers ────────────────────────────────────────────────── */

function trailingDelta(series: EnergySeries) {
  const points = series.points
  const half = Math.floor(points.length / 2)
  if (half === 0) {
    return { currentUsage: null, expectedUsage: null, excessEnergy: null, excessCost: null }
  }
  const previous = points.slice(0, half)
  const current = points.slice(half)
  const pct = (now: number, before: number) =>
    before === 0 ? null : round(((now - before) / before) * 100, 1)

  const actualDelta = pct(sum(current, 'actualKwh'), sum(previous, 'actualKwh'))
  const expectedDelta = pct(sum(current, 'expectedKwh'), sum(previous, 'expectedKwh'))
  const excessNow = sum(current, 'actualKwh') - sum(current, 'expectedKwh')
  const excessBefore = sum(previous, 'actualKwh') - sum(previous, 'expectedKwh')

  return {
    currentUsage: actualDelta,
    expectedUsage: expectedDelta,
    excessEnergy: pct(excessNow, excessBefore),
    excessCost: pct(excessNow, excessBefore),
  }
}

function sum(points: EnergyPoint[], key: 'actualKwh' | 'expectedKwh'): number {
  let total = 0
  for (const p of points) total += p[key]
  return total
}

function sumBuckets(buckets: CostBucket[], key: 'excessKwh' | 'estimatedCost'): number {
  let total = 0
  for (const b of buckets) total += b[key]
  return total
}

function rngFrom(key: string, salt: number): number {
  return makeRng(hashString(`${key}:${salt}`))()
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export { sumBuckets }
