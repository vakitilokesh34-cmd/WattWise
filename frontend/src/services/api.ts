import type {
  Anomaly,
  AnomalyList,
  AnomalyQuery,
  Building,
  CostImpact,
  DashboardSummary,
  EnergySeries,
  HealthReport,
  Investigation,
  Notification,
  RealtimeEvent,
  UploadJob,
} from '@/types'
import { apiConfig } from './config'
import { ApiError, toApiError } from './http'
import { LiveTransport } from './liveTransport'
import { MockTransport } from './mock/transport'
import type { RealtimeSubscription, SeriesParams, Transport, UploadOptions } from './transport'

/* ─────────────────────────────────────────────────────────────
   Public API surface.

   UI components import ONLY from this module. Transport selection, response
   caching and mock fallback are resolved here so swapping the backend never
   requires touching a component.
   ───────────────────────────────────────────────────────────── */

const live = new LiveTransport()
const mock = new MockTransport()

type CacheEntry = { value: unknown; expiresAt: number }
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

const TTL = {
  buildings: 10 * 60_000,
  dashboard: 30_000,
  energy: 60_000,
  anomalies: 45_000,
  anomaly: 60_000,
  cost: 120_000,
  investigation: 5 * 60_000,
} as const

type ModeListeners = Set<(mode: 'live' | 'mock', report: HealthReport) => void>
const modeListeners: ModeListeners = new Set()

let activeTransport: Transport = apiConfig.mode === 'mock' ? mock : live
let resolved = apiConfig.mode === 'mock'
let healthReport: HealthReport = {
  state: 'checking',
  latencyMs: null,
  mode: activeTransport.name,
  checkedAt: new Date().toISOString(),
}

/* ── Cache helpers ──────────────────────────────────────────── */

async function cached<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value as T

  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>

  const promise = factory()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs })
      return value
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, promise)
  return promise
}

function seriesKey(scope: string, params: SeriesParams): string {
  return `${scope}:${params.buildingId}:${params.from}:${params.to}:${params.intervalMinutes ?? 'auto'}`
}

function anomalyKey(query: AnomalyQuery): string {
  return [
    'anomalies',
    query.buildingId,
    query.from,
    query.to,
    (query.severities ?? []).join('|'),
    (query.status ?? []).join('|'),
    query.minScore ?? '',
    query.search ?? '',
  ].join(':')
}

/** Drop cached responses. Pass a scope prefix or omit to clear everything. */
export function invalidate(scope?: string): void {
  if (!scope) {
    cache.clear()
    inflight.clear()
    return
  }
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(scope)) cache.delete(key)
  }
  for (const key of Array.from(inflight.keys())) {
    if (key.startsWith(scope)) inflight.delete(key)
  }
}

/** Realtime events must never be served from cache. */
export function pushRealtimeAnomaly(anomaly: Anomaly): void {
  invalidate('anomalies')
  invalidate('anomaly')
  invalidate('dashboard')
  invalidate('cost')
  const existing = cache.get('anomalyRegistry') as { value: Anomaly[] } | undefined
  const registry = existing?.value ?? []
  if (!registry.some((a) => a.id === anomaly.id)) {
    cache.set('anomalyRegistry', {
      value: [anomaly, ...registry].slice(0, 200),
      expiresAt: Date.now() + 60_000,
    })
  }
}

/* ── Transport resolution ───────────────────────────────────── */

function setMode(mode: 'live' | 'mock', report: Partial<HealthReport>): void {
  const next: HealthReport = {
    state: report.state ?? (mode === 'live' ? 'online' : 'online'),
    latencyMs: report.latencyMs ?? null,
    mode,
    checkedAt: new Date().toISOString(),
    version: report.version,
  }
  healthReport = next
  modeListeners.forEach((listener) => listener(mode, next))
}

/**
 * Chooses the transport for this session.
 *  - `mock`  → always mock.
 *  - `live`  → always live; failures surface as ApiError.
 *  - `auto`  → probe the backend once; fall back to mock on connectivity errors.
 */
async function ensureTransport(): Promise<Transport> {
  if (resolved) return activeTransport

  if (apiConfig.mode === 'mock') {
    resolved = true
    setMode('mock', { state: 'online', latencyMs: 0, version: 'mock-1.0.0' })
    return activeTransport
  }

  try {
    const health = await live.health()
    activeTransport = live
    resolved = true
    setMode('live', { state: 'online', latencyMs: health.latencyMs, version: health.version })
  } catch (error) {
    const apiError = toApiError(error)
    if (apiConfig.mode === 'auto' && apiConfig.mockFallbackEnabled && apiError.isConnectivity) {
      activeTransport = mock
      resolved = true
      setMode('mock', { state: 'degraded', latencyMs: null, version: 'mock-1.0.0' })
    } else {
      resolved = true
      setMode('live', { state: 'offline', latencyMs: null })
      throw apiError
    }
  }
  return activeTransport
}

/**
 * Runs `operation` against the resolved transport, retrying once against the
 * mock layer if `auto` mode is active and the backend turns unreachable at
 * runtime (e.g. the service restarted while the tab was open).
 */
async function withFallback<T>(operation: (transport: Transport) => Promise<T>): Promise<T> {
  const transport = await ensureTransport()
  try {
    return await operation(transport)
  } catch (error) {
    const apiError = toApiError(error)
    const canFallBack =
      apiConfig.mode === 'auto' &&
      apiConfig.mockFallbackEnabled &&
      apiError.isConnectivity &&
      activeTransport.name === 'live'

    if (!canFallBack) throw apiError

    activeTransport = mock
    setMode('mock', { state: 'degraded', latencyMs: null, version: 'mock-1.0.0' })
    return operation(mock)
  }
}

/* ── Endpoints ──────────────────────────────────────────────── */

export const wattwiseApi = {
  /** Connectivity + mode report. Safe to call repeatedly. */
  async health(force = false): Promise<HealthReport> {
    if (force) {
      resolved = apiConfig.mode === 'mock'
      activeTransport = apiConfig.mode === 'mock' ? mock : live
      invalidate()
    }
    if (resolved && !force) return healthReport
    try {
      await ensureTransport()
      return healthReport
    } catch (error) {
      return {
        state: 'offline',
        latencyMs: null,
        mode: activeTransport.name,
        checkedAt: new Date().toISOString(),
      }
    }
  },

  async getBuildings(): Promise<Building[]> {
    return cached('buildings', TTL.buildings, () =>
      withFallback((transport) => transport.getBuildings()),
    )
  },

  async getDashboardSummary(params: SeriesParams): Promise<DashboardSummary> {
    return cached(seriesKey('dashboard', params), TTL.dashboard, () =>
      withFallback((transport) => transport.getDashboardSummary(params)),
    )
  },

  async getEnergySeries(params: SeriesParams): Promise<EnergySeries> {
    return cached(seriesKey('energy', params), TTL.energy, () =>
      withFallback((transport) => transport.getEnergySeries(params)),
    )
  },

  async getAnomalies(query: AnomalyQuery): Promise<AnomalyList> {
    return cached(anomalyKey(query), TTL.anomalies, () =>
      withFallback((transport) => transport.getAnomalies(query)),
    )
  },

  async getAnomaly(id: string): Promise<Anomaly> {
    return cached(`anomaly:${id}`, TTL.anomaly, () =>
      withFallback((transport) => transport.getAnomaly(id)),
    )
  },

  async getCostImpact(params: SeriesParams): Promise<CostImpact> {
    return cached(seriesKey('cost', params), TTL.cost, () =>
      withFallback((transport) => transport.getCostImpact(params)),
    )
  },

  async getInvestigation(id: string): Promise<Investigation> {
    return cached(`investigation:${id}`, TTL.investigation, () =>
      withFallback((transport) => transport.getInvestigation(id)),
    )
  },

  async uploadEnergy(file: File, options: UploadOptions): Promise<UploadJob> {
    invalidate('dashboard')
    invalidate('anomalies')
    return withFallback((transport) => transport.uploadEnergy(file, options))
  },

  async getUploadJob(jobId: string): Promise<UploadJob> {
    return withFallback((transport) => transport.getUploadJob(jobId))
  },

  /**
   * Realtime channel. Events are already normalised into `RealtimeEvent`
   * shapes by the transports; unknown payloads are ignored downstream.
   */
  subscribeRealtime(onEvent: (event: RealtimeEvent) => void, onStatus?: (status: string) => void): RealtimeSubscription {
    let subscription: RealtimeSubscription = { close: () => undefined }
    let cancelled = false

    ensureTransport()
      .then((transport) => {
        if (cancelled) return
        subscription = transport.subscribe({
          onEvent: (event) => onEvent(event as RealtimeEvent),
          onStatusChange: (status) => onStatus?.(status),
        })
      })
      .catch((error) => onStatus?.(toApiError(error).kind))

    return {
      close: () => {
        cancelled = true
        subscription.close()
      },
    }
  },
}

/* ── Introspection helpers (Settings page, diagnostics) ─────── */

export function getHealthReport(): HealthReport {
  return healthReport
}

export function getActiveMode(): 'live' | 'mock' {
  return activeTransport.name
}

export function onModeChange(listener: (mode: 'live' | 'mock', report: HealthReport) => void): () => void {
  modeListeners.add(listener)
  return () => {
    modeListeners.delete(listener)
  }
}

/** Anomalies seen via realtime before the next list refetch. */
export function getRealtimeAnomalyRegistry(): Anomaly[] {
  const entry = cache.get('anomalyRegistry')
  return entry ? (entry.value as Anomaly[]) : []
}

/** Turn an unknown realtime payload into a notification, when applicable. */
export function notificationFromEvent(event: RealtimeEvent): Notification | null {
  if (event.type === 'anomaly.detected') {
    const anomaly = event.payload
    return {
      id: `notification_${anomaly.id}`,
      kind: 'anomaly',
      title: `${anomaly.reference} detected`,
      body: `${anomaly.excessKwh.toFixed(1)} kWh above the learned baseline — estimated excess cost pending tariff update.`,
      severity: anomaly.severity,
      createdAt: event.at,
      read: false,
      href: `/anomalies?focus=${anomaly.id}`,
      anomalyId: anomaly.id,
    }
  }
  if (event.type === 'model.status') {
    if (event.payload.state === 'ready') return null
    return {
      id: `notification_model_${event.at}`,
      kind: 'model',
      title: `Baseline model ${event.payload.state}`,
      body: event.payload.message || 'The baseline model state changed.',
      severity: event.payload.state === 'degraded' ? 'medium' : 'high',
      createdAt: event.at,
      read: false,
      href: '/settings',
    }
  }
  if (event.type === 'data.status') {
    if (event.payload.state === 'ok') return null
    return {
      id: `notification_data_${event.at}`,
      kind: 'data',
      title: `Meter feed ${event.payload.state}`,
      body: event.payload.message || 'Data ingestion state changed.',
      severity: event.payload.state === 'missing' ? 'high' : 'medium',
      createdAt: event.at,
      read: false,
      href: '/settings',
    }
  }
  return null
}

export { ApiError, apiConfig }
export type { SeriesParams, UploadOptions }
