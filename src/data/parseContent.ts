import type { Content } from '../domain/types'

const SECTIONS = ['projects', 'experience', 'certificates', 'articles'] as const

/** Guards every payload that enters the app: the bundled snapshot and API responses alike. */
export function parseContent(raw: unknown): Content {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Content payload is not an object')
  }
  const record = raw as Record<string, unknown>
  if (typeof record.version !== 'string' || record.version === '') {
    throw new Error('Content payload has no version')
  }
  for (const section of SECTIONS) {
    if (!Array.isArray(record[section])) {
      throw new Error(`Content payload is missing "${section}"`)
    }
  }
  return raw as Content
}
