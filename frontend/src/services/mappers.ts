import type {
  Anomaly,
  AnomalyList,
  AnomalyQuery,
  AnomalyStatus,
  Building,
  CostBucket,
  CostImpact,
  DashboardSummary,
  DataStatus,
  EnergyPoint,
  EnergySeries,
  EvidenceItem,
  Investigation,
  ModelStatus,
  PossibleFactor,
  RecommendedCheck,
  Severity,
  TimelineEvent,
  TopCostPeriod,
  UploadJob,
  UploadStage,
} from '@/types'
import {
  asArray,
  asBoolean,
  asDict,
  asEnum,
  asIso,
  asNullableIso,
  asNullableNumber,
  asNumber,
  asString,
  isDict,
  pick,
  unwrap,
} from './normalize'
import { severityFromScore } from '@/utils/format'

/* ── Buildings ──────────────────────────────────────────────── */

const SEVERITIES: readonly Severity[] = ['low', 'medium', 'high', 'critical']
const STATUSES: readonly AnomalyStatus[] = ['new', 'investigating', 'resolved', 'dismissed']
const DATA_STATES = ['ok', 'delayed', 'stale', 'missing', 'processing'] as const
const MODEL_STATES = ['ready', 'training', 'degraded', 'unavailable'] as const

export function mapBuilding(raw: unknown, index = 0): Building {
  const d = asDict(raw)
  const meta = asDict(pick(d, 'meta', 'metadata'))
  const id = asString(pick(d, 'id', 'building_id', 'buildingId', 'code'), `bld_${index + 1}`)
  return {
    id,
    name: asString(pick(d, 'name', 'building_name', 'label'), id),
    location: asString(pick(d, 'location', 'address', 'city'), 'Unspecified location'),
    floors: Math.min(5, Math.max(3, Math.round(asNumber(pick(d, 'floors', 'floor_count', 'levels'), 4)))),
    areaSqFt: asNumber(pick(d, 'area_sq_ft', 'areaSqFt', 'area'), 0),
    tariffRatePerKwh: asNumber(pick(d, 'tariff_rate_per_kwh', 'tariffRatePerKwh', 'tariff_rate', 'tariff'), 8),
    currency: asString(pick(d, 'currency', 'currency_code'), 'INR'),
    meta: {
      buildingType: asString(pick(meta, 'building_type', 'buildingType', 'type'), '') || undefined,
      commissionedOn: asNullableIso(pick(meta, 'commissioned_on', 'commissionedOn')) ?? undefined,
      timezone: asString(pick(meta, 'timezone', 'tz'), '') || undefined,
    },
  }
}

export function mapBuildings(raw: unknown): Building[] {
  const list = asArray(unwrap(raw))
  return list.length ? list.map((item, i) => mapBuilding(item, i)) : []
}

/* ── Status ─────────────────────────────────────────────────── */

export function mapDataStatus(raw: unknown, fallbackInterval = 15): DataStatus {
  if (!isDict(raw)) {
    return {
      state: 'missing',
      lastReadingAt: null,
      coveragePercent: 0,
      intervalMinutes: fallbackInterval,
      message: 'Data status was not reported by the service.',
    }
  }
  return {
    state: asEnum(pick(raw, 'state', 'status'), DATA_STATES, 'ok'),
    lastReadingAt: asNullableIso(pick(raw, 'last_reading_at', 'lastReadingAt', 'last_reading')),
    coveragePercent: asNumber(pick(raw, 'coverage_percent', 'coveragePercent', 'coverage'), 100),
    intervalMinutes: asNumber(pick(raw, 'interval_minutes', 'intervalMinutes', 'interval'), fallbackInterval),
    message: asString(pick(raw, 'message', 'detail', 'description'), ''),
  }
}

export function mapModelStatus(raw: unknown): ModelStatus {
  if (!isDict(raw)) {
    return {
      state: 'unavailable',
      version: '—',
      trainedAt: null,
      accuracy: null,
      baselineMethod: '—',
      message: 'Model status was not reported by the service.',
    }
  }
  return {
    state: asEnum(pick(raw, 'state', 'status'), MODEL_STATES, 'ready'),
    version: asString(pick(raw, 'version', 'model_version'), '—'),
    trainedAt: asNullableIso(pick(raw, 'trained_at', 'trainedAt')),
    accuracy: asNullableNumber(pick(raw, 'accuracy', 'precision', 'score')),
    baselineMethod: asString(pick(raw, 'baseline_method', 'baselineMethod', 'method'), '—'),
    message: asString(pick(raw, 'message', 'detail', 'description'), ''),
  }
}

/* ── Anomalies ──────────────────────────────────────────────── */

export function mapAnomaly(raw: unknown, index = 0): Anomaly {
  const d = asDict(raw)
  const start = asIso(pick(d, 'start', 'start_time', 'started_at', 'from'), new Date().toISOString())
  const end = asIso(pick(d, 'end', 'end_time', 'ended_at', 'to'), start)
  const expected = asNumber(pick(d, 'expected_kwh', 'expectedKwh', 'expected', 'baseline_kwh'), 0)
  const actual = asNumber(pick(d, 'actual_kwh', 'actualKwh', 'actual'), 0)
  const excess = asNumber(
    pick(d, 'excess_kwh', 'excessKwh', 'excess', 'deviation_kwh'),
    Math.max(0, actual - expected),
  )
  const score = asNumber(pick(d, 'score', 'anomaly_score', 'confidence', 'probability'), 0)
  const id = asString(pick(d, 'id', 'anomaly_id', 'anomalyId'), `anom_${index + 1}`)
  return {
    id,
    reference: asString(pick(d, 'reference', 'label', 'display_id', 'code'), `ANOMALY #${String(index + 1).padStart(3, '0')}`),
    buildingId: asString(pick(d, 'building_id', 'buildingId', 'building'), 'unknown'),
    start,
    end,
    expectedKwh: expected,
    actualKwh: actual,
    excessKwh: excess,
    estimatedCost: asNumber(pick(d, 'estimated_cost', 'estimatedCost', 'cost', 'excess_cost'), 0),
    score,
    severity: asEnum(pick(d, 'severity', 'level'), SEVERITIES, severityFromScore(score)),
    floorId: (() => {
      const v = pick(d, 'floor_id', 'floorId', 'floor')
      return v === null || v === undefined || v === '' ? null : asString(v)
    })(),
    floorLabel: (() => {
      const v = pick(d, 'floor_label', 'floorLabel', 'floor_name')
      return v === null || v === undefined || v === '' ? null : asString(v)
    })(),
    status: asEnum(pick(d, 'status', 'state'), STATUSES, 'new'),
    detectedAt: asIso(pick(d, 'detected_at', 'detectedAt', 'created_at'), start),
  }
}

export function mapAnomalyList(raw: unknown, page = 1, pageSize = 25): AnomalyList {
  const root = asDict(unwrap(raw))
  const items = asArray(isDict(raw) ? (pick(root, 'items', 'results', 'anomalies', 'data') ?? raw) : raw).map(
    (item, i) => mapAnomaly(item, i + (page - 1) * pageSize),
  )
  const total = asNumber(pick(root, 'total', 'count', 'total_count'), items.length)
  return {
    items,
    total,
    page: asNumber(pick(root, 'page', 'page_number'), page),
    pageSize: asNumber(pick(root, 'page_size', 'pageSize', 'limit'), pageSize),
  }
}

/* ── Energy ─────────────────────────────────────────────────── */

export function mapEnergyPoint(raw: unknown): EnergyPoint {
  const d = asDict(raw)
  const timestamp = asIso(
    pick(d, 'timestamp', 'ts', 'time', 'datetime', 'recorded_at'),
    new Date().toISOString(),
  )
  const anomalyRaw = pick(d, 'anomaly_id', 'anomalyId')
  return {
    timestamp,
    actualKwh: asNumber(pick(d, 'actual_kwh', 'actualKwh', 'actual', 'energy_kwh', 'consumption'), 0),
    expectedKwh: asNumber(pick(d, 'expected_kwh', 'expectedKwh', 'expected', 'baseline_kwh'), 0),
    intervalMinutes: asNumber(pick(d, 'interval_minutes', 'intervalMinutes'), 0),
    anomalyId: anomalyRaw === null || anomalyRaw === undefined || anomalyRaw === '' ? null : asString(anomalyRaw),
    temperature: asNullableNumber(pick(d, 'temperature', 'temp_c', 'temp')),
    occupancy: asNullableNumber(pick(d, 'occupancy', 'occupancy_pct', 'people')),
  }
}

export function mapEnergySeries(raw: unknown, fallback: { buildingId: string; from: string; to: string }): EnergySeries {
  const root = asDict(unwrap(raw))
  const points = asArray(pick(root, 'points', 'series', 'data', 'readings')).map(mapEnergyPoint)
  const intervalMinutes =
    asNumber(pick(root, 'interval_minutes', 'intervalMinutes'), 15) ||
    points[0]?.intervalMinutes ||
    15
  return {
    buildingId: asString(pick(root, 'building_id', 'buildingId'), fallback.buildingId),
    from: asIso(pick(root, 'from', 'start'), fallback.from),
    to: asIso(pick(root, 'to', 'end'), fallback.to),
    intervalMinutes,
    currency: asString(pick(root, 'currency'), 'INR'),
    tariffRatePerKwh: asNumber(pick(root, 'tariff_rate_per_kwh', 'tariffRatePerKwh', 'tariff_rate'), 8),
    points: points.map((p) => ({ ...p, intervalMinutes: p.intervalMinutes || intervalMinutes })),
  }
}

/* ── Dashboard ──────────────────────────────────────────────── */

export function mapDashboardSummary(
  raw: unknown,
  fallback: { buildingId: string; currency: string; intervalMinutes: number },
): DashboardSummary {
  const d = asDict(unwrap(raw))
  const kpis = asDict(pick(d, 'kpis', 'metrics', 'summary', 'totals'))
  const source = Object.keys(kpis).length ? { ...d, ...kpis } : d
  const delta = asDict(pick(d, 'delta_percent', 'deltaPercent', 'change', 'deltas'))

  const currentUsageKwh = asNumber(
    pick(source, 'current_usage_kwh', 'currentUsageKwh', 'current_usage', 'usage_kwh'),
    0,
  )
  const expectedUsageKwh = asNumber(
    pick(source, 'expected_usage_kwh', 'expectedUsageKwh', 'expected_usage', 'expected_kwh'),
    0,
  )
  const excessKwh = asNumber(
    pick(source, 'excess_kwh', 'excessKwh', 'excess_energy', 'excess_energy_kwh'),
    Math.max(0, currentUsageKwh - expectedUsageKwh),
  )

  return {
    buildingId: asString(pick(d, 'building_id', 'buildingId'), fallback.buildingId),
    generatedAt: asIso(pick(d, 'generated_at', 'generatedAt', 'as_of'), new Date().toISOString()),
    currency: asString(pick(d, 'currency', 'currency_code'), fallback.currency),
    tariffRatePerKwh: asNumber(pick(d, 'tariff_rate_per_kwh', 'tariffRatePerKwh', 'tariff_rate'), 8),
    currentUsageKwh,
    expectedUsageKwh,
    excessKwh,
    estimatedExcessCost: asNumber(
      pick(d, 'estimated_excess_cost', 'estimatedExcessCost', 'excess_cost', 'estimated_cost'),
      excessKwh * asNumber(pick(d, 'tariff_rate_per_kwh', 'tariffRatePerKwh', 'tariff_rate'), 8),
    ),
    activeAnomalyCount: asNumber(
      pick(d, 'active_anomaly_count', 'activeAnomalyCount', 'active_anomalies', 'anomaly_count'),
      0,
    ),
    deltaPercent: {
      currentUsage: asNullableNumber(pick(delta, 'current_usage', 'currentUsage', 'usage')),
      expectedUsage: asNullableNumber(pick(delta, 'expected_usage', 'expectedUsage', 'expected')),
      excessEnergy: asNullableNumber(pick(delta, 'excess_energy', 'excessEnergy', 'excess')),
      excessCost: asNullableNumber(pick(delta, 'excess_cost', 'excessCost', 'cost')),
    },
    dataStatus: mapDataStatus(pick(d, 'data_status', 'dataStatus'), fallback.intervalMinutes),
    modelStatus: mapModelStatus(pick(d, 'model_status', 'modelStatus', 'model')),
  }
}

/* ── Cost ───────────────────────────────────────────────────── */

function mapCostBuckets(raw: unknown, fallbackCurrencyDate: string): CostBucket[] {
  return asArray(raw).map((item, i) => {
    const d = asDict(item)
    const date = asIso(pick(d, 'date', 'day', 'timestamp', 'bucket'), fallbackCurrencyDate)
    return {
      label: asString(pick(d, 'label', 'name'), new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) || `P${i + 1}`),
      date,
      excessKwh: asNumber(pick(d, 'excess_kwh', 'excessKwh', 'excess'), 0),
      estimatedCost: asNumber(pick(d, 'estimated_cost', 'estimatedCost', 'cost'), 0),
    }
  })
}

export function mapCostImpact(
  raw: unknown,
  fallback: { buildingId: string; currency: string },
): CostImpact {
  const d = asDict(unwrap(raw))
  const totals = asDict(pick(d, 'totals', 'summary'))
  const period = asDict(pick(d, 'periods'))
  const daily = mapCostBuckets(pick(d, 'daily', 'daily_breakdown') ?? pick(period, 'daily'), new Date().toISOString())
  const weekly = mapCostBuckets(pick(d, 'weekly', 'weekly_breakdown') ?? pick(period, 'weekly'), new Date().toISOString())
  const monthly = mapCostBuckets(
    pick(d, 'monthly_projection', 'monthlyProjection', 'projection') ?? pick(period, 'monthly'),
    new Date().toISOString(),
  )

  const topPeriods: TopCostPeriod[] = asArray(
    pick(d, 'top_periods', 'topPeriods', 'top_anomalies', 'highest_cost_periods'),
  ).map((item, i) => {
    const b = asDict(item)
    const start = asIso(pick(b, 'start', 'start_time', 'from'), new Date().toISOString())
    const score = asNumber(pick(b, 'score'), 0)
    return {
      anomalyId: asString(pick(b, 'anomaly_id', 'anomalyId', 'id'), `anom_${i + 1}`),
      reference: asString(pick(b, 'reference', 'label'), `ANOMALY #${String(i + 1).padStart(3, '0')}`),
      start,
      end: asIso(pick(b, 'end', 'end_time', 'to'), start),
      excessKwh: asNumber(pick(b, 'excess_kwh', 'excessKwh', 'excess'), 0),
      estimatedCost: asNumber(pick(b, 'estimated_cost', 'estimatedCost', 'cost'), 0),
      severity: asEnum(pick(b, 'severity', 'level'), SEVERITIES, severityFromScore(score)),
    }
  })

  const sum = (rows: CostBucket[], key: 'excessKwh' | 'estimatedCost') =>
    rows.reduce((acc, r) => acc + r[key], 0)

  return {
    buildingId: asString(pick(d, 'building_id', 'buildingId'), fallback.buildingId),
    currency: asString(pick(d, 'currency', 'currency_code'), fallback.currency),
    tariffRatePerKwh: asNumber(pick(d, 'tariff_rate_per_kwh', 'tariffRatePerKwh', 'tariff_rate'), 8),
    daily,
    weekly,
    monthlyProjection: monthly,
    totals: {
      dailyExcessKwh: asNumber(pick(totals, 'daily_excess_kwh', 'dailyExcessKwh'), sum(daily, 'excessKwh')),
      dailyExcessCost: asNumber(pick(totals, 'daily_excess_cost', 'dailyExcessCost'), sum(daily, 'estimatedCost')),
      weeklyExcessKwh: asNumber(pick(totals, 'weekly_excess_kwh', 'weeklyExcessKwh'), sum(weekly, 'excessKwh')),
      weeklyExcessCost: asNumber(pick(totals, 'weekly_excess_cost', 'weeklyExcessCost'), sum(weekly, 'estimatedCost')),
      monthlyProjectedExcessKwh: asNumber(
        pick(totals, 'monthly_projected_excess_kwh', 'monthlyProjectedExcessKwh'),
        sum(monthly, 'excessKwh'),
      ),
      monthlyProjectedExcessCost: asNumber(
        pick(totals, 'monthly_projected_excess_cost', 'monthlyProjectedExcessCost'),
        sum(monthly, 'estimatedCost'),
      ),
    },
    topPeriods,
    disclaimer: asString(
      pick(d, 'disclaimer', 'note'),
      'Estimated excess cost only. Figures are derived from reported meter readings and the configured tariff; actual charges may differ.',
    ),
  }
}

/* ── Investigation ──────────────────────────────────────────── */

export function mapEvidence(raw: unknown): EvidenceItem[] {
  return asArray(raw).map((item, i) => {
    const d = asDict(item)
    return {
      id: asString(pick(d, 'id', 'key'), `ev_${i + 1}`),
      label: asString(pick(d, 'label', 'name', 'title'), 'Observation'),
      value: asString(pick(d, 'value', 'display_value'), '—'),
      detail: asString(pick(d, 'detail', 'description', 'note'), '') || undefined,
      kind: asEnum(pick(d, 'kind', 'type'), ['metric', 'baseline', 'correlation', 'context'] as const, 'metric'),
    }
  })
}

export function mapPossibleFactors(raw: unknown): PossibleFactor[] {
  return asArray(raw).map((item, i) => {
    const d = asDict(item)
    return {
      id: asString(pick(d, 'id', 'key'), `f_${i + 1}`),
      label: asString(pick(d, 'label', 'name', 'factor'), 'Possible factor'),
      category: asEnum(
        pick(d, 'category', 'group'),
        ['hvac', 'lighting', 'equipment', 'operation', 'occupancy', 'data'] as const,
        'equipment',
      ),
      rationale: asString(pick(d, 'rationale', 'detail', 'description', 'why'), ''),
      status: asEnum(pick(d, 'status', 'state'), ['unverified', 'corroborated', 'ruled_out'] as const, 'unverified'),
    }
  })
}

export function mapRecommendedChecks(raw: unknown): RecommendedCheck[] {
  return asArray(raw).map((item, i) => {
    const d = asDict(item)
    return {
      id: asString(pick(d, 'id', 'key'), `c_${i + 1}`),
      label: asString(pick(d, 'label', 'name', 'action', 'check'), 'Verify operating schedule'),
      owner: (() => {
        const v = pick(d, 'owner', 'assignee', 'team')
        return v === null || v === undefined || v === '' ? null : asString(v)
      })(),
      priority: asEnum(pick(d, 'priority', 'severity'), ['low', 'medium', 'high'] as const, 'medium'),
    }
  })
}

export function mapTimeline(raw: unknown): TimelineEvent[] {
  return asArray(raw)
    .map((item, i) => {
      const d = asDict(item)
      return {
        id: asString(pick(d, 'id', 'key'), `t_${i + 1}`),
        timestamp: asIso(pick(d, 'timestamp', 'time', 'at'), new Date().toISOString()),
        label: asString(pick(d, 'label', 'name', 'event'), 'Event'),
        kind: asEnum(
          pick(d, 'kind', 'type', 'state'),
          ['normal', 'anomaly_start', 'peak', 'normalised', 'info'] as const,
          'info',
        ),
        detail: asString(pick(d, 'detail', 'description'), '') || undefined,
        deviationPercent: asNullableNumber(pick(d, 'deviation_percent', 'deviationPercent', 'deviation')),
      }
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
}

export function mapInvestigation(raw: unknown, fallbackAnomaly: Anomaly): Investigation {
  const d = asDict(unwrap(raw))
  return {
    anomalyId: asString(pick(d, 'anomaly_id', 'anomalyId', 'id'), fallbackAnomaly.id),
    reference: asString(pick(d, 'reference', 'label'), fallbackAnomaly.reference),
    buildingId: asString(pick(d, 'building_id', 'buildingId'), fallbackAnomaly.buildingId),
    generatedAt: asIso(pick(d, 'generated_at', 'generatedAt', 'created_at'), new Date().toISOString()),
    summary: asString(pick(d, 'summary', 'headline', 'title'), ''),
    observation: asString(pick(d, 'observation', 'description', 'details'), ''),
    expectedKwh: asNumber(pick(d, 'expected_kwh', 'expectedKwh', 'expected'), fallbackAnomaly.expectedKwh),
    actualKwh: asNumber(pick(d, 'actual_kwh', 'actualKwh', 'actual'), fallbackAnomaly.actualKwh),
    excessKwh: asNumber(pick(d, 'excess_kwh', 'excessKwh', 'excess'), fallbackAnomaly.excessKwh),
    estimatedCost: asNumber(pick(d, 'estimated_cost', 'estimatedCost', 'cost'), fallbackAnomaly.estimatedCost),
    score: asNumber(pick(d, 'score', 'confidence'), fallbackAnomaly.score),
    severity: asEnum(pick(d, 'severity', 'level'), SEVERITIES, fallbackAnomaly.severity),
    start: asIso(pick(d, 'start', 'start_time', 'period_start'), fallbackAnomaly.start),
    end: asIso(pick(d, 'end', 'end_time', 'period_end'), fallbackAnomaly.end),
    currency: asString(pick(d, 'currency'), 'INR'),
    tariffRatePerKwh: asNumber(pick(d, 'tariff_rate_per_kwh', 'tariffRatePerKwh', 'tariff_rate'), 8),
    evidence: mapEvidence(pick(d, 'evidence', 'evidence_items')),
    possibleFactors: mapPossibleFactors(
      pick(d, 'possible_factors', 'possibleFactors', 'factors', 'hypotheses'),
    ),
    recommendedChecks: mapRecommendedChecks(
      pick(d, 'recommended_checks', 'recommendedChecks', 'next_steps', 'actions'),
    ),
    timeline: mapTimeline(pick(d, 'timeline', 'events', 'timeline_events')),
    confidenceNote: asString(
      pick(d, 'confidence_note', 'confidenceNote', 'caveat'),
      'Deviation confirmed against the learned baseline. Root cause is not asserted — verify the suggested checks with facilities data.',
    ),
    modelVersion: asString(pick(d, 'model_version', 'modelVersion', 'version'), '—'),
  }
}

/* ── Upload jobs ────────────────────────────────────────────── */

const STAGE_KEYS = ['uploading', 'cleaning', 'learning', 'detecting', 'costing', 'complete'] as const
const STAGE_LABELS: Record<(typeof STAGE_KEYS)[number], string> = {
  uploading: 'Uploading',
  cleaning: 'Cleaning',
  learning: 'Learning Baseline',
  detecting: 'Detecting Anomalies',
  costing: 'Calculating Cost',
  complete: 'Complete',
}

export function defaultStages(): UploadStage[] {
  return STAGE_KEYS.map((key) => ({ key, label: STAGE_LABELS[key], state: 'pending' }))
}

export function mapUploadJob(raw: unknown, fallbackBuildingId = ''): UploadJob {
  const d = asDict(unwrap(raw))
  const rawStages = asArray(pick(d, 'stages', 'pipeline', 'steps'))
  const stages: UploadStage[] = rawStages.length
    ? rawStages.map((item, i) => {
        const s = asDict(item)
        const key = asEnum(pick(s, 'key', 'stage'), STAGE_KEYS, STAGE_KEYS[Math.min(i, STAGE_KEYS.length - 1)])
        return {
          key,
          label: asString(pick(s, 'label', 'name'), STAGE_LABELS[key]),
          state: asEnum(pick(s, 'state', 'status'), ['pending', 'active', 'done', 'failed'] as const, 'pending'),
          detail: asString(pick(s, 'detail', 'message'), '') || undefined,
        }
      })
    : defaultStages()

  return {
    jobId: asString(pick(d, 'job_id', 'jobId', 'id'), ''),
    state: asEnum(pick(d, 'state', 'status'), ['queued', 'processing', 'complete', 'failed'] as const, 'queued'),
    stages,
    rowsAccepted: asNumber(pick(d, 'rows_accepted', 'rowsAccepted', 'accepted'), 0),
    rowsRejected: asNumber(pick(d, 'rows_rejected', 'rowsRejected', 'rejected'), 0),
    progress: Math.min(100, Math.max(0, asNumber(pick(d, 'progress', 'percent'), 0))),
    buildingId: asString(pick(d, 'building_id', 'buildingId'), fallbackBuildingId),
    message: asString(pick(d, 'message', 'detail'), '') || undefined,
    error: asString(pick(d, 'error'), '') || undefined,
    createdAt: asIso(pick(d, 'created_at', 'createdAt'), new Date().toISOString()),
  }
}

/* ── Query helpers ──────────────────────────────────────────── */

export function buildAnomalyParams(query: AnomalyQuery): Record<string, string> {
  const params: Record<string, string> = {
    building_id: query.buildingId,
    from: query.from,
    to: query.to,
  }
  if (query.severities?.length) params.severity = query.severities.join(',')
  if (query.status?.length) params.status = query.status.join(',')
  if (typeof query.minScore === 'number') params.min_score = String(query.minScore)
  if (query.search) params.search = query.search
  return params
}

export { asBoolean }
