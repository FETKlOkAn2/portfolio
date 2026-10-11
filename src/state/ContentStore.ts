import type { ContentResult } from '../api/ApiClient'
import type { Content } from '../domain/types'

type Listener = () => void

export interface ContentSource {
  getContent(knownVersion?: string): Promise<ContentResult>
}

/**
 * Holds the content the page renders. It starts from the bundled snapshot,
 * and `revalidate` replaces it only when the source has a newer version.
 * A failed or slow source never changes what the visitor sees.
 */
export class ContentStore {
  private content: Content
  private readonly source: ContentSource
  private readonly listeners = new Set<Listener>()

  constructor(initial: Content, source: ContentSource) {
    this.content = initial
    this.source = source
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): Content => this.content

  async revalidate(): Promise<boolean> {
    let result: ContentResult
    try {
      result = await this.source.getContent(this.content.version)
    } catch {
      return false
    }
    if (!result.changed || result.content.version === this.content.version) return false
    this.content = result.content
    for (const listener of this.listeners) listener()
    return true
  }
}
