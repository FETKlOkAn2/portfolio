// @vitest-environment node
import { AuthSession } from './AuthSession'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    values,
  }
}

describe('AuthSession', () => {
  it('has no token before anyone signs in', () => {
    expect(new AuthSession(memoryStorage()).token).toBeNull()
  })

  it('returns a saved token until it expires', () => {
    let now = 1_000_000
    const session = new AuthSession(memoryStorage(), () => now)

    session.save('tok', 1800)
    expect(session.token).toBe('tok')

    now += 1800 * 1000
    expect(session.token).toBeNull()
  })

  it('removes an expired token from storage', () => {
    let now = 0
    const storage = memoryStorage()
    const session = new AuthSession(storage, () => now)
    session.save('tok', 60)

    now = 61_000
    void session.token

    expect(storage.values.size).toBe(0)
  })

  it('forgets the token on clear', () => {
    const session = new AuthSession(memoryStorage())
    session.save('tok', 1800)

    session.clear()

    expect(session.token).toBeNull()
  })

  it('treats corrupt storage as signed out', () => {
    const storage = memoryStorage()
    storage.setItem(AuthSession.KEY, '{not json')

    expect(new AuthSession(storage).token).toBeNull()
    expect(storage.values.size).toBe(0)
  })
})
