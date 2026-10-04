import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarRange, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'
import { RANGE_PRESETS, formatDateTime, fromDateInputValue, toDateInputValue } from '@/utils/date'
import { useWorkspace } from '@/context/WorkspaceContext'

/**
 * Preset + custom date-range control. Emits through the workspace so every page
 * refetches against the same window.
 */
export function DateRangeSelector({ className }: { className?: string }) {
  const { range, rangePresetKey, setRangePreset, setCustomRange } = useWorkspace()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const [fromValue, setFromValue] = useState(() => toDateInputValue(range.from))
  const [toValue, setToValue] = useState(() => toDateInputValue(range.to))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFromValue(toDateInputValue(range.from))
    setToValue(toDateInputValue(range.to))
  }, [range.from, range.to])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const activePreset = RANGE_PRESETS.find((p) => p.key === rangePresetKey)
  const triggerLabel = activePreset ? activePreset.label : 'Custom range'

  const applyCustom = () => {
    if (!fromValue || !toValue) {
      setError('Select both a start and end date.')
      return
    }
    const from = new Date(fromDateInputValue(fromValue, false))
    const to = new Date(fromDateInputValue(toValue, true))
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      setError('Those dates could not be parsed.')
      return
    }
    if (from.getTime() >= to.getTime()) {
      setError('Start date must be before end date.')
      return
    }
    setError(null)
    setCustomRange(from, to)
    setOpen(false)
  }

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Select date range"
        className={cn(
          'flex h-10 w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left transition duration-200',
          open
            ? 'border-flux-400/40 bg-flux-500/[0.08]'
            : 'border-white/[0.08] bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]',
        )}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-ink-300">
          <CalendarRange size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-2xs font-medium uppercase tracking-[0.14em] text-ink-500">
            Period
          </span>
          <span className="block truncate text-xs font-semibold text-ink-50">{triggerLabel}</span>
        </span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-ink-500 transition duration-200', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(21rem,calc(100vw-2rem))] rounded-2xl p-3"
          >
            <p className="label-muted mb-2 px-1">Quick range</p>
            <div className="grid grid-cols-3 gap-1.5">
              {RANGE_PRESETS.map((preset) => {
                const active = rangePresetKey === preset.key
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => {
                      setRangePreset(preset.key)
                      setError(null)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex h-8 items-center justify-center gap-1 rounded-lg border text-2xs font-medium transition',
                      active
                        ? 'border-flux-400/40 bg-flux-500/12 text-flux-200'
                        : 'border-white/[0.07] bg-white/[0.025] text-ink-300 hover:border-white/20 hover:text-ink-50',
                    )}
                  >
                    {active ? <Check size={11} /> : null}
                    {preset.label}
                  </button>
                )
              })}
            </div>

            <div className="divider my-3" />

            <p className="label-muted mb-2 px-1">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-2xs text-ink-500">From</span>
                <input
                  type="date"
                  value={fromValue}
                  max={toValue || undefined}
                  onChange={(event) => {
                    setFromValue(event.target.value)
                    setError(null)
                  }}
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 text-2xs text-ink-100 focus:border-flux-400/40 focus:outline-none [color-scheme:dark]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-2xs text-ink-500">To</span>
                <input
                  type="date"
                  value={toValue}
                  min={fromValue || undefined}
                  onChange={(event) => {
                    setToValue(event.target.value)
                    setError(null)
                  }}
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 text-2xs text-ink-100 focus:border-flux-400/40 focus:outline-none [color-scheme:dark]"
                />
              </label>
            </div>

            {error ? <p className="mt-2 text-2xs text-crit-300">{error}</p> : null}

            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-2xs text-ink-500">
                {formatDateTime(range.from)} → {formatDateTime(range.to)}
              </p>
              <button
                type="button"
                onClick={applyCustom}
                className="h-8 shrink-0 rounded-lg border border-flux-400/35 bg-flux-500/12 px-3 text-2xs font-semibold text-flux-200 transition hover:bg-flux-500/20"
              >
                Apply
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
