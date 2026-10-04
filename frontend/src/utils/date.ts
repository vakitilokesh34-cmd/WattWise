import type { DateRange, RangePreset } from '@/types'

export const RANGE_PRESETS: RangePreset[] = [
  { key: 'shift', label: 'Last 8h', hours: 8 },
  { key: 'day', label: 'Today', hours: 24 },
  { key: '3d', label: '3 days', hours: 72 },
  { key: '7d', label: '7 days', hours: 168 },
  { key: '30d', label: '30 days', hours: 720 },
]

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export function nowIso(): string {
  return new Date().toISOString()
}

export function toIso(value: Date | number | string): string {
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? nowIso() : d.toISOString()
}

/** Build a range ending now. */
export function rangeFromNow(hours: number, end: Date = new Date()): DateRange {
  const to = new Date(end.getTime())
  const from = new Date(to.getTime() - hours * HOUR)
  return { from: from.toISOString(), to: to.toISOString(), label: '' }
}

export function presetToRange(preset: RangePreset, end: Date = new Date()): DateRange {
  const range = rangeFromNow(preset.hours, end)
  return { ...range, label: preset.label }
}

export function customRange(from: Date | string, to: Date | string): DateRange {
  return { from: toIso(from), to: toIso(to), label: 'Custom range' }
}

/** "22:00 – 00:00" (crosses midnight correctly). */
export function formatTimeRange(start: string, end: string, withMeridiem = true): string {
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—'
  const opts: Intl.DateTimeFormatOptions = withMeridiem
    ? { hour: '2-digit', minute: '2-digit', hour12: true }
    : { hour: '2-digit', minute: '2-digit', hour12: false }
  return `${s.toLocaleTimeString(DEFAULT_LOCALE, opts)} – ${e.toLocaleTimeString(DEFAULT_LOCALE, opts)}`
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString(DEFAULT_LOCALE, { hour: '2-digit', minute: '2-digit', hour12: true })
}

export function formatHour(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString(DEFAULT_LOCALE, { hour: '2-digit', hour12: true })
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(DEFAULT_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${formatDate(iso)} · ${formatTime(iso)}`
}

export function formatShortDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(DEFAULT_LOCALE, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'never'
  const diff = Date.now() - d.getTime()
  const abs = Math.abs(diff)
  const future = diff < 0
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [DAY, 'day'],
    [HOUR, 'hour'],
    [MINUTE, 'minute'],
  ]
  for (const [ms, unit] of units) {
    if (abs >= ms) {
      const value = Math.round(abs / ms)
      return new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: 'auto' }).format(
        future ? value : -value,
        unit,
      )
    }
  }
  return 'just now'
}

export function formatDuration(startIso: string, endIso: string): string {
  const s = new Date(startIso).getTime()
  const e = new Date(endIso).getTime()
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return '—'
  const mins = Math.round((e - s) / MINUTE)
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  if (hours < 24) return rest ? `${hours}h ${rest}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

export function toDateInputValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromDateInputValue(value: string, endOfDay = false): string {
  if (!value) return nowIso()
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return nowIso()
  const date = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0)
  return date.toISOString()
}

export function isSameDay(a: string, b: string): boolean {
  const da = new Date(a)
  const db = new Date(b)
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

export function dayKey(iso: string): string {
  return toDateInputValue(iso)
}

const DEFAULT_LOCALE = 'en-IN'
