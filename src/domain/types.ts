export type ProjectStatus = 'released' | 'prototype' | 'in-progress' | 'archived'
export type ProjectCategory = 'platform' | 'agents' | 'data' | 'web'
export type RepoVisibility = 'public' | 'private'
export type LinkKind = 'live' | 'repo' | 'doc'

export interface ProjectLink {
  kind: LinkKind
  label: string
  url: string
}

export interface ProjectInput {
  slug: string
  title: string
  tagline: string
  description: string
  highlights: string[]
  tech: string[]
  flow: string[]
  links: ProjectLink[]
  status: ProjectStatus
  category: ProjectCategory
  repoVisibility: RepoVisibility
  featured: boolean
  sortOrder: number
}

export interface Project extends ProjectInput {
  id: number
}

export interface Experience {
  id: number
  role: string
  company: string
  employmentType: string | null
  location: string | null
  startDate: string
  endDate: string | null
  summary: string
  skills: string[]
}

export interface Certificate {
  id: number
  title: string
  issuer: string
  issuedLabel: string
  sortOrder: number
}

export interface Article {
  id: number
  title: string
  publication: string
  topic: string
  summary: string
  url: string
  sortOrder: number
}

export interface Content {
  version: string
  projects: Project[]
  experience: Experience[]
  certificates: Certificate[]
  articles: Article[]
}
