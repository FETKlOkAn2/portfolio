import { fireEvent, render, screen } from '@testing-library/react'
import { Footer } from './Footer'
import { Hero } from './Hero'
import { Nav } from './Nav'
import { Section } from './Section'

describe('Nav', () => {
  it('links to every section and to the CV', () => {
    render(<Nav />)

    for (const [name, href] of [
      ['Projects', '#projects'],
      ['Experience', '#experience'],
      ['Writing', '#writing'],
      ['Certificates', '#certificates'],
      ['Contact', '#contact'],
    ]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
    }
    expect(screen.getByRole('link', { name: 'CV' })).toHaveAttribute(
      'href',
      expect.stringMatching(/cv\/tomas-maxim-cv\.pdf$/),
    )
  })

  it('toggles the menu button state', () => {
    render(<Nav />)
    const button = screen.getByRole('button', { name: 'Menu' })

    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('Hero', () => {
  it('shows the name, role line and both actions', () => {
    render(<Hero />)

    expect(screen.getByRole('heading', { level: 1, name: 'Tomáš Maxim' })).toBeInTheDocument()
    expect(
      screen.getByText('Python Developer · Bratislava, Slovakia · Remote (EU)'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View projects' })).toHaveAttribute('href', '#projects')
    expect(screen.getByRole('link', { name: 'Download CV' })).toHaveAttribute(
      'href',
      expect.stringMatching(/cv\/tomas-maxim-cv\.pdf$/),
    )
  })
})

describe('Section', () => {
  it('labels the region with its heading', () => {
    render(
      <Section id="projects" title="Projects">
        <p>body</p>
      </Section>,
    )

    expect(screen.getByRole('region', { name: 'Projects' })).toHaveAttribute('id', 'projects')
    expect(screen.getByRole('heading', { level: 2, name: 'Projects' })).toBeInTheDocument()
  })
})

describe('Footer', () => {
  it('links to both source repositories', () => {
    render(<Footer />)

    expect(screen.getByRole('link', { name: 'Site source' })).toHaveAttribute(
      'href',
      'https://github.com/FETKlOkAn2/portfolio',
    )
    expect(screen.getByRole('link', { name: 'API source' })).toHaveAttribute(
      'href',
      'https://github.com/FETKlOkAn2/portfolio_backend',
    )
  })
})
