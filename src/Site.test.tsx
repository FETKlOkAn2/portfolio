import { render, screen, within } from '@testing-library/react'
import type { ContentResult } from './api/ApiClient'
import { Site } from './Site'
import { ContentStore } from './state/ContentStore'
import { makeContent, makeProject } from './test/fixtures'

function storeAnswering(answer: () => Promise<ContentResult>) {
  return new ContentStore(makeContent(), { getContent: answer })
}

describe('Site', () => {
  it('renders every section from the content it starts with', () => {
    render(<Site store={storeAnswering(async () => ({ changed: false }))} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Tomáš Maxim' })).toBeInTheDocument()
    for (const title of ['Projects', 'Experience', 'Writing', 'Certificates', 'Contact']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { level: 3, name: 'Demo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Software Engineer' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /A post/ })).toHaveAttribute(
      'href',
      'https://medium.com/post',
    )
    expect(screen.getByRole('heading', { level: 3, name: 'CCNA 1' })).toBeInTheDocument()
  })

  it('shows the date range and length of a current role', () => {
    render(<Site store={storeAnswering(async () => ({ changed: false }))} />)
    const experience = screen.getByRole('region', { name: 'Experience' })

    expect(within(experience).getByText('Jul 2026 – Present')).toBeInTheDocument()
    expect(within(experience).getByText('Iron Mountain')).toBeInTheDocument()
  })

  it('lists five contact links with visible values', () => {
    render(<Site store={storeAnswering(async () => ({ changed: false }))} />)
    const contact = screen.getByRole('region', { name: 'Contact' })

    expect(within(contact).getAllByRole('link')).toHaveLength(5)
    expect(within(contact).getByRole('link', { name: /tomas\.maxim33@gmail\.com/ })).toHaveAttribute(
      'href',
      'mailto:tomas.maxim33@gmail.com',
    )
  })

  it('swaps in newer content when the API answers', async () => {
    const fresh = makeContent({
      version: 'v2',
      projects: [makeProject({ id: 2, slug: 'fresh', title: 'Fresh project' })],
    })
    render(<Site store={storeAnswering(async () => ({ changed: true, content: fresh }))} />)

    expect(await screen.findByRole('heading', { level: 3, name: 'Fresh project' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Demo' })).not.toBeInTheDocument()
  })

  it('keeps rendering its starting content when the API is down', async () => {
    const store = storeAnswering(async () => {
      throw new Error('offline')
    })
    render(<Site store={store} />)

    await store.revalidate()

    expect(screen.getByRole('heading', { level: 3, name: 'Demo' })).toBeInTheDocument()
  })

  it('offers a skip link to the main content', () => {
    render(<Site store={storeAnswering(async () => ({ changed: false }))} />)

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })
})
