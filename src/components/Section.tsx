import type { ReactNode } from 'react'
import styles from './Section.module.css'

export function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        <h2 id={`${id}-title`} className={styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </section>
  )
}
