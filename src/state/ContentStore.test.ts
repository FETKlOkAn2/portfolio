// @vitest-environment node
import type { ContentResult } from '../api/ApiClient'
import { makeContent } from '../test/fixtures'
import { ContentStore } from './ContentStore'

function storeAnswering(answer: () => Promise<ContentResult>) {
  const source = { getContent: vi.fn(answer) }
  const store = new ContentStore(makeContent({ version: 'v1' }), source)
  const listener = vi.fn()
  store.subscribe(listener)
  return { store, source, listener }
}

describe('ContentStore', () => {
  it('starts from the content it was given', () => {
    const { store } = storeAnswering(async () => ({ changed: false }))

    expect(store.getSnapshot().version).toBe('v1')
  })

  it('asks the source with its current version', async () => {
    const { store, source } = storeAnswering(async () => ({ changed: false }))

    await store.revalidate()

    expect(source.getContent).toHaveBeenCalledWith('v1')
  })

  it('keeps its content and stays quiet on "unchanged"', async () => {
    const { store, listener } = storeAnswering(async () => ({ changed: false }))

    expect(await store.revalidate()).toBe(false)
    expect(listener).not.toHaveBeenCalled()
    expect(store.getSnapshot().version).toBe('v1')
  })

  it('replaces its content and notifies on a new version', async () => {
    const fresh = makeContent({ version: 'v2', projects: [] })
    const { store, listener } = storeAnswering(async () => ({ changed: true, content: fresh }))

    expect(await store.revalidate()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toBe(fresh)
  })

  it('ignores a 200 that carries the version it already has', async () => {
    const same = makeContent({ version: 'v1' })
    const { store, listener } = storeAnswering(async () => ({ changed: true, content: same }))

    expect(await store.revalidate()).toBe(false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps its content when the source fails', async () => {
    const { store, listener } = storeAnswering(async () => {
      throw new Error('offline')
    })

    expect(await store.revalidate()).toBe(false)
    expect(listener).not.toHaveBeenCalled()
    expect(store.getSnapshot().version).toBe('v1')
  })

  it('stops notifying a listener that unsubscribed', async () => {
    const fresh = makeContent({ version: 'v2' })
    const source = { getContent: async (): Promise<ContentResult> => ({ changed: true, content: fresh }) }
    const store = new ContentStore(makeContent({ version: 'v1' }), source)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    await store.revalidate()

    expect(listener).not.toHaveBeenCalled()
  })
})
