import type {
  Anomaly,
  AnomalyList,
  AnomalyQuery,
  CostImpact,
  DashboardSummary,
  EnergySeries,
  Investigation,
  ModelStatus,
  UploadJob,
} from '@/types'
import { ApiError } from '../http'
import { defaultStages, mapAnomaly } from '../mappers'
import type {
  RealtimeSubscription,
  SeriesParams,
  Transport,
  TransportHealth,
  UploadOptions,
} from '../transport'
import {
  MOCK_BUILDINGS,
  findBuilding,
  generateCostImpact,
  generateInvestigation,
  generateSeries,
  generateSummary,
} from './generator'
import type { RealtimeHandlers } from '../transport'

/**
 * Mock transport — same contract as `LiveTransport`, backed by deterministic
 * synthetic data and simulated latency.
 *
 * Swap rule: this class is instantiated only when `VITE_API_MODE=mock`, or when
 * `VITE_API_MODE=auto` and the live backend failed a connectivity probe.
 * Removing it from `services/api.ts` is the only change needed to delete it.
 */

const LATENCY_RANGE: [number, number] = [180, 620]

interface JobRecord {
  job: UploadJob
  startedAt: number
  buildingId: string
}

const jobs = new Map<string, JobRecord>()
const anomalyIndex = new Map<string, Anomaly>()
const listeners = new Set<RealtimeHandlers>()

function delay<T>(value: T, jitter = 1): Promise<T> {
  const [min, max] = LATENCY_RANGE
  const ms = (min + Math.random() * (max - min)) * jitter
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function fail(message: string, kind: 'not_found' | 'server' = 'not_found'): never {
  throw new ApiError({ message, kind, status: kind === 'not_found' ? 404 : 500 })
}

export class MockTransport implements Transport {
  readonly name = 'mock' as const

  async health(): Promise<TransportHealth> {
    const started = performance.now()
    await delay(null, 0.3)
    return {
      online: true,
      latencyMs: Math.round(performance.now() - started),
      version: 'mock-1.0.0',
    }
  }

  async getBuildings() {
    return delay(MOCK_BUILDINGS)
  }

  async getDashboardSummary(params: SeriesParams): Promise<DashboardSummary> {
    return delay(generateSummary(params.buildingId, params.from, params.to) as DashboardSummary)
  }

  async getEnergySeries(params: SeriesParams): Promise<EnergySeries> {
    return delay(generateSeries(params.buildingId, params.from, params.to).series)
  }

  async getAnomalies(query: AnomalyQuery): Promise<AnomalyList> {
    const { anomalies } = generateSeries(query.buildingId, query.from, query.to)
    let items = anomalies.sort((a, b) => Date.parse(b.start) - Date.parse(a.start))

    if (query.severities?.length) items = items.filter((a) => query.severities!.includes(a.severity))
    if (query.status?.length) items = items.filter((a) => query.status!.includes(a.status))
    if (typeof query.minScore === 'number') items = items.filter((a) => a.score >= query.minScore!)
    if (query.search) {
      const needle = query.search.toLowerCase()
      items = items.filter(
        (a) =>
          a.reference.toLowerCase().includes(needle) ||
          (a.floorLabel ?? '').toLowerCase().includes(needle),
      )
    }

    const pageSize = 100
    return delay({
      items: items.slice(0, pageSize),
      total: items.length,
      page: 1,
      pageSize,
    })
  }

  async getAnomaly(id: string): Promise<Anomaly> {
    const cached = anomalyIndex.get(id)
    if (cached) return delay(cached)
    for (const building of MOCK_BUILDINGS) {
      const window = generateSeries(building.id, iso(-30), iso(0))
      const found = window.anomalies.find((a) => a.id === id)
      if (found) {
        anomalyIndex.set(id, found)
        return delay(found)
      }
    }
    return fail(`Anomaly ${id} was not found.`)
  }

  async getCostImpact(params: SeriesParams): Promise<CostImpact> {
    return delay(generateCostImpact(params.buildingId, params.from, params.to))
  }

  async getInvestigation(id: string): Promise<Investigation> {
    const anomaly = await this.getAnomaly(id)
    return delay(generateInvestigation(anomaly, anomaly.buildingId))
  }

  async uploadEnergy(_file: File, options: UploadOptions): Promise<UploadJob> {
    const jobId = `job_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4).toString(36)}`
    const rows = 5_000 + Math.floor(Math.random() * 40_000)
    const job: UploadJob = {
      jobId,
      state: 'queued',
      stages: defaultStages(),
      rowsAccepted: 0,
      rowsRejected: Math.floor(rows * 0.004),
      progress: 2,
      buildingId: options.buildingId,
      message: 'Upload accepted. Queued for processing.',
      createdAt: new Date().toISOString(),
    }
    jobs.set(jobId, { job, startedAt: Date.now(), buildingId: options.buildingId })
    broadcast({ type: 'job.progress', at: new Date().toISOString(), payload: job })
    return delay(job, 0.8)
  }

  async getUploadJob(jobId: string): Promise<UploadJob> {
    const record = jobs.get(jobId)
    if (!record) return fail(`Upload job ${jobId} was not found.`)
    const advanced = advanceJob(record, Date.now())
    broadcast({ type: 'job.progress', at: new Date().toISOString(), payload: advanced })
    return delay(advanced, 0.35)
  }

  /**
   * Emits a synthetic anomaly every ~45 s so the realtime UI (notification,
   * chart highlight, KPI bump, 3D reaction) can be exercised without a backend.
   */
  subscribe(handlers: RealtimeHandlers): RealtimeSubscription {
    listeners.add(handlers)
    handlers.onStatusChange?.('open')

    const timer = window.setInterval(() => {
      try {
        emitSyntheticAnomaly()
      } catch {
        /* keep the stream alive */
      }
    }, 45_000)

    return {
      close: () => {
        window.clearInterval(timer)
        listeners.delete(handlers)
      },
    }
  }
}

/* ── Simulation internals ───────────────────────────────────── */

const STAGE_SEQUENCE = ['uploading', 'cleaning', 'learning', 'detecting', 'costing', 'complete'] as const
const STAGE_DURATION_MS = 2_600

function advanceJob(record: JobRecord, now: number): UploadJob {
  const elapsed = now - record.startedAt
  const stageIndex = Math.min(STAGE_SEQUENCE.length - 1, Math.floor(elapsed / STAGE_DURATION_MS))
  const progress = Math.min(100, Math.round((elapsed / (STAGE_DURATION_MS * STAGE_SEQUENCE.length)) * 100))

  const stages = STAGE_SEQUENCE.map((key, i) => {
    if (i < stageIndex) return { key, label: labelFor(key), state: 'done' as const }
    if (i === stageIndex) {
      const last = stageIndex === STAGE_SEQUENCE.length - 1
      return {
        key,
        label: labelFor(key),
        state: (last ? 'done' : 'active') as 'done' | 'active',
        detail: detailFor(key),
      }
    }
    return { key, label: labelFor(key), state: 'pending' as const }
  })

  const state: UploadJob['state'] =
    stageIndex >= STAGE_SEQUENCE.length - 1 ? 'complete' : stageIndex === 0 ? 'queued' : 'processing'

  const next: UploadJob = {
    ...record.job,
    state,
    stages,
    progress: state === 'complete' ? 100 : Math.max(2, progress),
    rowsAccepted: state === 'complete' ? 5_000 + Math.floor(Math.random() * 40_000) : 0,
    message:
      state === 'complete'
        ? 'Processing complete. Baseline refreshed and anomalies republished.'
        : undefined,
  }
  record.job = next
  return next
}

function labelFor(key: (typeof STAGE_SEQUENCE)[number]): string {
  return {
    uploading: 'Uploading',
    cleaning: 'Cleaning',
    learning: 'Learning Baseline',
    detecting: 'Detecting Anomalies',
    costing: 'Calculating Cost',
    complete: 'Complete',
  }[key]
}

function detailFor(key: (typeof STAGE_SEQUENCE)[number]): string | undefined {
  return {
    uploading: 'Streaming rows to the ingestion endpoint.',
    cleaning: 'Deduplicating timestamps and imputing gaps.',
    learning: 'Refitting the seasonal baseline profile.',
    detecting: 'Scoring residuals against the anomaly threshold.',
    costing: 'Applying the configured tariff to excess energy.',
    complete: 'Baseline and anomaly results are published.',
  }[key]
}

let syntheticCounter = 0

function emitSyntheticAnomaly(): void {
  const building = MOCK_BUILDINGS[syntheticCounter % MOCK_BUILDINGS.length]
  syntheticCounter += 1
  const { anomalies } = generateSeries(building.id, iso(-1), iso(0))
  const latest = anomalies.sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt))[0]
  if (!latest) return

  // Nudge it forward so it reads as a brand-new detection.
  const detected: Anomaly = mapAnomaly({
    ...latest,
    id: `anom_live_${Date.now().toString(36)}`,
    reference: `ANOMALY #${String(700 + syntheticCounter).padStart(3, '0')}`,
    detected_at: new Date().toISOString(),
    status: 'new',
  })

  anomalyIndex.set(detected.id, detected)
  broadcast({ type: 'anomaly.detected', at: new Date().toISOString(), payload: detected })

  broadcast({
    type: 'model.status',
    at: new Date().toISOString(),
    payload: {
      state: 'ready',
      version: 'wb-anomaly-2.4.1',
      trained_at: new Date().toISOString(),
      accuracy: 0.93,
      baseline_method: 'Seasonal hourly profile + robust residual thresholding',
      message: 'Baseline model is trained and serving predictions.',
    } satisfies ModelStatus,
  })
}

function broadcast(event: unknown): void {
  listeners.forEach((handler) => {
    try {
      handler.onEvent(event)
    } catch {
      /* a broken subscriber must not break the stream */
    }
  })
}

function iso(offsetHours: number): string {
  return new Date(Date.now() + offsetHours * 3_600_000).toISOString()
}

export { findBuilding }
