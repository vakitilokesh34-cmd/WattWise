import { memo } from 'react'
import { Filter, RotateCcw, Search } from 'lucide-react'
import type { AnomalyStatus, Severity } from '@/types'
import { cn } from '@/utils/cn'
import { SEVERITY_LABEL, SEVERITY_ORDER, SEVERITY_STYLES } from '@/utils/format'
import { NumberSlider, TextInput } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']
const STATUSES: Array<{ value: AnomalyStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
]

export interface AnomalyFiltersState {
  severities: Severity[]
  status: AnomalyStatus[]
  minScore: number
  search: string
}

export const DEFAULT_FILTERS: AnomalyFiltersState = {
  severities: [],
  status: [],
  minScore: 0,
  search: '',
}

export interface AnomalyFiltersProps {
  value: AnomalyFiltersState
  onChange: (next: AnomalyFiltersState) => void
  /** Debounced search term as sent to the API. */
  resultCount?: number
  totalCount?: number
  className?: string
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item]
}

/**
 * Filter bar for the anomaly explorer. Severity and status are multi-select;
 * the score threshold is a slider; search is debounced by the caller.
 */
function AnomalyFiltersComponent({
  value,
  onChange,
  resultCount,
  totalCount,
  className,
}: AnomalyFiltersProps) {
  const isDirty =
    value.severities.length > 0 ||
    value.status.length > 0 ||
    value.minScore > 0 ||
    value.search.trim().length > 0

  return (
    <div className={cn('glass p-4', className)}>
      <div className="flex flex-wrap items-end gap-4">
        {/* Search */}
        <TextInput
          label="Search"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          placeholder="Reference, floor or amount…"
          iconLeft={<Search size={13} />}
          wrapperClassName="min-w-[13rem] flex-1"
        />

        {/* Score threshold */}
        <NumberSlider
          label="Minimum score"
          value={value.minScore}
          min={0}
          max={0.95}
          step={0.05}
          onChange={(next) => onChange({ ...value, minScore: next })}
          format={(next) => (next === 0 ? 'Any' : next.toFixed(2))}
          className="min-w-[12rem] flex-1"
        />

        {/* Reset */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
          disabled={!isDirty}
          iconLeft={isDirty ? <RotateCcw size={13} /> : <Filter size={13} />}
          className="h-10"
        >
          {isDirty ? 'Reset filters' : 'No filters'}
        </Button>
      </div>

      <div className="divider my-4" />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Severity */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-muted">Severity</span>
          {SEVERITIES.map((severity) => {
            const active = value.severities.includes(severity)
            const styles = SEVERITY_STYLES[severity]
            return (
              <button
                key={severity}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...value, severities: toggle(value.severities, severity) })}
                style={{ order: -SEVERITY_ORDER[severity] }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.1em] transition duration-200',
                  active
                    ? cn(styles.bg, styles.text, styles.border)
                    : 'border-white/[0.07] bg-white/[0.02] text-ink-500 hover:border-white/15 hover:text-ink-300',
                )}
              >
                <span
                  className={cn('h-1.5 w-1.5 rounded-full', active ? styles.dot : 'bg-ink-500')}
                />
                {SEVERITY_LABEL[severity]}
              </button>
            )
          })}
        </div>

        {/* Status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-muted">Status</span>
          {STATUSES.map((option) => {
            const active = value.status.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...value, status: toggle(value.status, option.value) })}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-2xs font-medium transition duration-200',
                  active
                    ? 'border-flux-400/35 bg-flux-500/12 text-flux-200'
                    : 'border-white/[0.07] bg-white/[0.02] text-ink-500 hover:border-white/15 hover:text-ink-300',
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {typeof resultCount === 'number' && typeof totalCount === 'number' ? (
          <p className="tnum ml-auto text-2xs text-ink-500">
            <span className="font-semibold text-ink-200">{resultCount}</span>
            {resultCount !== totalCount ? ` of ${totalCount}` : ''} anomalies
          </p>
        ) : null}
      </div>
    </div>
  )
}

export const AnomalyFilters = memo(AnomalyFiltersComponent)