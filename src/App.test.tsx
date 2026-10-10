import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the site from the bundled snapshot with the network off', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Tomáš Maxim' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Aptum' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open sandbox' })).toHaveAttribute(
      'href',
      'https://sandbox-aptum.com/practice',
    )
  })
})
