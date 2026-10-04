import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-flux-500/90 text-base-950 font-semibold hover:bg-flux-400 shadow-[0_10px_30px_-12px_rgba(34,211,238,0.7)] disabled:hover:bg-flux-500/90',
  secondary:
    'bg-white/[0.06] text-ink-100 border border-white/10 hover:bg-white/[0.1] hover:border-white/20',
  outline:
    'bg-transparent text-ink-200 border border-white/12 hover:border-flux-400/40 hover:text-ink-50 hover:bg-flux-500/5',
  ghost: 'bg-transparent text-ink-300 hover:bg-white/[0.06] hover:text-ink-50',
  danger: 'bg-crit-500/90 text-white font-semibold hover:bg-crit-500 disabled:hover:bg-crit-500',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-sm gap-2.5 rounded-xl',
  icon: 'h-9 w-9 rounded-lg justify-center',
}

interface BaseProps {
  variant?: Variant
  size?: Size
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
  className?: string
  children?: ReactNode
}

export interface ButtonProps extends BaseProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {}

function classes({ variant = 'secondary', size = 'md', fullWidth, className }: BaseProps) {
  return cn(
    'relative inline-flex items-center font-medium transition duration-200 ease-spring select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-base-950',
    'disabled:opacity-45 disabled:cursor-not-allowed disabled:saturate-50',
    'active:scale-[0.985]',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full justify-center',
    className,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    size,
    loading = false,
    iconLeft,
    iconRight,
    fullWidth,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={classes({ variant, size, fullWidth, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 'md' : 'sm'} /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  )
})

export interface ButtonLinkProps extends BaseProps {
  to: string
  state?: unknown
  onClick?: () => void
  'aria-label'?: string
  title?: string
}

/** Router-aware button so navigation keeps client-side routing (no full reload). */
export function ButtonLink({
  to,
  state,
  onClick,
  variant,
  size,
  iconLeft,
  iconRight,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      to={to}
      state={state}
      onClick={onClick}
      className={classes({ variant, size, fullWidth, className })}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </Link>
  )
}
