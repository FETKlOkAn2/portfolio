import { ArrowUpRight, FileText, Lock } from 'lucide-react'
import { ProjectView } from '../domain/ProjectView'
import { isHttpUrl } from '../domain/safeUrl'
import type { Project, ProjectLink } from '../domain/types'
import { BrandIcon } from './BrandIcon'
import { FlowLine } from './FlowLine'
import styles from './ProjectCard.module.css'

function LinkIcon({ link }: { link: ProjectLink }) {
  if (link.kind === 'repo' && link.url.startsWith('https://github.com/')) {
    return <BrandIcon name="github" size={16} />
  }
  if (link.kind === 'doc') {
    return <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
  }
  return <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
}

export function ProjectCard({ project }: { project: Project }) {
  const view = new ProjectView(project)
  const links = project.links.filter((link) => isHttpUrl(link.url))

  return (
    <article className={styles.card} data-featured={project.featured}>
      <header className={`mono ${styles.head}`}>
        <span className={styles.category}>{view.categoryLabel}</span>
        <span className={styles.status} data-status={project.status}>
          {view.statusLabel}
        </span>
      </header>

      <h3 className={styles.title}>{project.title}</h3>
      <p className={styles.tagline}>{project.tagline}</p>
      <p className={styles.description}>{project.description}</p>

      {project.highlights.length > 0 && (
        <ul className={styles.highlights} aria-label="Highlights">
          {project.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      )}

      {project.flow.length > 0 && <FlowLine steps={project.flow} />}

      <ul className={`mono ${styles.tech}`} aria-label="Technologies">
        {project.tech.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>

      {(links.length > 0 || view.showsPrivateNote) && (
        <footer className={styles.links}>
          {links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
              <LinkIcon link={link} />
              {link.label}
            </a>
          ))}
          {view.showsPrivateNote && (
            <span className={styles.private}>
              <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
              Private repo
            </span>
          )}
        </footer>
      )}
    </article>
  )
}
