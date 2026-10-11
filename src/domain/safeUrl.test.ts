// @vitest-environment node
import { isHttpUrl } from './safeUrl'

describe('isHttpUrl', () => {
  it.each(['https://example.com/a', 'http://localhost:8000'])('accepts %s', (url) => {
    expect(isHttpUrl(url)).toBe(true)
  })

  it.each(['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', '/relative', '', 'mailto:a@b.c'])(
    'rejects %j',
    (url) => {
      expect(isHttpUrl(url)).toBe(false)
    },
  )
})
