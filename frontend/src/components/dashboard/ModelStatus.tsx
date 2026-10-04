import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BrainCircuit, ChevronDown, CircleSlash } from 'lucide-react'
import type { ModelStatus as ModelStatusData } from '@/types'
import { cn } from '@/utils/cn'
import { formatPercent } from '@/utils/format'
import { formatRelative } from '@/utils/date'
import { Tooltip } from '@/components/ui/Tooltip'

const STATE_META = {
  ready: { label: 'Model ready', dot: 'bg-watt-400', text: 'text-watt-300', border: 'border-watt-400/25', bg: 'bg-watt-400/10' },
  training: { label: 'Training', dot: 'bg-flux-400', text: 'text-flux-300', border: 'border-flux-400/25', bg: 'bg-flux-400/10' },
  degraded: { label: 'Degraded', dot: 'bg-alert-400', text: 'text-alert-300', border: 'border-alert-500/30', bg: 'bg-alert-500/10' },
  unavailable: { label: 'Unavailable', dot: 'bg-crit-400', text: 'text-crit-300', border: 'border-crit-500/30', bg: 'bg-crit-500/10' },
} as const

export function stateMeta(state: ModelStatusData['state']) {
  return STATE_META[state] ?? STATE_META.unavailable
}

/**
 * Baseline-model status indicator. Every value shown is reported by the
 * backend — nothing is inferred on the client.
 */
export function ModelStatus({
  status,
  className,
  compact = false,
}: {
  status: ModelStatusData | undefined
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

  const meta = stateMeta(status.state)

  if (compact) {
    return (
      <Tooltip content={`Baseline model: ${meta.label} · v${status.version}`}>
        <span
          className={cn(
            'flex h-9 items-center gap-2 rounded-xl border px-2.5',
            meta.border,
            meta.bg,
            meta.text,
            className,
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot, status.state === 'ready' && 'animate-pulse')} />
          <span className="text-2xs font-semibold uppercase tracking-[0.1em]">{meta.label}</span>
        </span>
      </Tooltip>
    )
  }

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Baseline model status"
        className={cn(
          'flex h-10 w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left transition duration-200',
          meta.border,
          meta.bg,
          'hover:brightness-125',
        )}
      >
        <BrainCircuit size={14} className={cn('shrink-0', meta.text)} />
        <span className="min-w-0 flex-1">
          <span className="block text-2xs font-medium uppercase tracking-[0.14em] text-ink-500">
            Model
          </span>
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
              <h4 className="text-xs font-semibold text-ink-50">Baseline model</h4>
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
              <Row label="Version" value={status.version} />
              <Row label="Last trained" value={formatRelative(status.trainedAt)} />
              <Row label="Reported accuracy" value={formatPercent(status.accuracy)} />
              <Row label="Baseline method" value={status.baselineMethod} />
            </dl>

            {status.message ? (
              <p className="mt-3 border-t border-white/[0.06] pt-3 text-2xs leading-relaxed text-ink-400">
                {status.message}
              </p>
            ) : null}

            <p className="mt-3 flex items-start gap-1.5 text-2xs leading-relaxed text-ink-500">
              <CircleSlash size={11} className="mt-0.5 shrink-0" />
              Anomaly scores and baselines are produced by the backend model. WattWise only renders them.
            </p>
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
