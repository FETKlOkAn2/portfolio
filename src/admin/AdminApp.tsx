import { useCallback, useState } from 'react'
import { authSession } from '../state/container'
import styles from './Admin.module.css'
import { LoginForm } from './LoginForm'
import { ProjectAdmin } from './ProjectAdmin'

export default function AdminApp() {
  const [token, setToken] = useState<string | null>(() => authSession.token)

  const signOut = useCallback(() => {
    authSession.clear()
    setToken(null)
  }, [])

  return (
    <main className={`container ${styles.admin}`}>
      <header className={styles.top}>
        <h1>Portfolio admin</h1>
        <a href="#">Back to the site</a>
        {token !== null && (
          <button type="button" className={styles.ghost} onClick={signOut}>
            Sign out
          </button>
        )}
      </header>
      {token === null ? (
        <LoginForm onSignedIn={setToken} />
      ) : (
        <ProjectAdmin token={token} onUnauthorised={signOut} />
      )}
    </main>
  )
}
