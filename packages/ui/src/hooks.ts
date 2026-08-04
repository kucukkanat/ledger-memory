import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from './api.ts'

export type Toast = {
  readonly message: string
  readonly tone: 'ok' | 'error'
} | null

/**
 * Toasts, and the single place an API failure becomes visible.
 *
 * The server's explanations are written for a human, so they are shown
 * verbatim. Swallowing them into "something went wrong" would throw away the
 * only part of the error that helps.
 */
export const useToast = () => {
  const [toast, setToast] = useState<Toast>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ message, tone })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), tone === 'error' ? 6000 : 2600)
  }, [])

  const report = useCallback(
    (error: unknown) => {
      show(error instanceof ApiError ? error.message : String(error), 'error')
    },
    [show],
  )

  useEffect(() => () => clearTimeout(timer.current), [])

  return { toast, show, report }
}

export type Loadable<T> = {
  readonly data: T | null
  readonly loading: boolean
  readonly error: string | null
  readonly reload: () => void
}

/** Fetch on mount and whenever `deps` change, with a manual reload handle. */
export const useLoad = <T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  onError?: (error: unknown) => void,
): Loadable<T> => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const latest = useRef(0)

  // `load` and `onError` are recreated on every render by callers passing inline
  // arrows, so depending on them would loop forever. `deps` is the caller's
  // explicit contract for when to refetch, and `nonce` is the manual reload
  // trigger — deliberately referenced nowhere in the body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are the caller's contract
  useEffect(() => {
    const ticket = ++latest.current
    setLoading(true)
    load()
      .then((value) => {
        // Ignore a response that a newer request has already superseded.
        if (ticket !== latest.current) return
        setData(value)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (ticket !== latest.current) return
        setError(cause instanceof ApiError ? cause.message : String(cause))
        onError?.(cause)
      })
      .finally(() => {
        if (ticket === latest.current) setLoading(false)
      })
  }, [...deps, nonce])

  return {
    data,
    loading,
    error,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  }
}

/** Debounce a rapidly-changing value — the search box, mainly. */
export const useDebounced = <T>(value: T, ms = 180): T => {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

/**
 * Window-level keyboard shortcuts.
 *
 * Ignores events from text inputs — typing "d" in the search box must not drop
 * the focused memory.
 */
export const useKeys = (handler: (key: string, event: KeyboardEvent) => void, active = true) => {
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      handler(event.key.length === 1 ? event.key.toLowerCase() : event.key, event)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handler, active])
}

/** Element size, for the canvas. */
export const useSize = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}
