import { render, screen, within } from '@testing-library/react'
import { makeProject } from '../test/fixtures'
import { ProjectCard } from './ProjectCard'
import { ProjectGrid } from './ProjectGrid'

describe('ProjectCard', () => {
  it('shows the title, tagline, description and labels', () => {
    render(<ProjectCard project={makeProject({ status: 'prototype', category: 'agents' })} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Demo' })).toBeInTheDocument()
    expect(screen.getByText('A demo project.')).toBeInTheDocument()
    expect(screen.getByText('Longer text about the demo.')).toBeInTheDocument()
    expect(screen.getByText('Agent system')).toBeInTheDocument()
    expect(screen.getByText('Prototype')).toBeInTheDocument()
  })

  it('lists the pipeline steps in order', () => {
    render(<ProjectCard project={makeProject({ flow: ['draft', 'critique', 'revise'] })} />)

    const steps = within(screen.getByRole('list', { name: 'Pipeline' })).getAllByRole('listitem')

    expect(steps.map((step) => step.textContent)).toEqual(['draft', 'critique', 'revise'])
  })

  it('leaves the pipeline and highlights out when a project has none', () => {
    render(<ProjectCard project={makeProject({ flow: [], highlights: [] })} />)

    expect(screen.queryByRole('list', { name: 'Pipeline' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Highlights' })).not.toBeInTheDocument()
  })

  it('lists the technologies', () => {
    render(<ProjectCard project={makeProject({ tech: ['Python', 'Redis'] })} />)

    const tech = within(screen.getByRole('list', { name: 'Technologies' })).getAllByRole('listitem')

    expect(tech.map((item) => item.textContent)).toEqual(['Python', 'Redis'])
  })

  it('opens links in a new tab without leaking the opener', () => {
    const project = makeProject({
      links: [{ kind: 'live', label: 'Open sandbox', url: 'https://sandbox-aptum.com/practice' }],
    })
    render(<ProjectCard project={project} />)

    const link = screen.getByRole('link', { name: 'Open sandbox' })

    expect(link).toHaveAttribute('href', 'https://sandbox-aptum.com/practice')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('says the repo is private when there is no repo link to show', () => {
    render(<ProjectCard project={makeProject({ repoVisibility: 'private', links: [] })} />)

    expect(screen.getByText('Private repo')).toBeInTheDocument()
  })

  it('does not mention privacy on a public project', () => {
    render(<ProjectCard project={makeProject()} />)

    expect(screen.queryByText('Private repo')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Source' })).toBeInTheDocument()
  })
})

describe('ProjectGrid', () => {
  it('renders one card per project, in the order given', () => {
    const projects = [
      makeProject({ id: 1, slug: 'a', title: 'First' }),
      makeProject({ id: 2, slug: 'b', title: 'Second' }),
    ]
    render(<ProjectGrid projects={projects} />)

    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

    expect(titles).toEqual(['First', 'Second'])
  })
})
