/**
 * Centralised, validated access to environment variables.
 *
 * Nothing else in the app reads `import.meta.env` directly, so configuration
 * mistakes surface in one place and can be reported in Settings.
 */

export type ApiMode = 'live' | 'mock' | 'auto'
export type RealtimeTransport = 'sse' | 'polling' | 'off'
export type SceneQuality = 'auto' | 'high' | 'medium' | 'low'

const env = import.meta.env

function str(key: keyof ImportMetaEnv, fallback: string): string {
  const value = env[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function num(key: keyof ImportMetaEnv, fallback: number): number {
  const raw = str(key, '')
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function bool(key: keyof ImportMetaEnv, fallback: boolean): boolean {
  const raw = str(key, '').toLowerCase()
  if (raw === 'true') return true
  if (raw === 'false') return false
  return fallback
}

function oneOf<T extends string>(key: keyof ImportMetaEnv, allowed: readonly T[], fallback: T): T {
  const raw = str(key, '').toLowerCase() as T
  return allowed.includes(raw) ? raw : fallback
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export const apiConfig = {
  /** Base URL every request is prefixed with, e.g. "/api" or "https://api.host/v1". */
  baseUrl: stripTrailingSlash(str('VITE_API_BASE_URL', '/api')),
  timeoutMs: num('VITE_API_TIMEOUT', 20_000),
  mode: oneOf<ApiMode>('VITE_API_MODE', ['live', 'mock', 'auto'] as const, 'auto'),
  mockFallbackEnabled: bool('VITE_ENABLE_MOCK_FALLBACK', true),

  realtime: {
    enabled: bool('VITE_ENABLE_REALTIME', true),
    transport: oneOf<RealtimeTransport>(
      'VITE_REALTIME_TRANSPORT',
      ['sse', 'polling', 'off'] as const,
      'sse',
    ),
    ssePath: str('VITE_REALTIME_SSE_PATH', '/realtime/stream'),
    pollMs: num('VITE_REALTIME_POLL_MS', 30_000),
  },

  upload: {
    maxMb: num('VITE_UPLOAD_MAX_MB', 25),
    accept: str('VITE_UPLOAD_ACCEPT', '.csv,text/csv'),
  },

  scene: {
    quality: oneOf<SceneQuality>(
      'VITE_SCENE_QUALITY',
      ['auto', 'high', 'medium', 'low'] as const,
      'auto',
    ),
    maxParticles: Math.round(num('VITE_MAX_PARTICLES', 260)),
    enabled: bool('VITE_ENABLE_3D', true),
    animationsEnabled: bool('VITE_ENABLE_ANIMATIONS', true),
  },
} as const

export type ApiConfig = typeof apiConfig

/** Non-secret config snapshot for the Settings page. */
export function describeConfig() {
  return {
    baseUrl: apiConfig.baseUrl,
    mode: apiConfig.mode,
    mockFallbackEnabled: apiConfig.mockFallbackEnabled,
    timeoutMs: apiConfig.timeoutMs,
    realtime: { ...apiConfig.realtime },
    upload: { ...apiConfig.upload },
    scene: { ...apiConfig.scene },
  }
}
