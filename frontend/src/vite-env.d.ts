/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_PROXY_TARGET?: string
  readonly VITE_API_TIMEOUT?: string
  readonly VITE_API_MODE?: 'live' | 'mock' | 'auto' | string
  readonly VITE_ENABLE_MOCK_FALLBACK?: string
  readonly VITE_ENABLE_REALTIME?: string
  readonly VITE_REALTIME_TRANSPORT?: 'sse' | 'polling' | 'off' | string
  readonly VITE_REALTIME_SSE_PATH?: string
  readonly VITE_REALTIME_POLL_MS?: string
  readonly VITE_UPLOAD_MAX_MB?: string
  readonly VITE_UPLOAD_ACCEPT?: string
  readonly VITE_SCENE_QUALITY?: 'auto' | 'high' | 'medium' | 'low' | string
  readonly VITE_MAX_PARTICLES?: string
  readonly VITE_ENABLE_3D?: string
  readonly VITE_ENABLE_ANIMATIONS?: string
  readonly VITE_PORT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
