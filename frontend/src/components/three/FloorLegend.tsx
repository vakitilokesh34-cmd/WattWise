import { memo, useMemo } from 'react'
import { Layers } from 'lucide-react'
import type { Anomaly, Building } from '@/types'
import { cn } from '@/utils/cn'
import { deriveFloorStates } from '@/utils/floorState'
import { formatCurrency, formatEnergy, formatNumber, SEVERITY_LABEL } from '@/utils/format'
import { MagnitudeBar } from '@/components/ui/DataDisplay'

export interface FloorLegendProps {
  building: Building | null
  anomalies: Anomaly[]
  currency?: string
  className?: string
}

/**
 * Textual twin of the 3D scene: every floor, its state, excess energy and
 * estimated cost. Sharing `deriveFloorStates` guarantees the panel and the
 * scene can never disagree.
 */
function FloorLegendComponent({ building, anomalies, currency = 'INR', className }: FloorLegendProps) {
  const floors = useMemo(() => deriveFloorStates(building, anomalies), [building, anomalies])
  const maxExcess = useMemo(
    () => floors.reduce((max, floor) => Math.max(max, floor.excessKwh), 0),
    [floors],
  )

  if (floors.length === 0) {
    return (
      <p className={cn('py-6 text-center text-xs text-ink-500', className)}>
        No building selected.
      </p>
    )
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {[...floors].reverse().map((floor) => (
        <li
          key={floor.floorId}
          className={cn(
            'rounded-xl border px-3 py-2.5 transition duration-300',
            floor.isAnomalous
              ? 'border-crit-500/25 bg-crit-500/[0.06]'
              : 'border-white/[0.06] bg-white/[0.02]',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  floor.isAnomalous ? 'bg-crit-400 shadow-[0_0_10px_-1px_rgba(244,63,94,0.9)]' : 'bg-watt-400/80',
                )}
              />
              <span className="truncate text-xs font-semibold text-ink-100">{floor.label}</span>
            </div>

            {floor.isAnomalous && floor.severity ? (
              <span className="shrink-0 rounded-full bg-crit-500/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-crit-300">
                {SEVERITY_LABEL[floor.severity]}
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-watt-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-watt-300">
                Normal
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-2xs">
            <span className="tnum text-ink-400">
              {floor.anomalyCount > 0 ? `${floor.anomalyCount} anomal${floor.anomalyCount === 1 ? 'y' : 'ies'}` : 'No anomalies'}
            </span>
            <span className="tnum font-semibold text-ink-200">
              {floor.excessKwh > 0 ? (
                <>
                  {formatEnergy(floor.excessKwh, 1)}
                  <span className="ml-2 text-alert-300">
                    {formatCurrency(floor.estimatedCost, currency)}
                  </span>
                </>
              ) : (
                '—'
              )}
            </span>
          </div>

          {floor.excessKwh > 0 && maxExcess > 0 ? (
            <div className="mt-2">
              <MagnitudeBar value={floor.excessKwh} max={maxExcess} tone="crit" />
            </div>
          ) : null}

          {floor.maxScore > 0 ? (
            <p className="tnum mt-1.5 text-[10px] text-ink-500">
              Peak score {formatNumber(floor.maxScore, 2)}
            </p>
          ) : null}
        </li>
      ))}

      <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[10px] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-watt-400/80" /> Normal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-crit-400" /> Anomalous
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Layers size={10} /> Tallest floor shown first
        </span>
      </li>
    </ul>
  )
}

export const FloorLegend = memo(FloorLegendComponent)