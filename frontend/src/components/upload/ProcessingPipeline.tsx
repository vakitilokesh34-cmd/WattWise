import { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Brain, CheckCircle2, CircleDashed, DollarSign, Loader2, Sparkles, UploadCloud, XCircle } from 'lucide-react'
import type { UploadJob, UploadStageKey } from '@/types'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import { ProgressBar } from '@/components/ui/DataDisplay'

const STAGE_META: Record<UploadStageKey, { icon: typeof UploadCloud; hint: string }> = {
  uploading: { icon: UploadCloud, hint: 'Streaming rows to the ingestion endpoint' },
  cleaning: { icon: Sparkles, hint: 'Deduplicating timestamps and imputing gaps' },
  learning: { icon: Brain, hint: 'Refitting the seasonal baseline profile' },
  detecting: { icon: CheckCircle2, hint: 'Scoring residuals against the anomaly threshold' },
  costing: { icon: DollarSign, hint: 'Applying the configured tariff to excess energy' },
  complete: { icon: CheckCircle2, hint: 'Baseline and anomaly results published' },
}

export interface ProcessingPipelineProps {
  job: UploadJob | undefined
  /** Stages before the server responds, shown optimistically. */
  stages?: UploadStageKey[]
  className?: string
}

/**
 * PROCESSING PIPELINE
 *
 * Uploading → Cleaning → Learning Baseline → Detecting Anomalies →
 * Calculating Cost → Complete
 *
 * Stage state always comes from the API job response; the local `stages` prop is
 * only used to render placeholders before the first poll resolves.
 */
function ProcessingPipelineComponent({ job, stages, className }: ProcessingPipelineProps) {
  const sourceStages =
    job?.stages && job.stages.length > 0
      ? job.stages
      : (stages ?? (['uploading'] as UploadStageKey[])).map((key) => ({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
          state: 'active' as const,
        }))

  return (
    <div className={cn('glass p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">Processing pipeline</h3>
          <p className="mt-0.5 text-xs text-ink-400">
            {job?.jobId ? `Job ${job.jobId}` : 'Waiting for the ingestion service…'}
          </p>
        </div>
        {job ? (
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.1em]',
              job.state === 'complete'
                ? 'border-watt-400/30 bg-watt-400/10 text-watt-300'
                : job.state === 'failed'
                  ? 'border-crit-500/30 bg-crit-500/10 text-crit-300'
                  : 'border-flux-500/30 bg-flux-500/10 text-flux-300',
            )}
          >
            {job.state}
          </span>
        ) : null}
      </div>

      {job ? (
        <div className="mt-4">
          <ProgressBar
            value={job.progress}
            tone={job.state === 'failed' ? 'crit' : job.state === 'complete' ? 'watt' : 'flux'}
          />
          <p className="tnum mt-1.5 text-2xs text-ink-500">{job.progress}% complete</p>
        </div>
      ) : null}

      <ol className="mt-5 space-y-1">
        {sourceStages.map((stage, index) => {
          const meta = STAGE_META[stage.key] ?? STAGE_META.complete
          const Icon = meta.icon
          const isDone = stage.state === 'done'
          const isActive = stage.state === 'active'
          const isFailed = stage.state === 'failed'
          const isPending = stage.state === 'pending'

          return (
            <motion.li
              key={stage.key}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="relative flex items-start gap-3 pb-4 last:pb-0"
            >
              {/* Connector */}
              {index < sourceStages.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-[13px] top-7 h-[calc(100%-1rem)] w-px transition-colors duration-500',
                    isDone ? 'bg-watt-400/35' : 'bg-white/[0.08]',
                  )}
                />
              ) : null}

              <span
                className={cn(
                  'relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition duration-300',
                  isDone && 'border-watt-400/35 bg-watt-400/10 text-watt-300',
                  isActive && 'border-flux-400/40 bg-flux-500/12 text-flux-300',
                  isFailed && 'border-crit-500/35 bg-crit-500/10 text-crit-300',
                  isPending && 'border-white/[0.08] bg-white/[0.02] text-ink-500',
                )}
              >
                {isDone ? (
                  <CheckCircle2 size={13} />
                ) : isFailed ? (
                  <XCircle size={13} />
                ) : isActive ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CircleDashed size={13} />
                )}
              </span>

              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      isDone
                        ? 'text-ink-200'
                        : isActive
                          ? 'text-flux-200'
                          : isFailed
                            ? 'text-crit-300'
                            : 'text-ink-500',
                    )}
                  >
                    {stage.label}
                  </span>
                  {isActive ? (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flux-400 opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-flux-400" />
                    </span>
                  ) : null}
                </div>
                <AnimatePresence mode="wait">
                  {(stage.detail ?? (!isPending ? meta.hint : null)) && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-0.5 text-2xs leading-relaxed text-ink-500"
                    >
                      {stage.detail ?? meta.hint}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.li>
          )
        })}
      </ol>

      <AnimatePresence>
        {job && (job.rowsAccepted > 0 || job.rowsRejected > 0) ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4"
          >
            <div>
              <div className="label-muted">Rows accepted</div>
              <p className="tnum mt-1 text-sm font-semibold text-watt-300">
                {formatNumber(job.rowsAccepted)}
              </p>
            </div>
            <div>
              <div className="label-muted">Rows rejected</div>
              <p className="tnum mt-1 text-sm font-semibold text-alert-300">
                {formatNumber(job.rowsRejected)}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {job?.error ? (
        <p className="mt-3 rounded-lg border border-crit-500/25 bg-crit-500/10 px-3 py-2 text-2xs text-crit-300">
          {job.error}
        </p>
      ) : null}
    </div>
  )
}

export const ProcessingPipeline = memo(ProcessingPipelineComponent)
