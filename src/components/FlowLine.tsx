import { ArrowRight } from 'lucide-react'
import styles from './FlowLine.module.css'

/** A pipeline as text: step, arrow, step. This is how a card shows an agent loop. */
export function FlowLine({ steps }: { steps: string[] }) {
  return (
    <ol className={`mono ${styles.flow}`} aria-label="Pipeline">
      {steps.map((step, index) => (
        <li key={step}>
          {index > 0 && <ArrowRight size={12} aria-hidden="true" className={styles.arrow} />}
          {step}
        </li>
      ))}
    </ol>
  )
}
