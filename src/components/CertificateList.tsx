import { Award } from 'lucide-react'
import type { Certificate } from '../domain/types'
import styles from './CertificateList.module.css'

export function CertificateList({ items }: { items: Certificate[] }) {
  return (
    <ul className={styles.list}>
      {items.map((certificate) => (
        <li key={certificate.id} className={styles.item}>
          <Award size={18} strokeWidth={1.75} aria-hidden="true" className={styles.icon} />
          <div>
            <h3 className={styles.title}>{certificate.title}</h3>
            <p className={styles.meta}>
              {certificate.issuer} <span className="mono">· {certificate.issuedLabel}</span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
