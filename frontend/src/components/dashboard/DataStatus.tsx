import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, ChevronDown, Database } from 'lucide-react'
import type { DataStatus as DataStatusData } from '@/types'
import { cn } from '@/utils/cn'
import { formatPercent } from '@/utils/format'
import { formatRelative } from '@/utils/date'

const STATE_META = {
  ok: { label: 'Data current', dot: 'bg-watt-400', text: 'text-watt-300', border: 'border-watt-400/25', bg: 'bg-watt-400/10' },
  delayed: { label: 'Data delayed', dot: 'bg-alert-400', text: 'text-alert-300', border: 'border-alert-500/30', bg: 'bg-alert-500/10' },
  stale: { label: 'Data stale', dot: 'bg-alert-400', text: 'text-alert-300', border: 'border-alert-500/30', bg: 'bg-alert-500/10' },
  missing: { label: 'No data', dot: 'bg-crit-400', text: 'text-crit-300', border: 'border-crit-500/30', bg: 'bg-crit-500/10' },
  processing: { label: 'Processing', dot: 'bg-flux-400', text: 'text-flux-300', border: 'border-flux-400/25', bg: 'bg-flux-400/10' },
} as const

export function dataStateMeta(state: DataStatusData['state']) {
  return STATE_META[state] ?? STATE_META.missing
}

/** Ingestion-pipeline health. Values are reported by the backend. */
export function DataStatusIndicator({
  status,
  className,
  compact = false,
}: {
  status: DataStatusData | undefined
  className?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  if (!status) {
    return (
      <div
        className={cn(
          'flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3',
          className,
        )}
      >
        <span className="skeleton h-3 w-20" />
      </div>
    )
  }

  const meta = dataStateMeta(status.state)

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-xl border px-2.5',
          meta.border,
          meta.bg,
          meta.text,
          className,
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot, status.state === 'ok' && 'animate-pulse')} />
        <span className="text-2xs font-semibold uppercase tracking-[0.1em]">{meta.label}</span>
      </span>
    )
  }

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Data pipeline status"
        className={cn(
          'flex h-10 w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left transition duration-200 hover:brightness-125',
          meta.border,
          meta.bg,
        )}
      >
        <Database size={14} className={cn('shrink-0', meta.text)} />
        <span className="min-w-0 flex-1">
          <span className="block text-2xs font-medium uppercase tracking-[0.14em] text-ink-500">Data</span>
          <span className={cn('block truncate text-xs font-semibold', meta.text)}>{meta.label}</span>
        </span>
        <ChevronDown size={13} className={cn('shrink-0 text-ink-500 transition', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-xs font-semibold text-ink-50">
                <Activity size={13} className="text-flux-300" />
                Ingestion pipeline
              </h4>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.1em]',
                  meta.border,
                  meta.bg,
                  meta.text,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                {meta.label}
              </span>
            </div>

            <dl className="mt-3 space-y-2">
              <Row label="Last reading" value={formatRelative(status.lastReadingAt)} />
              <Row label="Interval" value={`${status.intervalMinutes} min`} />
              <Row label="Coverage" value={formatPercent(status.coveragePercent)} />
            </dl>

            {status.message ? (
              <p className="mt-3 border-t border-white/[0.06] pt-3 text-2xs leading-relaxed text-ink-400">
                {status.message}
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-2xs font-medium uppercase tracking-[0.12em] text-ink-500">{label}</dt>
      <dd className="tnum max-w-[60%] text-right text-2xs font-medium text-ink-100">{value}</dd>
    </div>
  )
}
