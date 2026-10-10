import { Download, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { PROFILE } from '../data/profile'
import { useActiveSection } from '../hooks/useActiveSection'
import styles from './Nav.module.css'

const LINKS = [
  { id: 'projects', label: 'Projects' },
  { id: 'experience', label: 'Experience' },
  { id: 'writing', label: 'Writing' },
  { id: 'certificates', label: 'Certificates' },
  { id: 'contact', label: 'Contact' },
] as const

const SECTION_IDS = LINKS.map((link) => link.id)

export function Nav() {
  const [open, setOpen] = useState(false)
  const active = useActiveSection(SECTION_IDS)

  return (
    <header className={styles.header}>
      <nav className={`container ${styles.nav}`} aria-label="Primary">
        <a href="#top" className={styles.name}>
          {PROFILE.name}
        </a>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          <span className="visually-hidden">Menu</span>
        </button>
        <ul id="nav-links" className={styles.links} data-open={open}>
          {LINKS.map((link) => (
            <li key={link.id}>
              <a
                href={`#${link.id}`}
                aria-current={active === link.id ? 'true' : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a href={PROFILE.cvUrl} target="_blank" rel="noreferrer" className={styles.cv}>
              <Download size={16} strokeWidth={1.75} aria-hidden="true" />
              CV
            </a>
          </li>
        </ul>
      </nav>
    </header>
  )
}
