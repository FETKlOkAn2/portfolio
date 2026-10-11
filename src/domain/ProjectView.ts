import type { Project, ProjectCategory, ProjectStatus } from './types'

const STATUS_LABELS: Record<ProjectStatus, string> = {
  released: 'Released',
  prototype: 'Prototype',
  'in-progress': 'In progress',
  archived: 'Archived',
}

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  platform: 'Platform',
  agents: 'Agent system',
  data: 'Data pipeline',
  web: 'Web app',
}

/** Everything a card derives from a project, kept out of the component. */
export class ProjectView {
  readonly project: Project

  constructor(project: Project) {
    this.project = project
  }

  get statusLabel(): string {
    return STATUS_LABELS[this.project.status]
  }

  get categoryLabel(): string {
    return CATEGORY_LABELS[this.project.category]
  }

  get showsPrivateNote(): boolean {
    const hasRepoLink = this.project.links.some((link) => link.kind === 'repo')
    return this.project.repoVisibility === 'private' && !hasRepoLink
  }
}
