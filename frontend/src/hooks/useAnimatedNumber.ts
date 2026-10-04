import { useEffect, useRef, useState } from 'react'
import { apiConfig } from '@/services/config'

const easeOutExpo = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

export interface AnimatedNumberOptions {
  durationMs?: number
  enabled?: boolean
  /** Rendered when the value is not finite. */
  fallback?: string
}

/**
 * Eases a number towards its target using requestAnimationFrame.
 * Falls back to the target immediately when animations are disabled or the
 * user prefers reduced motion.
 */
export function useAnimatedNumber(
  target: number,
  { durationMs = 900, enabled = true }: AnimatedNumberOptions = {},
): number {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const shouldAnimate = enabled && apiConfig.scene.animationsEnabled && !prefersReducedMotion

  const [display, setDisplay] = useState(() => (Number.isFinite(target) ? target : 0))
  const frameRef = useRef<number | null>(null)
  const fromRef = useRef(target)
  const startRef = useRef(0)
  const displayRef = useRef(display)

  const commit = (value: number) => {
    displayRef.current = value
    setDisplay(value)
  }

  useEffect(() => {
    if (!Number.isFinite(target)) return

    if (!shouldAnimate) {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      commit(target)
      fromRef.current = target
      return
    }

    const from = fromRef.current
    if (Math.abs(from - target) < 0.0001) {
      commit(target)
      return
    }

    startRef.current = performance.now()

    const step = (now: number) => {
      const progress = Math.min(1, (now - startRef.current) / durationMs)
      const eased = easeOutExpo(progress)
      const next = from + (target - from) * eased
      commit(next)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = target
        frameRef.current = null
      }
    }

    frameRef.current = requestAnimationFrame(step)

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      // Resume the next tween from wherever we stopped.
      fromRef.current = displayRef.current
    }
  }, [target, durationMs, shouldAnimate])

  return display
}
