import { useCallback, useMemo, useState } from 'react'
import {
  Check,
  Copy,
  Download,
  FileText,
  Info,
  Printer,
  Share2,
  ShieldCheck,
} from 'lucide-react'
import type { Building, Investigation } from '@/types'
import { cn } from '@/utils/cn'
import {
  FACTOR_CATEGORY_LABEL,
  formatCurrency,
  formatEnergy,
  formatNumber,
  formatScore,
  SEVERITY_LABEL,
} from '@/utils/format'
import { formatDateTime, formatDuration, formatTimeRange } from '@/utils/date'
import { copyToClipboard, downloadTextFile, shareContent } from '@/utils/download'
import { Button } from '@/components/ui/Button'
import { Badge, SeverityBadge } from '@/components/ui/Badge'
import { useWorkspace } from '@/context/WorkspaceContext'

export interface InvestigationBriefProps {
  investigation: Investigation
  building: Building | null
  className?: string
}

/* ── Plain-text serialisation (copy / download / share) ─────── */

export function briefToText(investigation: Investigation, buildingName: string): string {
  const line = '-'.repeat(66)
  const rows: string[] = [
    'ENERGY INVESTIGATION BRIEF',
    line,
    `Reference        : ${investigation.reference}`,
    `Building         : ${buildingName}`,
    `Period           : ${formatDateTime(investigation.start)} -> ${formatTimeRange(investigation.start, investigation.end)} (${formatDuration(investigation.start, investigation.end)})`,
    `Severity         : ${SEVERITY_LABEL[investigation.severity]}`,
    `Anomaly score    : ${formatScore(investigation.score)}`,
    `Baseline model   : ${investigation.modelVersion}`,
    `Generated at     : ${formatDateTime(investigation.generatedAt)}`,
    line,
    '',
    'OBSERVATION',
    investigation.observation || investigation.summary || 'Not reported.',
    '',
    'MEASUREMENTS',
    `  Expected consumption : ${formatEnergy(investigation.expectedKwh, 1)}`,
    `  Actual consumption   : ${formatEnergy(investigation.actualKwh, 1)}`,
    `  Excess energy        : ${formatEnergy(investigation.excessKwh, 1)}`,
    `  Estimated cost       : ${formatCurrency(investigation.estimatedCost, investigation.currency)}`,
    `  Tariff applied       : ${formatCurrency(investigation.tariffRatePerKwh, investigation.currency, { fractionDigits: 2 })}/kWh`,
    '',
    'EVIDENCE',
  ]

  if (investigation.evidence.length === 0) rows.push('  (no evidence items returned)')
  investigation.evidence.forEach((item) => {
    rows.push(`  • ${item.label}: ${item.value}`)
    if (item.detail) rows.push(`    ${item.detail}`)
  })

  rows.push('', 'POSSIBLE FACTORS (unverified hypotheses)')
  if (investigation.possibleFactors.length === 0) rows.push('  (none returned)')
  investigation.possibleFactors.forEach((factor) => {
    rows.push(`  • ${factor.label} [${FACTOR_CATEGORY_LABEL[factor.category] ?? factor.category}] — ${factor.status.replace('_', ' ')}`)
    if (factor.rationale) rows.push(`    ${factor.rationale}`)
  })

  rows.push('', 'RECOMMENDED CHECKS')
  if (investigation.recommendedChecks.length === 0) rows.push('  (none returned)')
  investigation.recommendedChecks.forEach((check, index) => {
    rows.push(`  ${index + 1}. [${check.priority}] ${check.label}${check.owner ? ` — owner: ${check.owner}` : ''}`)
  })

  rows.push('', 'TIMELINE')
  investigation.timeline.forEach((event) => {
    rows.push(`  • ${formatDateTime(event.timestamp)} — ${event.label}${event.detail ? ` (${event.detail})` : ''}`)
  })

  rows.push('', line)
  rows.push('Note: Estimated excess cost is derived from reported meter readings and the')
  rows.push('configured tariff. Actual charges may differ. WattWise does not assert a root')
  rows.push('cause — confirm the checks above with facilities and sub-meter data.')
  if (investigation.confidenceNote) {
    rows.push('', investigation.confidenceNote)
  }

  return rows.join('\n')
}

/* ── Component ──────────────────────────────────────────────── */

/**
 * Professional, exportable investigation report.
 *
 * Copy / Download / Share all operate on the same plain-text serialisation so
 * what the manager sends onward matches exactly what they see.
 */
export function InvestigationBrief({ investigation, building, className }: InvestigationBriefProps) {
  const { pushNotification } = useWorkspace()
  const [copied, setCopied] = useState(false)

  const buildingName = building?.name ?? investigation.buildingId
  const currency = investigation.currency

  const text = useMemo(
    () => briefToText(investigation, buildingName),
    [investigation, buildingName],
  )

  const fileName = useMemo(
    () =>
      `wattwise-investigation-${investigation.reference.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`,
    [investigation.reference],
  )

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(text)
    setCopied(ok)
    window.setTimeout(() => setCopied(false), 2000)
    pushNotification({
      kind: 'system',
      title: ok ? 'Brief copied to clipboard' : 'Copy failed',
      body: ok
        ? `${investigation.reference} brief is ready to paste.`
        : 'Your browser blocked clipboard access. Use Download instead.',
      severity: 'info',
    })
  }, [text, investigation.reference, pushNotification])

  const handleDownload = useCallback(() => {
    downloadTextFile(fileName, text, 'text/plain;charset=utf-8')
    pushNotification({
      kind: 'system',
      title: 'Brief downloaded',
      body: `${fileName} saved to your downloads.`,
      severity: 'info',
    })
  }, [fileName, text, pushNotification])

  const handleShare = useCallback(async () => {
    const result = await shareContent({
      title: `${investigation.reference} — Energy Investigation Brief`,
      text,
      url: window.location.href,
    })
    pushNotification({
      kind: 'system',
      title:
        result === 'shared'
          ? 'Brief shared'
          : result === 'copied'
            ? 'Share link copied'
            : result === 'cancelled'
              ? 'Share cancelled'
              : 'Sharing unavailable',
      body:
        result === 'shared'
          ? `${investigation.reference} was handed to your share sheet.`
          : result === 'copied'
            ? 'The brief and current link were copied to your clipboard.'
            : 'No share or clipboard action was performed.',
      severity: 'info',
    })
  }, [text, investigation.reference, pushNotification])

  const handlePrint = useCallback(() => window.print(), [])

  return (
    <article
      className={cn(
        'glass overflow-hidden rounded-2xl print:border-0 print:bg-transparent print:shadow-none',
        className,
      )}
    >
      {/* ── Toolbar ────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.015] px-5 py-3.5 print:hidden">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-flux-400/25 bg-flux-500/10 text-flux-300">
            <FileText size={15} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink-50">Energy Investigation Brief</h3>
            <p className="text-2xs text-ink-500">{investigation.reference}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            iconLeft={<Printer size={13} />}
            className="hidden sm:inline-flex"
          >
            Print
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            iconLeft={copied ? <Check size={13} /> : <Copy size={13} />}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownload} iconLeft={<Download size={13} />}>
            Download
          </Button>
          <Button variant="primary" size="sm" onClick={handleShare} iconLeft={<Share2 size={13} />}>
            Share
          </Button>
        </div>
      </header>

      {/* ── Report body ────────────────────────────────────── */}
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-flux-300">
              WattWise · Energy Anomaly Detection
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-ink-50 sm:text-xl">
              Energy Investigation Brief
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={investigation.severity} />
            <Badge tone="neutral">Score {formatScore(investigation.score)}</Badge>
            <Badge tone="neutral">Model {investigation.modelVersion}</Badge>
          </div>
        </div>

        <div className="divider my-5" />

        {/* Identity block */}
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <BriefField label="Building" value={buildingName} />
          <BriefField
            label="Period"
            value={`${formatDateTime(investigation.start)} → ${formatTimeRange(investigation.start, investigation.end)}`}
            hint={`${formatDuration(investigation.start, investigation.end)} window`}
          />
          <BriefField label="Expected" value={formatEnergy(investigation.expectedKwh, 1)} />
          <BriefField label="Actual" value={formatEnergy(investigation.actualKwh, 1)} tone="flux" />
          <BriefField label="Excess" value={formatEnergy(investigation.excessKwh, 1)} tone="crit" />
          <BriefField
            label="Estimated cost"
            value={formatCurrency(investigation.estimatedCost, currency)}
            tone="alert"
            hint={`Tariff ${formatCurrency(investigation.tariffRatePerKwh, currency, { fractionDigits: 2 })}/kWh`}
          />
        </dl>

        {/* Observation */}
        <section className="mt-6">
          <h3 className="panel-title">Observation</h3>
          <p className="mt-2 text-xs leading-relaxed text-ink-200">
            {investigation.observation || investigation.summary || 'No observation was returned for this anomaly.'}
          </p>
        </section>

        {/* Evidence */}
        <section className="mt-6">
          <h3 className="panel-title">Evidence</h3>
          {investigation.evidence.length === 0 ? (
            <p className="mt-2 text-xs text-ink-500">No evidence items were returned.</p>
          ) : (
            <table className="mt-2 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="pb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-500">Item</th>
                  <th className="pb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-500">Value</th>
                </tr>
              </thead>
              <tbody>
                {investigation.evidence.map((item) => (
                  <tr key={item.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2 pr-4 align-top">
                      <p className="text-xs font-medium text-ink-100">{item.label}</p>
                      {item.detail ? (
                        <p className="mt-0.5 text-2xs leading-relaxed text-ink-500">{item.detail}</p>
                      ) : null}
                    </td>
                    <td className="tnum py-2 align-top text-xs font-semibold text-ink-50">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Possible factors */}
        <section className="mt-6">
          <h3 className="panel-title">Possible factors</h3>
          <p className="mt-1 text-2xs text-ink-500">
            Hypotheses surfaced for verification — not confirmed causes.
          </p>
          {investigation.possibleFactors.length === 0 ? (
            <p className="mt-2 text-xs text-ink-500">No candidate factors were returned.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {investigation.possibleFactors.map((factor) => (
                <li key={factor.id} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-flux-400" />
                  <div>
                    <p className="text-xs font-medium text-ink-100">
                      {factor.label}
                      <span className="ml-2 text-2xs font-normal text-ink-500">
                        {FACTOR_CATEGORY_LABEL[factor.category] ?? factor.category} ·{' '}
                        {factor.status.replace('_', ' ')}
                      </span>
                    </p>
                    {factor.rationale ? (
                      <p className="mt-0.5 text-2xs leading-relaxed text-ink-400">{factor.rationale}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recommended checks */}
        <section className="mt-6">
          <h3 className="panel-title">Recommended checks</h3>
          {investigation.recommendedChecks.length === 0 ? (
            <p className="mt-2 text-xs text-ink-500">No checks were returned.</p>
          ) : (
            <ol className="mt-3 space-y-1.5">
              {investigation.recommendedChecks.map((check, index) => (
                <li key={check.id} className="flex items-start gap-2.5">
                  <span className="tnum mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-white/15 text-[9px] font-semibold text-ink-300">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs leading-relaxed text-ink-100">{check.label}</p>
                    <p className="mt-0.5 text-2xs text-ink-500">
                      {check.priority} priority
                      {check.owner ? ` · ${check.owner}` : ' · unassigned'}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Footer disclaimer */}
        <footer className="mt-7 flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-flux-300" />
          <div className="min-w-0">
            <p className="text-2xs font-semibold text-ink-200">Estimated figures only</p>
            <p className="mt-1 text-2xs leading-relaxed text-ink-400">
              Excess energy and estimated cost are derived from reported meter readings and the configured
              tariff. Actual charges may differ, and no root cause is asserted by this brief.
            </p>
            {investigation.confidenceNote ? (
              <p className="mt-1.5 text-2xs leading-relaxed text-ink-500">{investigation.confidenceNote}</p>
            ) : null}
            <p className="tnum mt-2 flex items-center gap-1.5 text-2xs text-ink-500">
              <Info size={10} />
              Generated {formatDateTime(investigation.generatedAt)} · baseline model{' '}
              {investigation.modelVersion} · {formatNumber(investigation.evidence.length)} evidence items
            </p>
          </div>
        </footer>
      </div>
    </article>
  )
}

function BriefField({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'flux' | 'crit' | 'alert'
}) {
  const tones = {
    default: 'text-ink-50',
    flux: 'text-flux-300',
    crit: 'text-crit-300',
    alert: 'text-alert-300',
  } as const
  return (
    <div className="min-w-0 border-b border-white/[0.05] pb-2.5">
      <dt className="text-2xs font-medium uppercase tracking-[0.12em] text-ink-500">{label}</dt>
      <dd className={cn('tnum mt-1 text-sm font-semibold', tones[tone])}>{value}</dd>
      {hint ? <p className="mt-0.5 text-2xs text-ink-500">{hint}</p> : null}
    </div>
  )
}
