import { PROFILE } from '../data/profile'
import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p>
          © {new Date().getFullYear()} {PROFILE.name}
        </p>
        <p>
          Built with TypeScript, React, FastAPI and SQLAlchemy. <a href={PROFILE.siteRepo}>Site source</a>
          {' · '}
          <a href={PROFILE.apiRepo}>API source</a>
        </p>
      </div>
    </footer>
  )
}
