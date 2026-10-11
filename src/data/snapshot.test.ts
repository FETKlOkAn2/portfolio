// @vitest-environment node
import { parseContent } from './parseContent'
import rawSnapshot from './snapshot.json'

describe('bundled snapshot', () => {
  const content = parseContent(rawSnapshot)

  it('carries every section the page renders', () => {
    expect(content.projects.length).toBeGreaterThanOrEqual(7)
    expect(content.experience.length).toBeGreaterThanOrEqual(4)
    expect(content.certificates.length).toBeGreaterThanOrEqual(6)
    expect(content.articles.length).toBeGreaterThanOrEqual(2)
  })

  it('leads with Aptum and its sandbox link', () => {
    const first = content.projects[0]

    expect(first.slug).toBe('aptum')
    expect(first.links[0].url).toBe('https://sandbox-aptum.com/practice')
  })

  it('contains no em dashes', () => {
    expect(JSON.stringify(content)).not.toContain('\u2014')
  })
})
