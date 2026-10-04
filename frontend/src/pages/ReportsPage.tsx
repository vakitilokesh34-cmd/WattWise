import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import type { AnomalyList, DashboardSummary } from '@/types'
import { useQuery } from '@/hooks/useQuery'
import { useWorkspace } from '@/context/WorkspaceContext'
import { wattwiseApi } from '@/services/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { ReportPanel } from '@/components/report/ReportPanel'
import { InvestigationScene3D } from '@/components/three/InvestigationScene3D'
import { Card, CardHeader } from '@/components/ui/Card'

/**
 * REPORTS — staged generation over the live window + forensic 3D context.
 * Figures always come from the API; exports are derived snapshots, never estimates.
 */
export default function ReportsPage() {
  const navigate = useNavigate()
  const { activeBuilding, activeBuildingId, range } = useWorkspace()

  const summary = useQuery<DashboardSummary>(
    activeBuildingId ? `summary:${activeBuildingId}:${range.from}:${range.to}` : null,
    () => wattwiseApi.getDashboardSummary({ buildingId: activeBuildingId, from: range.from, to: range.to }),
  )
  const anomalies = useQuery<AnomalyList>(
    activeBuildingId ? `anomalies:${activeBuildingId}:${range.from}:${range.to}` : null,
    () => wattwiseApi.getAnomalies({ buildingId: activeBuildingId, from: range.from, to: range.to }),
  )

  const top = useMemo(() => {
    const items = anomalies.data?.items ?? []
    return [...items].sort((a, b) => b.excessKwh - a.excessKwh)[0] ?? null
  }, [anomalies.data])

  const currency = summary.data?.currency ?? activeBuilding?.currency ?? 'INR'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle={`${activeBuilding?.name ?? 'Select a building'} · investigation-grade summaries with JSON / HTML export.`}
        icon={<FileText size={19} />}
        meta={
          <>
            <Badge tone="flux">{range.label || 'Custom range'}</Badge>
            {top ? <Badge tone="crit">{top.reference}</Badge> : null}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ReportPanel
          summary={summary.data ?? null}
          anomaly={top}
          currency={currency}
          buildingName={activeBuilding?.name ?? 'Selected building'}
        />

        {top ? (
          <InvestigationScene3D
            reference={top.reference}
            severityColor={top.severity === 'low' ? '#22d3ee' : top.severity === 'medium' ? '#fbbf24' : '#f43f5e'}
            facts={[
              { label: 'Expected', value: `${top.expectedKwh.toFixed(0)} kWh`, tone: 'flux' },
              { label: 'Actual', value: `${top.actualKwh.toFixed(0)} kWh`, tone: 'iris' },
              { label: 'Deviation', value: `+${Math.round(((top.actualKwh - top.expectedKwh) / Math.max(1, top.expectedKwh)) * 100)}%`, tone: 'alert' },
              { label: 'Excess', value: `${top.excessKwh.toFixed(0)} kWh`, tone: 'alert' },
              { label: 'Cost impact', value: `₹${top.estimatedCost.toFixed(0)}`, tone: 'crit' },
              { label: 'Severity', value: top.severity.toUpperCase(), tone: 'crit' },
            ]}
          />
        ) : (
          <Card>
            <CardHeader title="Forensic context" subtitle="Appears once an anomaly is selected" icon={<FileText size={15} />} />
            <p className="mt-3 text-xs leading-relaxed text-ink-500">
              No anomaly in this window yet. Widen the date range or open an investigation to preview the forensic scene alongside the report.
            </p>
          </Card>
        )}
      </div>

      {top ? (
        <button
          type="button"
          onClick={() => navigate(`/investigations/${top.id}`)}
          className="text-xs font-medium text-flux-300 hover:text-flux-200"
        >
          Open {top.reference} in the Investigation Center →
        </button>
      ) : null}
    </div>
  )
}
