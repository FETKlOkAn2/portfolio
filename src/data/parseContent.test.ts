// @vitest-environment node
import { parseContent } from './parseContent'

const valid = { version: 'abc', projects: [], experience: [], certificates: [], articles: [] }

describe('parseContent', () => {
  it('returns a well-formed payload unchanged', () => {
    expect(parseContent(valid)).toBe(valid)
  })

  it.each([
    ['null', null],
    ['a string', '<html>Service unavailable</html>'],
    ['an array', []],
    ['a payload with no version', { ...valid, version: undefined }],
    ['a payload with an empty version', { ...valid, version: '' }],
    ['a payload missing a section', { ...valid, articles: undefined }],
    ['a payload whose section is not a list', { ...valid, projects: {} }],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseContent(raw)).toThrow()
  })
})
