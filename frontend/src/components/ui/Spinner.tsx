import { cn } from '@/utils/cn'

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

export function Spinner({ size = 'sm', className }: { size?: SpinnerSize; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[none]',
        SIZES[size],
        className,
      )}
    />
  )
}
