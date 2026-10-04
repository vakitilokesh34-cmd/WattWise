import { apiConfig } from './config'
import { ApiError, httpClient, realtimeUrl, request, toApiError } from './http'
import {
  buildAnomalyParams,
  mapAnomaly,
  mapAnomalyList,
  mapBuildings,
  mapBuilding,
  mapCostImpact,
  mapDashboardSummary,
  mapEnergySeries,
  mapInvestigation,
  mapUploadJob,
} from './mappers'
import { asDict, asString, pick, unwrap } from './normalize'
import type {
  RealtimeSubscription,
  SeriesParams,
  Transport,
  TransportHealth,
  UploadOptions,
} from './transport'
import type { AnomalyQuery } from '@/types'

/**
 * Production transport — talks to the WattWise backend over Axios.
 *
 * Endpoint map (all prefixed by VITE_API_BASE_URL):
 *   GET  /dashboard/summary
 *   GET  /energy
 *   GET  /anomalies
 *   GET  /anomalies/{id}
 *   GET  /cost-impact
 *   GET  /anomalies/{id}/investigation
 *   POST /energy/upload
 *
 * "Extended" endpoints below are optional. When a backend omits them we degrade
 * gracefully instead of failing the page.
 */
export class LiveTransport implements Transport {
  readonly name = 'live' as const

  async health(): Promise<TransportHealth> {
    const started = performance.now()
    const candidates = ['/health', '/healthz', '/status', '/dashboard/summary']
    let lastError: ApiError | null = null
    for (const path of candidates) {
      try {
        const data = await request<unknown>({ method: 'GET', url: path, timeout: 4000 })
        return {
          online: true,
          latencyMs: Math.round(performance.now() - started),
          version: readVersion(data),
        }
      } catch (error) {
        lastError = toApiError(error)
        // 404 on a probe endpoint just means "not implemented here" — keep trying.
        if (lastError.kind === 'validation' || (lastError.status ?? 0) >= 500) break
      }
    }
    throw lastError ?? new ApiError({ message: 'Energy service unreachable.', kind: 'network' })
  }

  async getBuildings() {
    const data = await request<unknown>({ method: 'GET', url: '/buildings' })
    return mapBuildings(data)
  }

  async getDashboardSummary(params: SeriesParams) {
    const data = await request<unknown>({
      method: 'GET',
      url: '/dashboard/summary',
      params: { building_id: params.buildingId, from: params.from, to: params.to },
    })
    return mapDashboardSummary(data, {
      buildingId: params.buildingId,
      currency: 'INR',
      intervalMinutes: params.intervalMinutes ?? 15,
    })
  }

  async getEnergySeries(params: SeriesParams) {
    const data = await request<unknown>({
      method: 'GET',
      url: '/energy',
      params: {
        building_id: params.buildingId,
        from: params.from,
        to: params.to,
        ...(params.intervalMinutes ? { interval_minutes: params.intervalMinutes } : {}),
      },
    })
    return mapEnergySeries(data, params)
  }

  async getAnomalies(query: AnomalyQuery) {
    const data = await request<unknown>({
      method: 'GET',
      url: '/anomalies',
      params: buildAnomalyParams(query),
    })
    return mapAnomalyList(data, 1, 100)
  }

  async getAnomaly(id: string) {
    const data = await request<unknown>({ method: 'GET', url: `/anomalies/${encodeURIComponent(id)}` })
    return mapAnomaly(data)
  }

  async getCostImpact(params: SeriesParams) {
    const data = await request<unknown>({
      method: 'GET',
      url: '/cost-impact',
      params: { building_id: params.buildingId, from: params.from, to: params.to },
    })
    return mapCostImpact(data, { buildingId: params.buildingId, currency: 'INR' })
  }

  async getInvestigation(id: string) {
    const data = await request<unknown>({
      method: 'GET',
      url: `/anomalies/${encodeURIComponent(id)}/investigation`,
    })
    const anomaly = await this.getAnomaly(id).catch(() => undefined)
    return mapInvestigation(data, anomaly ?? fallbackAnomaly(id))
  }

  async uploadEnergy(file: File, options: UploadOptions) {
    const form = new FormData()
    form.append('file', file)
    form.append('building_id', options.buildingId)
    if (options.columnMapping) form.append('column_mapping', JSON.stringify(options.columnMapping))
    if (options.notes) form.append('notes', options.notes)

    const data = await request<unknown>({
      method: 'POST',
      url: '/energy/upload',
      data: form,
      headers: { 'Content-Type': undefined },
      timeout: Math.max(apiConfig.timeoutMs, 60_000),
    })
    return mapUploadJob(data, options.buildingId)
  }

  /** Optional: many backends accept the same multipart body as JSON. */
  async getUploadJob(jobId: string) {
    const data = await request<unknown>({
      method: 'GET',
      url: `/energy/upload/${encodeURIComponent(jobId)}`,
    })
    return mapUploadJob(data)
  }

  subscribe(handlers: {
    onEvent: (event: unknown) => void
    onStatusChange?: (status: 'connecting' | 'open' | 'closed' | 'error') => void
  }): RealtimeSubscription {
    if (!apiConfig.realtime.enabled || apiConfig.realtime.transport === 'off') {
      return { close: () => undefined }
    }

    if (apiConfig.realtime.transport === 'polling' || typeof window === 'undefined' || !('EventSource' in window)) {
      return startPolling(handlers)
    }

    let source: EventSource | null = null
    let closed = false
    let pollHandle: number | null = null
    let retry = 0

    handlers.onStatusChange?.('connecting')

    const startPollingBackup = () => {
      if (pollHandle !== null || closed) return
      pollHandle = window.setInterval(() => {
        // Low-frequency summary refresh keeps the UI warm when SSE is blocked
        // by a proxy. The payload is a plain summary snapshot.
        httpClient
          .get('/dashboard/summary')
          .then((res) => handlers.onEvent({ type: 'summary.snapshot', payload: res.data }))
          .catch(() => undefined)
      }, apiConfig.realtime.pollMs)
    }

    const connect = () => {
      if (closed) return
      try {
        source = new EventSource(realtimeUrl())
      } catch {
        startPollingBackup()
        return
      }

      source.onopen = () => {
        retry = 0
        handlers.onStatusChange?.('open')
      }

      source.onmessage = (message) => {
        try {
          handlers.onEvent(JSON.parse(message.data))
        } catch {
          handlers.onEvent({ type: 'raw', payload: message.data })
        }
      }

      // Named events, if the backend uses them.
      const named = [
        'anomaly.detected',
        'anomaly',
        'reading.updated',
        'reading',
        'model.status',
        'data.status',
        'job.progress',
        'ping',
      ]
      named.forEach((name) => {
        source?.addEventListener(name, (event) => {
          const data = (event as MessageEvent).data
          try {
            handlers.onEvent(JSON.parse(data))
          } catch {
            handlers.onEvent({ type: name, payload: data })
          }
        })
      })

      source.onerror = () => {
        handlers.onStatusChange?.('error')
        source?.close()
        source = null
        if (closed) return
        retry += 1
        if (retry > 4) {
          startPollingBackup()
          return
        }
        window.setTimeout(connect, Math.min(1000 * 2 ** retry, 15_000))
      }
    }

    connect()

    return {
      close: () => {
        closed = true
        source?.close()
        if (pollHandle !== null) window.clearInterval(pollHandle)
      },
    }
  }
}

function startPolling(handlers: {
  onEvent: (event: unknown) => void
  onStatusChange?: (status: 'connecting' | 'open' | 'closed' | 'error') => void
}): RealtimeSubscription {
  handlers.onStatusChange?.('open')
  const handle = window.setInterval(() => {
    httpClient
      .get('/dashboard/summary')
      .then((res) => handlers.onEvent({ type: 'summary.snapshot', payload: res.data }))
      .catch(() => handlers.onStatusChange?.('error'))
  }, apiConfig.realtime.pollMs)
  return { close: () => window.clearInterval(handle) }
}

function readVersion(data: unknown): string | undefined {
  const d = asDict(unwrap(data))
  const value = pick(d, 'version', 'api_version', 'service_version')
  return value ? asString(value) : undefined
}

function fallbackAnomaly(id: string) {
  const now = new Date().toISOString()
  return {
    id,
    reference: id,
    buildingId: 'unknown',
    start: now,
    end: now,
    expectedKwh: 0,
    actualKwh: 0,
    excessKwh: 0,
    estimatedCost: 0,
    score: 0,
    severity: 'low' as const,
    floorId: null,
    floorLabel: null,
    status: 'new' as const,
    detectedAt: now,
  }
}

export { mapBuilding }
