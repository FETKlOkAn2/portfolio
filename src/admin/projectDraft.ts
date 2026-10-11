import type {
  Project,
  ProjectCategory,
  ProjectInput,
  ProjectLink,
  ProjectStatus,
  RepoVisibility,
} from '../domain/types'

/** A project as the form holds it: lists are text with one entry per line. */
export interface ProjectDraft {
  slug: string
  title: string
  tagline: string
  description: string
  highlights: string
  tech: string
  flow: string
  links: ProjectLink[]
  status: ProjectStatus
  category: ProjectCategory
  repoVisibility: RepoVisibility
  featured: boolean
  sortOrder: string
}

export const EMPTY_DRAFT: ProjectDraft = {
  slug: '',
  title: '',
  tagline: '',
  description: '',
  highlights: '',
  tech: '',
  flow: '',
  links: [],
  status: 'prototype',
  category: 'platform',
  repoVisibility: 'public',
  featured: false,
  sortOrder: '100',
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

export function toDraft(project: Project): ProjectDraft {
  return {
    slug: project.slug,
    title: project.title,
    tagline: project.tagline,
    description: project.description,
    highlights: project.highlights.join('\n'),
    tech: project.tech.join('\n'),
    flow: project.flow.join('\n'),
    links: project.links.map((link) => ({ ...link })),
    status: project.status,
    category: project.category,
    repoVisibility: project.repoVisibility,
    featured: project.featured,
    sortOrder: String(project.sortOrder),
  }
}

export function fromDraft(draft: ProjectDraft): ProjectInput {
  const sortOrder = Number.parseInt(draft.sortOrder, 10)
  return {
    slug: draft.slug.trim(),
    title: draft.title.trim(),
    tagline: draft.tagline.trim(),
    description: draft.description.trim(),
    highlights: lines(draft.highlights),
    tech: lines(draft.tech),
    flow: lines(draft.flow),
    links: draft.links
      .map((link) => ({ kind: link.kind, label: link.label.trim(), url: link.url.trim() }))
      .filter((link) => link.url !== ''),
    status: draft.status,
    category: draft.category,
    repoVisibility: draft.repoVisibility,
    featured: draft.featured,
    sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
  }
}
