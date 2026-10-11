import { useEffect, useState } from 'react'

/** True once `pending` has lasted `delayMs`. The free API tier sleeps, so the first call can take a minute. */
export function useSlowNotice(pending: boolean, delayMs = 3000): boolean {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!pending) return
    const timer = window.setTimeout(() => setSlow(true), delayMs)
    return () => {
      window.clearTimeout(timer)
      setSlow(false)
    }
  }, [pending, delayMs])

  return pending && slow
}
