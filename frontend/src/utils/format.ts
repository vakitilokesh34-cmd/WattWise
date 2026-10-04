import type { Severity } from '@/types'

const DEFAULT_LOCALE = 'en-IN'

/** 1,240 */
export function formatNumber(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

/** ₹1,280 — currency is supplied by the API, never hard-coded. */
export function formatCurrency(
  value: number | null | undefined,
  currency = 'INR',
  opts: { compact?: boolean; fractionDigits?: number } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const { compact = false, fractionDigits } = opts
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency: currency || 'INR',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: fractionDigits ?? (compact ? 1 : 0),
    minimumFractionDigits: fractionDigits ?? 0,
  }).format(value)
}

/** 1,240 kWh */
export function formatEnergy(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${formatNumber(value, fractionDigits)} kWh`
}

/** 0.91 */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value.toFixed(2)
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toFixed(fractionDigits)}%`
}

/** 25 MB */
export function formatBytes(bytes: number | null | undefined, fractionDigits = 1): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(fractionDigits)} ${units[unit]}`
}

/** +12.4% */
export function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export function severityFromScore(score: number): Severity {
  if (score >= 0.9) return 'critical'
  if (score >= 0.75) return 'high'
  if (score >= 0.6) return 'medium'
  return 'low'
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

/** Tailwind class bundles per severity, kept in one place for consistency. */
export const SEVERITY_STYLES: Record<
  Severity,
  { text: string; bg: string; border: string; ring: string; dot: string; glow: string }
> = {
  critical: {
    text: 'text-crit-300',
    bg: 'bg-crit-500/10',
    border: 'border-crit-500/35',
    ring: 'ring-crit-500/25',
    dot: 'bg-crit-400',
    glow: 'shadow-glow-crit',
  },
  high: {
    text: 'text-crit-300',
    bg: 'bg-crit-500/10',
    border: 'border-crit-400/30',
    ring: 'ring-crit-500/20',
    dot: 'bg-crit-400',
    glow: 'shadow-glow-crit',
  },
  medium: {
    text: 'text-alert-300',
    bg: 'bg-alert-500/10',
    border: 'border-alert-500/30',
    ring: 'ring-alert-500/20',
    dot: 'bg-alert-400',
    glow: 'shadow-glow-alert',
  },
  low: {
    text: 'text-flux-300',
    bg: 'bg-flux-500/10',
    border: 'border-flux-500/30',
    ring: 'ring-flux-500/20',
    dot: 'bg-flux-400',
    glow: 'shadow-glow-flux',
  },
}

export const FACTOR_CATEGORY_LABEL: Record<string, string> = {
  hvac: 'HVAC',
  lighting: 'Lighting',
  equipment: 'Equipment',
  operation: 'Building operation',
  occupancy: 'Occupancy',
  data: 'Meter / data',
}
