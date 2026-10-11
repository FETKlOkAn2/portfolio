import { Download } from 'lucide-react'
import { PROFILE } from '../data/profile'
import styles from './Hero.module.css'

export function Hero() {
  return (
    <section id="top" className={styles.hero}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.copy}>
          <p className={`mono ${styles.eyebrow}`}>{PROFILE.eyebrow}</p>
          <h1 className={styles.name}>{PROFILE.name}</h1>
          <p className={styles.summary}>{PROFILE.summary}</p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#projects">
              View projects
            </a>
            <a className={styles.secondary} href={PROFILE.cvUrl} target="_blank" rel="noreferrer">
              <Download size={16} strokeWidth={1.75} aria-hidden="true" />
              Download CV
            </a>
          </div>
        </div>
        <img className={styles.avatar} src={PROFILE.avatarUrl} alt="" width={128} height={128} />
      </div>
    </section>
  )
}
