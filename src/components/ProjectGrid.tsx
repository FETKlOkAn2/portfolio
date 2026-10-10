import type { Project } from '../domain/types'
import { ProjectCard } from './ProjectCard'
import styles from './ProjectGrid.module.css'

export function ProjectGrid({ projects }: { projects: Project[] }) {
  return (
    <div className={styles.grid}>
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
