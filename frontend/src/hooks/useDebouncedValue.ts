import { useEffect, useRef, useState } from 'react'

/** Debounces a rapidly-changing value (search boxes, sliders, range pickers). */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}

/** Returns a debounced callback. */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay = 350,
): (...args: A) => void {
  const timerRef = useRef<number | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  return (...args: A) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => callbackRef.current(...args), delay)
  }
}
