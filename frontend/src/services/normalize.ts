/**
 * Defensive response normalisers.
 *
 * The UI depends on stable, fully-populated objects. Rather than sprinkling
 * optional chaining through every component, each endpoint response is passed
 * through these helpers once, at the transport boundary. If the backend tweaks
 * a field name, this file is the only thing that needs updating.
 */

type Dict = Record<string, unknown>

export function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Unwrap `{ data: {...} }` / `{ result: {...} }` envelopes. */
export function unwrap(payload: unknown): unknown {
  if (!isDict(payload)) return payload
  for (const key of ['data', 'result', 'payload']) {
    if (key in payload && payload[key] !== null && payload[key] !== undefined) {
      return payload[key]
    }
  }
  return payload
}

export function asDict(value: unknown, fallback: Dict = {}): Dict {
  return isDict(value) ? value : fallback
}

export function asArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (isDict(value)) {
    // Common list envelopes: { items: [] }, { results: [] }, { data: [] }, { anomalies: [] }
    for (const key of ['items', 'results', 'records', 'rows', 'data', 'anomalies', 'points', 'list']) {
      const candidate = value[key]
      if (Array.isArray(candidate)) return candidate as T[]
    }
  }
  return []
}

export function pick(source: Dict, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key]
  }
  return undefined
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = asNumber(value, Number.NaN)
  return Number.isFinite(parsed) ? parsed : null
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return fallback
}

export function asIso(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString()
  }
  return fallback
}

export function asNullableIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const iso = asIso(value, '')
  return iso || null
}

export function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof value === 'string') {
    const lowered = value.toLowerCase() as T
    if (allowed.includes(lowered)) return lowered
  }
  return fallback
}
