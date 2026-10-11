import { useState } from 'react'
import { ApiError } from '../api/ApiClient'
import { apiClient, authSession } from '../state/container'
import styles from './Admin.module.css'
import { useSlowNotice } from './useSlowNotice'

export function LoginForm({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const slow = useSlowNotice(pending)

  async function signIn() {
    setPending(true)
    setError(null)
    try {
      const { accessToken, expiresIn } = await apiClient.login(password)
      authSession.save(accessToken, expiresIn)
      onSignedIn(accessToken)
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'The API did not answer. Try again in a minute.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className={styles.login}
      onSubmit={(event) => {
        event.preventDefault()
        void signIn()
      }}
    >
      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <div>
        <button type="submit" className={styles.button} disabled={pending}>
          Sign in
        </button>
      </div>
      {slow && <p className={styles.notice}>Waking the API. The first request can take a minute.</p>}
      {error !== null && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  )
}
