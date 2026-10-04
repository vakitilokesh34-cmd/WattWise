import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Layers, Receipt, SearchX } from 'lucide-react'
import type { AnomalyList, Investigation } from '@/types'
import { formatCurrency, formatEnergy, formatScore, SEVERITY_LABEL } from '@/utils/format'
import { formatRelative } from '@/utils/date'
import { useQuery } from '@/hooks/useQuery'
import { useWorkspace } from '@/context/WorkspaceContext'
import { wattwiseApi } from '@/services/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge, SeverityBadge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { PageState } from '@/components/ui/PageState'
import { AnomalyCard } from '@/components/anomaly/AnomalyCard'
import { InvestigationPanel } from '@/components/investigation/InvestigationPanel'
import { InvestigationBrief } from '@/components/investigation/InvestigationBrief'
import { InvestigationScene3D } from '@/components/three/InvestigationScene3D'

/**
 * INVESTIGATION CENTER
 *
 * `/investigations` lists the anomalies that have been opened for review;
 * `/investigations/:anomalyId` renders the full brief for one deviation.
 */
export default function InvestigationsPage() {
  const { anomalyId } = useParams<{ anomalyId: string }>()
  if (anomalyId) return <InvestigationDetail anomalyId={anomalyId} />
  return <InvestigationIndex />
}

/* ── Index ─────────────────────────────────────────────────── */

function InvestigationIndex() {
  const navigate = useNavigate()
  const { activeBuilding, activeBuildingId, range } = useWorkspace()

  const queryKey = activeBuildingId ? `anomalies:${activeBuildingId}:${range.from}:${range.to}` : null
  const list = useQuery<AnomalyList>(queryKey, () =>
    wattwiseApi.getAnomalies({ buildingId: activeBuildingId, from: range.from, to: range.to }),
  )

  const items = useMemo(() => {
    const all = list.data?.items ?? []
    // Investigation-ready work first: open, then the highest scoring.
    return [...all].sort((a, b) => {
      const rank = (status: string) => (status === 'investigating' ? 0 : status === 'new' ? 1 : 2)
      const byStatus = rank(a.status) - rank(b.status)
      return byStatus !== 0 ? byStatus : b.score - a.score
    })
  }, [list.data])

  const maxExcess = useMemo(
    () => items.reduce((max, item) => Math.max(max, item.excessKwh), 0),
    [items],
  )
  const currency = activeBuilding?.currency ?? 'INR'
  const open = items.filter((item) => item.status === 'new' || item.status === 'investigating')

  return (
    <div className="space-y-5">
      <PageHeader
        title="Investigation Center"
        subtitle="Open an anomaly to review its evidence, unverified factors and recommended checks."
        icon={<FileText size={19} />}
        meta={
          <>
            <Badge tone={open.length > 0 ? 'alert' : 'watt'}>{open.length} open</Badge>
            <Badge tone="neutral">{items.length} in window</Badge>
          </>
        }
      />

      <PageState
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        skeleton={<ListSkeleton count={3} />}
        isEmpty={items.length === 0}
        emptyTitle="Nothing to investigate"
        emptyDescription="No anomalies were detected in this window. Widen the date range or upload more meter data."
        emptyIcon={<SearchX size={20} />}
        emptyAction={
          <Button variant="outline" size="sm" onClick={() => navigate('/upload')}>
            Upload data
          </Button>
        }
      >
        <Card padded={false} className="p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((anomaly, index) => (
              <AnomalyCard
                key={anomaly.id}
                anomaly={anomaly}
                currency={currency}
                scaleMax={maxExcess}
                index={index}
                onInvestigate={(item) => navigate(`/investigations/${item.id}`)}
              />
            ))}
          </div>
        </Card>
      </PageState>
    </div>
  )
}

/* ── Detail ────────────────────────────────────────────────── */

function InvestigationDetail({ anomalyId }: { anomalyId: string }) {
  const navigate = useNavigate()
  const { activeBuilding, activeBuildingId, range } = useWorkspace()

  const detailKey = anomalyId ? `investigation:${anomalyId}` : null
  const detail = useQuery<Investigation>(detailKey, () => wattwiseApi.getInvestigation(anomalyId), {
    refetchIntervalMs: 0,
  })

  const overviewKey = `investigationOverview:${anomalyId}:${range.from}:${range.to}`
  const overview = useQuery<AnomalyList>(overviewKey, () =>
    wattwiseApi.getAnomalies({
      buildingId: activeBuildingId,
      from: range.from,
      to: range.to,
    }),
  )

  const siblings = useMemo(() => {
    const all = overview.data?.items ?? []
    const index = all.findIndex((item) => item.id === anomalyId)
    return {
      previous: index > 0 ? all[index - 1] : null,
      next: index >= 0 && index < all.length - 1 ? all[index + 1] : null,
      position: index >= 0 ? index + 1 : null,
      total: all.length,
    }
  }, [overview.data, anomalyId])

  const buildingName = activeBuilding?.name ?? 'Selected building'

  return (
    <div className="space-y-5">
      <PageHeader
        title={detail.data ? detail.data.reference : 'Investigation'}
        subtitle={
          detail.data
            ? `${buildingName} · ${SEVERITY_LABEL[detail.data.severity]} · score ${formatScore(detail.data.score)}`
            : 'Loading investigation brief…'
        }
        icon={<FileText size={19} />}
        meta={
          detail.data ? (
            <>
              <SeverityBadge severity={detail.data.severity} />
              <Badge tone="neutral">
                {formatEnergy(detail.data.excessKwh, 1)} excess
              </Badge>
              <Badge tone="crit">
                {formatCurrency(detail.data.estimatedCost, detail.data.currency)} estimated
              </Badge>
              <Badge tone="neutral">Model {detail.data.modelVersion}</Badge>
            </>
          ) : null
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/investigations')}
              iconLeft={<ArrowLeft size={13} />}
            >
              All investigations
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!siblings.previous}
              onClick={() => siblings.previous && navigate(`/investigations/${siblings.previous.id}`)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!siblings.next}
              onClick={() => siblings.next && navigate(`/investigations/${siblings.next.id}`)}
            >
              Next
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-4">
          {detail.data ? (
            <InvestigationScene3D
              reference={detail.data.reference}
              severityColor={detail.data.severity === 'low' ? '#22d3ee' : detail.data.severity === 'medium' ? '#fbbf24' : '#f43f5e'}
              facts={[
                { label: 'Expected', value: `${detail.data.expectedKwh.toFixed(0)} kWh`, tone: 'flux' },
                { label: 'Actual', value: `${detail.data.actualKwh.toFixed(0)} kWh`, tone: 'iris' },
                { label: 'Excess', value: `${detail.data.excessKwh.toFixed(0)} kWh`, tone: 'alert' },
                { label: 'Cost impact', value: `₹${detail.data.estimatedCost.toFixed(0)}`, tone: 'crit' },
                { label: 'Cause', value: detail.data.possibleFactors[0]?.label ?? 'Under review', tone: 'alert' },
                { label: 'Action', value: 'Verify schedule', tone: 'watt' },
              ]}
            />
          ) : null}
          <InvestigationPanel
            investigation={detail.data}
            loading={detail.isLoading}
            error={detail.error}
            onRetry={() => void detail.refetch()}
            buildingName={buildingName}
          />
        </div>

        <div className="space-y-4">
          <div className="xl:sticky xl:top-4">
            {detail.data ? (
              <InvestigationBrief investigation={detail.data} building={activeBuilding} />
            ) : (
              <Card>
                <CardHeader title="Brief" subtitle="Printable summary" icon={<Receipt size={15} />} />
                <div className="mt-4 space-y-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="skeleton h-3 rounded-full" />
                  ))}
                </div>
              </Card>
            )}

            <Card className="mt-4">
              <CardHeader title="Position in window" icon={<Layers size={15} />} />
              <p className="tnum mt-3 text-xs text-ink-400">
                {siblings.position ? `${siblings.position} of ${siblings.total} anomalies` : 'Not in the current window'}
              </p>
              <p className="mt-2 text-2xs text-ink-500">
                Updated {formatRelative(detail.data?.generatedAt ?? null)}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}