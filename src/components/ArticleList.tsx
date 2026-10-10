import { ArrowUpRight } from 'lucide-react'
import type { Article } from '../domain/types'
import styles from './ArticleList.module.css'

export function ArticleList({ items }: { items: Article[] }) {
  return (
    <ul className={styles.list}>
      {items.map((article) => (
        <li key={article.id}>
          <p className={`mono ${styles.meta}`}>
            {article.publication} · {article.topic}
          </p>
          <h3 className={styles.title}>
            <a href={article.url} target="_blank" rel="noreferrer">
              {article.title}
              <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" className={styles.icon} />
            </a>
          </h3>
          <p className={styles.summary}>{article.summary}</p>
        </li>
      ))}
    </ul>
  )
}
