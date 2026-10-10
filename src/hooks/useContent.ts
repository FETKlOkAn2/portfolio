import { useEffect, useSyncExternalStore } from 'react'
import type { Content } from '../domain/types'
import type { ContentStore } from '../state/ContentStore'

/** Renders from the store at once, then asks the API for anything newer. */
export function useContent(store: ContentStore): Content {
  const content = useSyncExternalStore(store.subscribe, store.getSnapshot)

  useEffect(() => {
    void store.revalidate()
  }, [store])

  return content
}
