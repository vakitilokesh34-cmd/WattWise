import { Suspense, useCallback, useMemo, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { AlertTriangle, Minus, Plus, RotateCcw, Zap } from 'lucide-react'
import type { Anomaly, Building } from '@/types'
import { deriveFloorStates, type FloorState } from '@/utils/floorState'
import { formatCurrency, formatEnergy, formatNumber, SEVERITY_LABEL } from '@/utils/format'
import { useDeviceProfile } from '@/hooks/useDeviceProfile'
import { Tooltip } from '@/components/ui/Tooltip'
import { BuildingScene } from './BuildingScene'

export interface Building3DProps {
  building: Building | null
  anomalies: Anomaly[]
  /** Currency reported by the backend, used for the on-scene cost readout. */
  currency?: string
  className?: string
  /** Rendered when the scene is disabled by configuration or viewport. */
  fallback?: ReactNode
}

/**
 * Interactive 3D smart building.
 *
 * Budget (shadows / particle count / window detail / DPR) is derived from
 * `useDeviceProfile`, so mobile gets a simplified scene and desktop gets the
 * full treatment without any branching inside the scene graph.
 */
export function Building3D({
  building,
  anomalies,
  currency = 'INR',
  className,
  fallback,
}: Building3DProps) {
  const profile = useDeviceProfile()
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null)
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [zoomSignal, setZoomSignal] = useState(0)
  const [zoomDirection, setZoomDirection] = useState<1 | -1>(-1)

  const floors = useMemo(() => deriveFloorStates(building, anomalies), [building, anomalies])
  const activeFloor =
    floors.find((f) => f.index === hoveredFloor) ?? floors.find((f) => f.index === selectedFloor) ?? null

  const handleSelect = useCallback((index: number) => {
    setSelectedFloor((prev) => (prev === index ? null : index))
  }, [])

  const zoom = useCallback((direction: 1 | -1) => {
    setZoomDirection(direction)
    setZoomSignal((value) => value + 1)
  }, [])

  if (!profile.enable3D) {
    return <>{fallback ?? null}</>
  }

  return (
    <div className={className}>
      <div className="relative h-full min-h-[320px] w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[radial-gradient(120%_110%_at_50%_0%,#0b1524_0%,#05080f_62%,#04070d_100%)]">
        <div className="pointer-events-none absolute inset-0 z-10 bg-grid-fade" />

        <Canvas
          dpr={profile.dpr}
          shadows={profile.shadows}
          gl={{
            antialias: profile.quality === 'high',
            alpha: true,
            powerPreference: profile.quality === 'low' ? 'low-power' : 'high-performance',
            preserveDrawingBuffer: false,
          }}
          camera={{ position: [9.5, 7.2, 12.5], fov: profile.isMobile ? 46 : 38, near: 0.1, far: 120 }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <Suspense fallback={null}>
            <BuildingScene
              building={building}
              floors={floors}
              anomalies={anomalies}
              quality={profile.quality}
              shadows={profile.shadows}
              animate={!profile.reducedMotion}
              particleBudget={profile.particleBudget}
              hoveredFloor={hoveredFloor}
              selectedFloor={selectedFloor}
              onFloorHover={setHoveredFloor}
              onFloorSelect={handleSelect}
              resetSignal={resetSignal}
              zoomSignal={zoomSignal}
              zoomDirection={zoomDirection}
            />
          </Suspense>
        </Canvas>

        {/* ── Scene identity ── */}
        <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-flux-400/25 bg-flux-500/10 text-flux-300">
            <Zap size={13} />
          </span>
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-ink-500">Live energy flow</p>
            <p className="text-xs font-semibold text-ink-50">
              {building ? building.name : 'No building selected'}
            </p>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5">
          <Tooltip content="Zoom out" side="left">
            <button
              type="button"
              onClick={() => zoom(1)}
              aria-label="Zoom out"
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-base-900/70 text-ink-300 backdrop-blur-md transition hover:border-flux-400/40 hover:text-flux-300"
            >
              <Minus size={13} />
            </button>
          </Tooltip>
          <Tooltip content="Zoom in" side="left">
            <button
              type="button"
              onClick={() => zoom(-1)}
              aria-label="Zoom in"
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-base-900/70 text-ink-300 backdrop-blur-md transition hover:border-flux-400/40 hover:text-flux-300"
            >
              <Plus size={13} />
            </button>
          </Tooltip>
          <Tooltip content="Reset camera" side="left">
            <button
              type="button"
              onClick={() => {
                setResetSignal((value) => value + 1)
                setSelectedFloor(null)
              }}
              aria-label="Reset camera"
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-base-900/70 text-ink-300 backdrop-blur-md transition hover:border-flux-400/40 hover:text-flux-300"
            >
              <RotateCcw size={13} />
            </button>
          </Tooltip>
        </div>

        {/* ── Floor stack legend ── */}
        {!profile.isMobile ? (
          <FloorLegend
            floors={floors}
            hoveredFloor={hoveredFloor}
            selectedFloor={selectedFloor}
            onHover={setHoveredFloor}
            onSelect={handleSelect}
          />
        ) : null}

        {/* ── Active floor readout ── */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-3 sm:px-4 sm:pb-4">
          <FloorReadout floor={activeFloor} currency={currency} compact={profile.isMobile} />
        </div>

        {!profile.isMobile ? (
          <p className="pointer-events-none absolute bottom-4 right-4 z-20 hidden text-2xs text-ink-600 xl:block">
            Drag to rotate · scroll to zoom · click a floor
          </p>
        ) : null}
      </div>
    </div>
  )
}

/* ── Floor legend ───────────────────────────────────────────── */

interface FloorLegendProps {
  floors: FloorState[]
  hoveredFloor: number | null
  selectedFloor: number | null
  onHover: (index: number | null) => void
  onSelect: (index: number) => void
}

function FloorLegend({ floors, hoveredFloor, selectedFloor, onHover, onSelect }: FloorLegendProps) {
  // Render top floor first so the list reads like the building.
  const ordered = [...floors].reverse()

  return (
    <div className="absolute right-4 top-16 z-20 hidden w-44 rounded-xl border border-white/[0.07] bg-base-900/70 p-2 backdrop-blur-md md:block">
      <p className="px-1.5 pb-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-ink-500">Floor load</p>
      <ul className="space-y-1">
        {ordered.map((floor) => {
          const active = hoveredFloor === floor.index || selectedFloor === floor.index
          return (
            <li key={floor.floorId}>
              <button
                type="button"
                onMouseEnter={() => onHover(floor.index)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(floor.index)}
                onBlur={() => onHover(null)}
                onClick={() => onSelect(floor.index)}
                className={`w-full rounded-lg border px-2 py-1.5 text-left transition duration-200 ${
                  active
                    ? 'border-flux-400/35 bg-flux-500/10'
                    : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs font-semibold text-ink-100">{floor.label}</span>
                  {floor.severity ? (
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider ${
                        floor.severity === 'medium'
                          ? 'text-alert-300'
                          : floor.severity === 'low'
                            ? 'text-flux-300'
                            : 'text-crit-300'
                      }`}
                    >
                      {SEVERITY_LABEL[floor.severity]}
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-watt-300">Normal</span>
                  )}
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ease-spring ${
                      floor.isAnomalous ? 'bg-crit-400/80' : 'bg-flux-400/70'
                    }`}
                    style={{ width: `${Math.round(floor.intensity * 100)}%` }}
                  />
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ── Active floor readout ───────────────────────────────────── */

function FloorReadout({
  floor,
  currency,
  compact,
}: {
  floor: FloorState | null
  currency: string
  compact: boolean
}) {
  if (!floor) {
    return (
      <div className="pointer-events-none rounded-full border border-white/[0.07] bg-base-900/70 px-3.5 py-1.5 text-2xs text-ink-500 backdrop-blur-md">
        {compact ? 'Tap a floor' : 'Hover or click a floor to inspect its load'}
      </div>
    )
  }

  return (
    <div className="pointer-events-none flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-white/[0.08] bg-base-900/75 px-4 py-2 backdrop-blur-md">
      <span className="flex items-center gap-1.5">
        <span className="text-2xs font-semibold text-ink-50">{floor.label}</span>
        {floor.isAnomalous ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-crit-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-crit-300">
            <AlertTriangle size={8} />
            {SEVERITY_LABEL[floor.severity ?? 'medium']}
          </span>
        ) : (
          <span className="rounded-full bg-watt-400/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-watt-300">
            Normal
          </span>
        )}
      </span>

      <Dot className="hidden sm:block" />

      <span className="tnum text-2xs text-ink-300">
        {floor.anomalyCount > 0
          ? `${floor.anomalyCount} anomal${floor.anomalyCount === 1 ? 'y' : 'ies'}`
          : 'No anomalies'}
      </span>

      {floor.excessKwh > 0 ? (
        <>
          <Dot className="hidden sm:block" />
          <span className="tnum text-2xs font-semibold text-crit-300">
            {formatEnergy(floor.excessKwh, 1)} excess
          </span>
          <Dot className="hidden sm:block" />
          <span className="tnum text-2xs font-semibold text-alert-300">
            {formatCurrency(floor.estimatedCost, currency)} est.
          </span>
        </>
      ) : null}

      <Dot className="hidden sm:block" />
      <span className="tnum text-2xs text-ink-400">load {formatNumber(Math.round(floor.intensity * 100))}%</span>
    </div>
  )
}

function Dot({ className }: { className?: string }) {
  return <span className={`h-3 w-px bg-white/10 ${className ?? ''}`} aria-hidden="true" />
}
