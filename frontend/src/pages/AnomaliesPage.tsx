import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, SearchX, TriangleAlert } from 'lucide-react'
import type { AnomalyList } from '@/types'
import { downloadTextFile, toCsv } from '@/utils/download'
import { useQuery } from '@/hooks/useQuery'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useWorkspace } from '@/context/WorkspaceContext'
import { wattwiseApi } from '@/services/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { PageState } from '@/components/ui/PageState'
import {
  AnomalyFilters,
  DEFAULT_FILTERS,
  type AnomalyFiltersState,
} from '@/components/anomaly/AnomalyFilters'
import { AnomalyCard } from '@/components/anomaly/AnomalyCard'

const PAGE_SIZE = 12

/**
 * ANOMALY EXPLORER
 *
 * Filterable, pageable list of every deviation the model flagged in the current
 * scope. Search is debounced before it reaches the API.
 */
export default function AnomaliesPage() {
  const navigate = useNavigate()
  const { activeBuilding, activeBuildingId, range } = useWorkspace()

  const [filters, setFilters] = useState<AnomalyFiltersState>({ ...DEFAULT_FILTERS })
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(filters.search, 350)

  const query = useMemo<AnomalyFiltersState>(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  )

  const queryKey = useMemo(
    () =>
      activeBuildingId
        ? `anomalies:${activeBuildingId}:${range.from}:${range.to}:${JSON.stringify(query)}`
        : null,
    [activeBuildingId, range.from, range.to, query],
  )

  const list = useQuery<AnomalyList>(queryKey, () =>
    wattwiseApi.getAnomalies({
      buildingId: activeBuildingId,
      from: range.from,
      to: range.to,
      severities: query.severities.length ? query.severities : undefined,
      status: query.status.length ? query.status : undefined,
      minScore: query.minScore > 0 ? query.minScore : undefined,
      search: query.search.trim() || undefined,
    }),
  )

  const items = list.data?.items ?? []
  // The endpoint returns the whole filtered window, so pagination is local.
  const total = items.length
  const pageSize = PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const visible = items.slice((page - 1) * pageSize, page * pageSize)
  const currency = activeBuilding?.currency ?? 'INR'

  const maxExcess = useMemo(
    () => items.reduce((max, item) => Math.max(max, item.excessKwh), 0),
    [items],
  )

  const handleFilters = useCallback((next: AnomalyFiltersState) => {
    setFilters(next)
    setPage(1)
  }, [])

  const handleExport = useCallback(() => {
    downloadTextFile(
      `wattwise-anomalies-${activeBuildingId}-${range.from.slice(0, 10)}.csv`,
      toCsv(
        items.map((item) => ({
          reference: item.reference,
          id: item.id,
          start: item.start,
          end: item.end,
          expected_kwh: item.expectedKwh,
          actual_kwh: item.actualKwh,
          excess_kwh: item.excessKwh,
          estimated_cost: item.estimatedCost,
          score: item.score,
          severity: item.severity,
          status: item.status,
          floor: item.floorLabel ?? '',
        })),
      ),
      'text/csv;charset=utf-8',
    )
  }, [items, activeBuildingId, range.from])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Anomaly Explorer"
        subtitle="Every deviation the baseline model flagged, filterable by severity, score and status."
        icon={<TriangleAlert size={19} />}
        meta={
          <>
            <span className="text-2xs text-ink-500">{activeBuilding?.name ?? 'No building selected'}</span>
          </>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={items.length === 0}
            iconLeft={<Download size={13} />}
          >
            Export CSV
          </Button>
        }
      />

      <AnomalyFilters
        value={filters}
        onChange={handleFilters}
        resultCount={list.data ? items.length : undefined}
        totalCount={total}
      />

      <PageState
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        skeleton={<ListSkeleton count={4} />}
        isEmpty={items.length === 0}
        emptyTitle="No anomalies match these filters"
        emptyDescription="Widen the date range, lower the minimum score, or clear the severity and status filters."
        emptyIcon={<SearchX size={20} />}
        emptyAction={
          <Button variant="outline" size="sm" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>
            Clear filters
          </Button>
        }
      >
        <Card padded={false} className="p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {visible.map((anomaly, index) => (
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

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || list.isFetching}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </Button>
          <p className="tnum text-2xs text-ink-400">
            Page {page} of {totalPages}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || list.isFetching}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </div>
  )
}