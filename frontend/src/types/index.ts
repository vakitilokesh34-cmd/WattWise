/**
 * WattWise domain types.
 *
 * These mirror the backend contract. The frontend never derives anomaly
 * results locally — it only renders what the API returns. If the backend
 * changes a field name, update the matching mapper in `services/api.ts`.
 */

export type ISODateString = string

export type Severity = 'low' | 'medium' | 'high' | 'critical'

export type AnomalyStatus = 'new' | 'investigating' | 'resolved' | 'dismissed'

export interface Building {
  id: string
  name: string
  location: string
  /** Number of physical floors the 3D model should render (3–5). */
  floors: number
  areaSqFt: number
  /** Backend-reported tariff used for cost estimation. */
  tariffRatePerKwh: number
  currency: string
  /** Optional metadata for the 3D scene. */
  meta?: {
    buildingType?: string
    commissionedOn?: ISODateString
    timezone?: string
  }
}

export interface DataStatus {
  state: 'ok' | 'delayed' | 'stale' | 'missing' | 'processing'
  /** Last reading timestamp reported by the ingestion pipeline. */
  lastReadingAt: ISODateString | null
  /** 0–100 share of expected intervals present in the window. */
  coveragePercent: number
  intervalMinutes: number
  message: string
}

export interface ModelStatus {
  state: 'ready' | 'training' | 'degraded' | 'unavailable'
  version: string
  trainedAt: ISODateString | null
  /** Backend-reported detection metric. Rendered as-is; never invented here. */
  accuracy: number | null
  baselineMethod: string
  message: string
}

export interface Anomaly {
  id: string
  /** Human-facing label, e.g. "ANOMALY #024". */
  reference: string
  buildingId: string
  start: ISODateString
  end: ISODateString
  expectedKwh: number
  actualKwh: number
  excessKwh: number
  estimatedCost: number
  /** Model confidence 0–1. */
  score: number
  severity: Severity
  /** Floor the deviation was localised to, when the backend supplies it. */
  floorId: string | null
  floorLabel: string | null
  status: AnomalyStatus
  detectedAt: ISODateString
}

export interface EnergyPoint {
  timestamp: ISODateString
  actualKwh: number
  expectedKwh: number
  intervalMinutes: number
  /** Set by the backend when this bucket belongs to a detected anomaly. */
  anomalyId: string | null
  temperature: number | null
  occupancy: number | null
}

export interface EnergySeries {
  buildingId: string
  from: ISODateString
  to: ISODateString
  intervalMinutes: number
  currency: string
  tariffRatePerKwh: number
  points: EnergyPoint[]
}

export interface DashboardSummary {
  buildingId: string
  generatedAt: ISODateString
  currency: string
  tariffRatePerKwh: number
  currentUsageKwh: number
  expectedUsageKwh: number
  excessKwh: number
  estimatedExcessCost: number
  activeAnomalyCount: number
  /** Direction of travel vs the trailing period, as reported by the backend. */
  deltaPercent: {
    currentUsage: number | null
    expectedUsage: number | null
    excessEnergy: number | null
    excessCost: number | null
  }
  dataStatus: DataStatus
  modelStatus: ModelStatus
}

export interface CostBucket {
  label: string
  date: ISODateString
  excessKwh: number
  estimatedCost: number
}

export interface TopCostPeriod {
  anomalyId: string
  reference: string
  start: ISODateString
  end: ISODateString
  excessKwh: number
  estimatedCost: number
  severity: Severity
}

export interface CostImpact {
  buildingId: string
  currency: string
  tariffRatePerKwh: number
  daily: CostBucket[]
  weekly: CostBucket[]
  /** Forward-looking projection. Always labelled as an estimate in the UI. */
  monthlyProjection: CostBucket[]
  totals: {
    dailyExcessKwh: number
    dailyExcessCost: number
    weeklyExcessKwh: number
    weeklyExcessCost: number
    monthlyProjectedExcessKwh: number
    monthlyProjectedExcessCost: number
  }
  topPeriods: TopCostPeriod[]
  /** Mandatory disclaimer supplied by the backend/business rules. */
  disclaimer: string
}

export type TimelineEventKind =
  | 'normal'
  | 'anomaly_start'
  | 'peak'
  | 'normalised'
  | 'info'

export interface TimelineEvent {
  id: string
  timestamp: ISODateString
  label: string
  kind: TimelineEventKind
  detail?: string
  /** Deviation percentage vs baseline at this moment, when known. */
  deviationPercent?: number | null
}

export type EvidenceKind = 'metric' | 'baseline' | 'correlation' | 'context'

export interface EvidenceItem {
  id: string
  label: string
  value: string
  detail?: string
  kind: EvidenceKind
}

export type FactorCategory =
  | 'hvac'
  | 'lighting'
  | 'equipment'
  | 'operation'
  | 'occupancy'
  | 'data'

/**
 * A factor the UI suggests *checking*. The frontend never asserts a cause —
 * every factor is rendered as an unverified hypothesis unless the backend
 * explicitly reports corroboration.
 */
export interface PossibleFactor {
  id: string
  label: string
  category: FactorCategory
  rationale: string
  status: 'unverified' | 'corroborated' | 'ruled_out'
}

export interface RecommendedCheck {
  id: string
  label: string
  owner: string | null
  priority: 'low' | 'medium' | 'high'
}

export interface Investigation {
  anomalyId: string
  reference: string
  buildingId: string
  generatedAt: ISODateString
  summary: string
  observation: string
  expectedKwh: number
  actualKwh: number
  excessKwh: number
  estimatedCost: number
  score: number
  severity: Severity
  start: ISODateString
  end: ISODateString
  currency: string
  tariffRatePerKwh: number
  evidence: EvidenceItem[]
  possibleFactors: PossibleFactor[]
  recommendedChecks: RecommendedCheck[]
  timeline: TimelineEvent[]
  /** e.g. "Correlation only — confirm with facilities before acting." */
  confidenceNote: string
  modelVersion: string
}

/* ── Uploads ───────────────────────────────────────────────── */

export type UploadStageKey =
  | 'uploading'
  | 'cleaning'
  | 'learning'
  | 'detecting'
  | 'costing'
  | 'complete'

export type StageState = 'pending' | 'active' | 'done' | 'failed'

export interface UploadStage {
  key: UploadStageKey
  label: string
  state: StageState
  detail?: string
}

export type JobState = 'queued' | 'processing' | 'complete' | 'failed'

export interface UploadJob {
  jobId: string
  state: JobState
  stages: UploadStage[]
  rowsAccepted: number
  rowsRejected: number
  /** 0–100 */
  progress: number
  buildingId: string
  message?: string
  error?: string
  createdAt: ISODateString
}

/* ── Query shapes ──────────────────────────────────────────── */

export interface RangePreset {
  key: string
  label: string
  hours: number
}

export interface DateRange {
  from: ISODateString
  to: ISODateString
  label: string
}

export interface AnomalyQuery {
  buildingId: string
  from: ISODateString
  to: ISODateString
  severities?: Severity[]
  status?: AnomalyStatus[]
  minScore?: number
  search?: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AnomalyList {
  items: Anomaly[]
  total: number
  page: number
  pageSize: number
}

export interface Notification {
  id: string
  kind: 'anomaly' | 'model' | 'data' | 'system'
  title: string
  body: string
  severity: Severity | 'info'
  createdAt: ISODateString
  read: boolean
  /** Deep link into the app, e.g. "/anomalies?focus=an_024". */
  href?: string
  anomalyId?: string
}

export type HealthState = 'checking' | 'online' | 'degraded' | 'offline'

export interface HealthReport {
  state: HealthState
  latencyMs: number | null
  mode: 'live' | 'mock'
  checkedAt: ISODateString
  version?: string
}

/* ── Realtime envelope ─────────────────────────────────────── */

export type RealtimeEvent =
  | { type: 'hello'; transport: string; at: ISODateString }
  | { type: 'anomaly.detected'; at: ISODateString; payload: Anomaly }
  | { type: 'reading.updated'; at: ISODateString; payload: EnergyPoint }
  | { type: 'model.status'; at: ISODateString; payload: ModelStatus }
  | { type: 'data.status'; at: ISODateString; payload: DataStatus }
  | { type: 'job.progress'; at: ISODateString; payload: UploadJob }
  /** Polling fallback: aggregate changed, consumers must revalidate. */
  | { type: 'summary.snapshot'; at: ISODateString; payload: DashboardSummary }
  | { type: 'ping'; at: ISODateString }
