import { motion } from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import type { Anomaly, DashboardSummary } from '@/types'
import { formatCurrency, formatEnergy } from '@/utils/format'

interface DemoFlowStripProps {
  summary: DashboardSummary | null
  anomaly: Anomaly | null
  currency?: string
  onInvestigate?: (anomaly: Anomaly) => void
}

/**
 * 5-second UX strip: answers How much → over expected? → how much extra? →
 * money wasted? → which anomaly? → what next? Falls back to the canonical
 * demo scenario (100 / 180 / 80 / ₹640 / AN-024) when the API is unreachable.
 */
export function DemoFlowStrip({ summary, anomaly, currency = 'INR', onInvestigate }: DemoFlowStripProps) {
  const current = summary?.currentUsageKwh ?? 180
  const expected = summary?.expectedUsageKwh ?? 100
  const excess = summary?.excessKwh ?? Math.max(0, current - expected)
  const cost = summary?.estimatedExcessCost ?? 640

  const steps = [
    { label: 'Expected', value: formatEnergy(expected, 0), tone: 'text-flux-300 border-flux-400/25 bg-flux-500/[0.07]' },
    { label: 'Actual', value: formatEnergy(current, 0), tone: 'text-ink-50 border-white/10 bg-white/[0.04]' },
    { label: 'Excess', value: formatEnergy(excess, 0), tone: 'text-alert-300 border-alert-500/30 bg-alert-500/[0.08]' },
    { label: 'Excess cost', value: formatCurrency(cost, currency), tone: 'text-crit-300 border-crit-500/30 bg-crit-500/[0.08]' },
    { label: 'Anomaly', value: anomaly?.reference ?? 'AN-024', tone: 'text-crit-300 border-crit-500/30 bg-crit-500/[0.08]' },
  ]

  return (
    <div className="glass px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="panel-title mr-1">Energy → Analytics → Anomaly → Cost → Action</p>
      </div>
      <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-stretch">
        {steps.map((step, i) => (
          <div key={step.label} className="flex flex-1 items-stretch gap-1.5">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className={`flex flex-1 items-center justify-between gap-2 rounded-xl border px-3 py-2 ${step.tone}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">{step.label}</span>
              <span className="tnum text-sm font-bold">{step.value}</span>
            </motion.div>
            {i < steps.length - 1 ? (
              <span className="hidden items-center text-ink-600 sm:flex" aria-hidden="true"><ArrowDown size={12} className="-rotate-90" /></span>
            ) : null}
          </div>
        ))}
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: steps.length * 0.07, duration: 0.4 }}
          onClick={() => anomaly && onInvestigate?.(anomaly)}
          disabled={!anomaly}
          className="rounded-xl border border-flux-400/30 bg-flux-500/12 px-4 py-2 text-xs font-semibold text-flux-200 transition hover:bg-flux-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          AI investigation →
        </motion.button>
      </div>
    </div>
  )
}
