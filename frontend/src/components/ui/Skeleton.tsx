import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type SkeletonProps = HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, style, ...rest }: SkeletonProps) {
  return <div className={cn('skeleton', className)} style={style} aria-hidden="true" {...rest} />
}

/** KPI card placeholder that mirrors the real card's geometry to avoid layout shift. */
export function KpiSkeleton() {
  return (
    <div className="glass p-5">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
      <Skeleton className="mt-2 h-2.5 w-2/3 rounded-full" />
    </div>
  )
}

export function ChartSkeleton({ height = 320 }: { height?: number }) {
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-44" />
          <Skeleton className="h-2.5 w-28" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="mt-6 flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 28 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            // deterministic varied heights read as a chart, not a bar chart
            style={{ height: `${28 + ((i * 37) % 68)}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass space-y-3 p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-7 w-24" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-2.5 w-full rounded-full" />
      ))}
    </div>
  )
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={2} />
      ))}
    </div>
  )
}
