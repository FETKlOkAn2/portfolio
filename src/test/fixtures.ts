import type { Content, Project } from '../domain/types'

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    slug: 'demo',
    title: 'Demo',
    tagline: 'A demo project.',
    description: 'Longer text about the demo.',
    highlights: ['First highlight'],
    tech: ['Python', 'FastAPI'],
    flow: ['draft', 'critique', 'revise'],
    links: [{ kind: 'repo', label: 'Source', url: 'https://github.com/example/demo' }],
    status: 'released',
    category: 'platform',
    repoVisibility: 'public',
    featured: false,
    sortOrder: 10,
    ...overrides,
  }
}

export function makeContent(overrides: Partial<Content> = {}): Content {
  return {
    version: 'v1',
    projects: [makeProject()],
    experience: [
      {
        id: 1,
        role: 'Software Engineer',
        company: 'Iron Mountain',
        employmentType: 'Full-time',
        location: 'Bratislava, Slovakia · Remote',
        startDate: '2026-07-01',
        endDate: null,
        summary: '',
        skills: [],
      },
    ],
    certificates: [
      { id: 1, title: 'CCNA 1', issuer: 'Cisco', issuedLabel: '2023', sortOrder: 10 },
    ],
    articles: [
      {
        id: 1,
        title: 'A post',
        publication: 'Medium',
        topic: 'Engineering',
        summary: 'About a thing.',
        url: 'https://medium.com/post',
        sortOrder: 10,
      },
    ],
    ...overrides,
  }
}
