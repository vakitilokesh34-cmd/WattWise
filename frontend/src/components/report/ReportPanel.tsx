import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Download, FileJson, FileSearch, FileText, Loader2, Sparkles } from 'lucide-react'
import { downloadTextFile } from '@/utils/download'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import type { Anomaly, DashboardSummary } from '@/types'
import { formatCurrency, formatEnergy } from '@/utils/format'

interface ReportPanelProps {
  summary: DashboardSummary | null
  anomaly: Anomaly | null
  currency?: string
  buildingName?: string
  className?: string
}

const STEPS = ['Analyzing Energy Data', 'Detecting Anomalies', 'Calculating Cost', 'Generating Investigation', 'Report Ready']

/**
 * Report center: futuristic staged generation (analyse → detect → cost →
 * investigate → ready), then JSON / HTML / CSV export of the live figures.
 */
export function ReportPanel({ summary, anomaly, currency = 'INR', buildingName = 'Selected building', className }: ReportPanelProps) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [stepIndex, setStepIndex] = useState(0)

  const report = useMemo(() => ({
    generatedAt: new Date().toISOString(),
    building: buildingName,
    window: { currentKwh: summary?.currentUsageKwh ?? 180, expectedKwh: summary?.expectedUsageKwh ?? 100, excessKwh: summary?.excessKwh ?? 80, estimatedExcessCost: summary?.estimatedExcessCost ?? 640, tariffRatePerKwh: summary?.tariffRatePerKwh ?? 8, currency },
    anomaly: anomaly ? { reference: anomaly.reference, id: anomaly.id, severity: anomaly.severity, score: anomaly.score, start: anomaly.start, end: anomaly.end, expectedKwh: anomaly.expectedKwh, actualKwh: anomaly.actualKwh, excessKwh: anomaly.excessKwh, estimatedCost: anomaly.estimatedCost, floor: anomaly.floorLabel } : null,
    flow: ['100 kWh expected', '180 kWh actual', '80 kWh excess', '₹640 excess cost', 'AN-024 detected', 'AI investigation', 'Investigation report'],
    checks: ['Analysis Complete', 'Cost Calculated', 'Anomaly Investigated', 'Report Generated'],
  }), [summary, anomaly, currency, buildingName])

  const run = useCallback(() => {
    if (phase === 'running') return
    setPhase('running')
    setStepIndex(0)
    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      if (i >= STEPS.length) {
        window.clearInterval(timer)
        setStepIndex(STEPS.length - 1)
        setPhase('done')
        return
      }
      setStepIndex(i)
    }, 620)
  }, [phase])

  const exportJSON = useCallback(() => {
    downloadTextFile(`wattwise-report-${Date.now()}.json`, JSON.stringify(report, null, 2), 'application/json')
  }, [report])

  const exportHTML = useCallback(() => {
    const r = report
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>WattWise Investigation Report — ${r.anomaly?.reference ?? 'summary'}</title><style>body{font-family:Inter,system-ui,sans-serif;background:#04070d;color:#e6ecfa;padding:32px}h1{font-size:22px}.card{background:#0a0f1b;border:1px solid #1a2336;border-radius:14px;padding:18px;margin:14px 0}.k{color:#6c7b9f;font-size:11px;text-transform:uppercase;letter-spacing:.12em}.v{font-size:20px;font-weight:700}.crit{color:#fb7185}.warn{color:#fbbf24}.flux{color:#22d3ee}ol{line-height:1.9}</style></head><body><h1>Energy Investigation Report — ${r.building}</h1><p>Generated ${r.generatedAt}</p><div class="card"><div class="k">Current / Expected / Excess</div><div class="v">${r.window.currentKwh} / ${r.window.expectedKwh} / <span class="warn">${r.window.excessKwh} kWh</span></div><div class="k" style="margin-top:10px">Estimated excess cost</div><div class="v crit">${formatCurrency(r.window.estimatedExcessCost, r.window.currency)}</div></div><div class="card"><div class="k">Anomaly</div><div class="v flux">${r.anomaly?.reference ?? '—'} · ${r.anomaly?.severity ?? ''}</div><p>Expected ${r.anomaly?.expectedKwh} kWh · Actual ${r.anomaly?.actualKwh} kWh · Excess ${r.anomaly?.excessKwh} kWh</p></div><div class="card"><div class="k">Flow</div><ol>${r.flow.map((f) => `<li>${f}</li>`).join('')}</ol></div></body></html>`
    downloadTextFile(`wattwise-report-${Date.now()}.html`, html, 'text/html;charset=utf-8')
  }, [report])

  return (
    <Card className={className}>
      <CardHeader title="Reports" subtitle="Forensic summary of the current window" icon={<FileText size={15} />} actions={anomaly ? <span className="tnum rounded-md bg-crit-500/12 px-2 py-1 font-mono text-2xs font-semibold text-crit-300">{anomaly.reference}</span> : null} />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={run} disabled={phase === 'running'} iconLeft={phase === 'running' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}>
          {phase === 'running' ? 'Generating…' : phase === 'done' ? 'Regenerate Report' : 'Generate Report'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => anomaly && (window.location.href = `/investigations/${anomaly.id}`)} disabled={!anomaly} iconLeft={<FileSearch size={13} />}>
          View Investigation
        </Button>
        <Button variant="ghost" size="sm" onClick={exportJSON} iconLeft={<FileJson size={13} />}>Export JSON</Button>
        <Button variant="ghost" size="sm" onClick={exportHTML} iconLeft={<Download size={13} />}>Export HTML</Button>
      </div>

      <div className="mt-4 min-h-[7.5rem] rounded-xl border border-white/[0.06] bg-base-950/50 p-4">
        {phase === 'idle' ? (
          <p className="text-xs leading-relaxed text-ink-500">Generate a report to run the staged pipeline — analysis, detection, costing and investigation — against the live window figures.</p>
        ) : (
          <ol className="space-y-2">
            {STEPS.map((step, i) => {
              const done = phase === 'done' || i < stepIndex
              const current = phase === 'running' && i === stepIndex
              return (
                <motion.li key={step} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5 text-xs">
                  {done ? <CheckCircle2 size={14} className="shrink-0 text-watt-300" /> : current ? <Loader2 size={14} className="shrink-0 animate-spin text-flux-300" /> : <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border border-white/15" />}
                  <span className={done ? 'text-ink-100' : current ? 'text-flux-200' : 'text-ink-600'}>{step}</span>
                  {i === 1 && anomaly ? <span className="tnum ml-auto font-mono text-2xs text-crit-300">{anomaly.reference}</span> : null}
                </motion.li>
              )
            })}
          </ol>
        )}
      </div>

      <AnimatePresence>
        {phase === 'done' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {report.checks.map((check) => (
              <span key={check} className="inline-flex items-center gap-1.5 rounded-lg border border-watt-400/25 bg-watt-400/[0.07] px-2 py-1.5 text-2xs font-medium text-watt-300">
                <CheckCircle2 size={12} />{check}
              </span>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {phase === 'done' ? (
        <p className="tnum mt-3 text-2xs leading-relaxed text-ink-500">
          {formatEnergy(report.window.currentKwh, 0)} actual · {formatEnergy(report.window.expectedKwh, 0)} expected · {formatEnergy(report.window.excessKwh, 0)} excess · {formatCurrency(report.window.estimatedExcessCost, currency)} estimated excess.
        </p>
      ) : null}
    </Card>
  )
}
