import { memo, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

export interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  icon?: ReactNode
  /** Right-aligned controls (filters, export, etc.). */
  actions?: ReactNode
  /** Optional meta row beneath the title. */
  meta?: ReactNode
  className?: string
}

/**
 * Consistent page header: title, subtitle, meta row and actions.
 * Keeps the vertical rhythm identical across every route.
 */
function PageHeaderComponent({ title, subtitle, icon, actions, meta, className }: PageHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex flex-wrap items-start justify-between gap-4', className)}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        {icon ? (
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-flux-400/25 bg-flux-500/10 text-flux-300">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-ink-50 sm:text-xl">{title}</h1>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-400">{subtitle}</p>
          ) : null}
          {meta ? <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </motion.header>
  )
}

export const PageHeader = memo(PageHeaderComponent)