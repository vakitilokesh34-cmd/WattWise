import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { forwardRef, useId } from 'react'
import { cn } from '@/utils/cn'

const FIELD_BASE =
  'w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-sm text-ink-100 placeholder:text-ink-500 transition duration-200 hover:border-white/[0.14] focus:border-flux-400/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-flux-400/40 disabled:cursor-not-allowed disabled:opacity-50'

interface FieldShellProps {
  label?: string
  hint?: ReactNode
  error?: string
  children: ReactNode
  className?: string
  htmlFor?: string
}

export function FieldShell({ label, hint, error, children, className, htmlFor }: FieldShellProps) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="label-muted mb-1.5 block">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 text-2xs text-crit-300">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-2xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  )
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: ReactNode
  error?: string
  wrapperClassName?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, wrapperClassName, children, id, ...rest },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      className={wrapperClassName}
      htmlFor={selectId}
    >
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            FIELD_BASE,
            'h-10 cursor-pointer appearance-none pr-9 [&>option]:bg-base-800 [&>option]:text-ink-100',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500"
        >
          <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    </FieldShell>
  )
})

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: ReactNode
  error?: string
  wrapperClassName?: string
  iconLeft?: ReactNode
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, error, className, wrapperClassName, iconLeft, id, ...rest },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <FieldShell label={label} hint={hint} error={error} className={wrapperClassName} htmlFor={inputId}>
      <div className="relative">
        {iconLeft ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">
            {iconLeft}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(FIELD_BASE, 'h-10', iconLeft ? 'pl-9' : undefined, className)}
          {...rest}
        />
      </div>
    </FieldShell>
  )
})

export interface NumberSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
  className?: string
}

export function NumberSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  className,
}: NumberSliderProps) {
  const id = useId()
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="label-muted">
          {label}
        </label>
        <span className="tnum text-2xs font-semibold text-ink-200">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none
          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-flux-300
          [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(34,211,238,0.18)]
          [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-flux-300"
        style={{
          background: `linear-gradient(90deg, rgba(34,211,238,0.75) 0%, rgba(34,211,238,0.75) ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.08) 100%)`,
        }}
      />
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4 py-1',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-100">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-400">{description}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition duration-300 ease-spring',
          checked
            ? 'border-flux-400/50 bg-flux-500/70 shadow-[0_0_14px_-3px_rgba(34,211,238,0.8)]'
            : 'border-white/10 bg-white/[0.07]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-ink-50 shadow transition-all duration-300 ease-spring',
            checked ? 'left-[1.15rem]' : 'left-0.5',
          )}
        />
      </button>
    </label>
  )
}
