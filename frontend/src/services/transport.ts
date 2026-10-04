import type {
  Anomaly,
  AnomalyList,
  AnomalyQuery,
  Building,
  CostImpact,
  DashboardSummary,
  EnergySeries,
  Investigation,
  UploadJob,
} from '@/types'

export interface SeriesParams {
  buildingId: string
  from: string
  to: string
  /** Optional aggregation hint; the backend may override it. */
  intervalMinutes?: number
}

export interface UploadOptions {
  buildingId: string
  /** Column mapping discovered from the CSV header row, when the user mapped it. */
  columnMapping?: Record<string, string>
  notes?: string
}

export interface TransportHealth {
  online: boolean
  version?: string
  latencyMs: number
}

export interface RealtimeHandlers {
  onEvent: (event: unknown) => void
  onStatusChange?: (status: 'connecting' | 'open' | 'closed' | 'error') => void
  onFallbackAnomaly?: () => void
}

export interface RealtimeSubscription {
  close: () => void
}

/**
 * Everything the UI is allowed to ask the "backend" for.
 *
 * `LiveTransport` implements it with Axios against the real service.
 * `MockTransport` implements the same contract with deterministic synthetic
 * data so the UI is fully explorable offline. UI components only ever import
 * `wattwiseApi` from `services/api.ts`, never a transport directly.
 */
export interface Transport {
  readonly name: 'live' | 'mock'

  health(): Promise<TransportHealth>

  getBuildings(): Promise<Building[]>

  getDashboardSummary(params: SeriesParams): Promise<DashboardSummary>

  getEnergySeries(params: SeriesParams): Promise<EnergySeries>

  getAnomalies(query: AnomalyQuery): Promise<AnomalyList>

  getAnomaly(id: string): Promise<Anomaly>

  getCostImpact(params: SeriesParams): Promise<CostImpact>

  getInvestigation(id: string): Promise<Investigation>

  uploadEnergy(file: File, options: UploadOptions): Promise<UploadJob>

  getUploadJob(jobId: string): Promise<UploadJob>

  subscribe(handlers: RealtimeHandlers): RealtimeSubscription
}
