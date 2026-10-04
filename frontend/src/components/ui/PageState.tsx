import type { ReactNode } from 'react'
import { EmptyState, ErrorState } from './States'
import { cn } from '@/utils/cn'

interface PageStateProps {
  isLoading: boolean
  error?: unknown
  /** Skeleton shown while loading. */
  skeleton?: ReactNode
  children: ReactNode
  /** When true and there is no error, render the empty state instead of children. */
  isEmpty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: ReactNode
  emptyAction?: ReactNode
  onRetry?: () => void
  className?: string
}

/**
 * Single place that decides between skeleton / error / empty / content.
 * Guarantees every panel has realistic loading, error and empty states (§17).
 */
export function PageState({
  isLoading,
  error,
  skeleton,
  children,
  isEmpty = false,
  emptyTitle = 'No data in this window',
  emptyDescription = 'Try widening the date range or clearing the active filters.',
  emptyIcon,
  emptyAction,
  onRetry,
  className,
}: PageStateProps) {
  if (isLoading) {
    return <div className={className}>{skeleton ?? <div className="glass h-64 animate-pulse" />}</div>
  }

  if (error) {
    return (
      <div className={className}>
        <ErrorState error={error as Error} onRetry={onRetry} />
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className={className}>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          icon={emptyIcon}
          action={emptyAction}
        />
      </div>
    )
  }

  return <div className={cn('animate-fade-up', className)}>{children}</div>
}
