import { Mail, Phone } from 'lucide-react'
import { CONTACTS, PROFILE } from '../data/profile'
import type { ContactKind } from '../data/profile'
import { BrandIcon } from './BrandIcon'
import styles from './ContactLinks.module.css'

function ContactIcon({ kind }: { kind: ContactKind }) {
  switch (kind) {
    case 'email':
      return <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
    case 'phone':
      return <Phone size={18} strokeWidth={1.75} aria-hidden="true" />
    case 'linkedin':
      return <BrandIcon name="linkedin" />
    case 'github':
      return <BrandIcon name="github" />
    case 'instagram':
      return <BrandIcon name="instagram" />
  }
}

export function ContactLinks() {
  return (
    <>
      <p className={styles.intro}>{PROFILE.contactLine}</p>
      <ul className={styles.list}>
        {CONTACTS.map((contact) => {
          const external = contact.href.startsWith('http')
          return (
            <li key={contact.kind}>
              <a
                className={styles.link}
                href={contact.href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
              >
                <span className={styles.icon}>
                  <ContactIcon kind={contact.kind} />
                </span>
                <span>{contact.label}</span>
                <span className={`mono ${styles.value}`}>{contact.value}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </>
  )
}
