import { DateRange } from '../domain/DateRange'
import type { Experience } from '../domain/types'
import styles from './ExperienceTimeline.module.css'

export function ExperienceTimeline({ items }: { items: Experience[] }) {
  return (
    <ol className={styles.timeline}>
      {items.map((item) => {
        const range = new DateRange(item.startDate, item.endDate)
        const meta = [item.employmentType, item.location].filter(Boolean).join(' · ')

        return (
          <li key={item.id} className={styles.item} data-current={range.isCurrent}>
            <p className={`mono ${styles.when}`}>
              <span>{range.label()}</span>
              <span className={styles.duration}>{range.duration()}</span>
            </p>
            <div className={styles.body}>
              <h3 className={styles.role}>{item.role}</h3>
              <p>
                <span>{item.company}</span>
                {meta !== '' && <span className={styles.meta}> · {meta}</span>}
              </p>
              {item.summary !== '' && <p className={styles.summary}>{item.summary}</p>}
              {item.skills.length > 0 && (
                <ul className={`mono ${styles.skills}`} aria-label="Skills">
                  {item.skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
