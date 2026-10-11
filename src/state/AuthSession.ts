type TokenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

interface StoredSession {
  token: string
  expiresAt: number
}

function isStoredSession(value: unknown): value is StoredSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    'token' in value &&
    typeof value.token === 'string' &&
    'expiresAt' in value &&
    typeof value.expiresAt === 'number'
  )
}

/** Keeps the admin token for the life of the browser tab, and no longer than the API allows. */
export class AuthSession {
  static readonly KEY = 'portfolio.admin.session'

  private readonly storage: TokenStorage
  private readonly now: () => number

  constructor(storage: TokenStorage, now: () => number = () => Date.now()) {
    this.storage = storage
    this.now = now
  }

  get token(): string | null {
    const raw = this.storage.getItem(AuthSession.KEY)
    if (raw === null) return null
    try {
      const stored: unknown = JSON.parse(raw)
      if (isStoredSession(stored) && stored.expiresAt > this.now()) return stored.token
    } catch {
      // Unreadable storage counts as signed out.
    }
    this.clear()
    return null
  }

  save(accessToken: string, expiresInSeconds: number): void {
    const session: StoredSession = {
      token: accessToken,
      expiresAt: this.now() + expiresInSeconds * 1000,
    }
    this.storage.setItem(AuthSession.KEY, JSON.stringify(session))
  }

  clear(): void {
    this.storage.removeItem(AuthSession.KEY)
  }
}
