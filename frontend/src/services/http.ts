import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { apiConfig } from './config'

/* ─────────────────────────────────────────────────────────────
   Normalised error type — every UI surface catches this shape.
   ───────────────────────────────────────────────────────────── */

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'canceled'
  | 'not_found'
  | 'validation'
  | 'server'
  | 'unknown'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly url: string | null
  readonly details: unknown

  constructor(params: {
    message: string
    kind: ApiErrorKind
    status?: number | null
    url?: string | null
    details?: unknown
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.kind = params.kind
    this.status = params.status ?? null
    this.url = params.url ?? null
    this.details = params.details ?? null
  }

  /** True when the failure is plausibly a backend outage (mock fallback candidate). */
  get isConnectivity(): boolean {
    return this.kind === 'network' || this.kind === 'timeout'
  }
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 404) return 'not_found'
  if (status === 400 || status === 422) return 'validation'
  if (status >= 500) return 'server'
  return 'unknown'
}

function normalise(error: unknown, config?: AxiosRequestConfig): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isCancel(error) || (error as AxiosError)?.code === 'ERR_CANCELED') {
    return new ApiError({
      message: 'Request cancelled.',
      kind: 'canceled',
      url: config?.url ?? null,
    })
  }

  const axiosError = error as AxiosError<{ message?: string; detail?: string; errors?: unknown }>

  if (axiosError?.code === 'ECONNABORTED' || axiosError?.code === 'ETIMEDOUT') {
    return new ApiError({
      message: 'The request timed out. The energy service may be slow or unreachable.',
      kind: 'timeout',
      url: config?.url ?? null,
    })
  }

  if (axiosError?.response) {
    const status = axiosError.response.status
    const body = axiosError.response.data
    const serverMessage =
      (typeof body === 'object' && body !== null && ('message' in body || 'detail' in body)
        ? String((body as { message?: string; detail?: string }).message ??
            (body as { detail?: string }).detail)
        : '') || `Request failed with status ${status}.`

    return new ApiError({
      message: serverMessage,
      kind: kindForStatus(status),
      status,
      url: config?.url ?? null,
      details: (body as { errors?: unknown })?.errors ?? body ?? null,
    })
  }

  if (axiosError?.request) {
    return new ApiError({
      message:
        'Cannot reach the WattWise energy service. Check that the backend is running and that VITE_API_BASE_URL is correct.',
      kind: 'network',
      url: config?.url ?? null,
    })
  }

  return new ApiError({
    message: axiosError?.message || 'Unexpected error while talking to the energy service.',
    kind: 'unknown',
    url: config?.url ?? null,
  })
}

/* ─────────────────────────────────────────────────────────────
   Axios instance
   ───────────────────────────────────────────────────────────── */

export const httpClient: AxiosInstance = axios.create({
  baseURL: apiConfig.baseUrl,
  timeout: apiConfig.timeoutMs,
  headers: {
    Accept: 'application/json',
  },
  // 204/205 must not be treated as errors for DELETE-style calls.
  validateStatus: (status) => status >= 200 && status < 300,
})

httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Auth hook point — the backend team can replace this with a token store.
  const token = readToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  config.headers.set('X-Client', 'wattwise-web')
  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalise(error, error?.config)),
)

function readToken(): string | null {
  try {
    return window.localStorage.getItem('wattwise.token')
  } catch {
    return null
  }
}

/** Convenience wrapper: unwraps `data` and converts failures to `ApiError`. */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await httpClient.request<T>(config)
    return response.data
  } catch (error) {
    throw normalise(error, config)
  }
}

export function toApiError(error: unknown): ApiError {
  return normalise(error)
}

/**
 * SSE cannot use axios, but it should share the same base URL resolution so
 * the dev proxy behaves identically.
 */
export function realtimeUrl(): string {
  const base = apiConfig.baseUrl
  const path = apiConfig.realtime.ssePath.startsWith('/') ? apiConfig.realtime.ssePath : `/${apiConfig.realtime.ssePath}`
  if (base.startsWith('http')) {
    return `${base}${path}`
  }
  // Relative base → resolve against the current origin for EventSource.
  return `${window.location.origin}${base}${path}`
}

export function logout(): void {
  try {
    window.localStorage.removeItem('wattwise.token')
  } catch {
    /* noop */
  }
}
