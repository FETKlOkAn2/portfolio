import { lazy, Suspense, useSyncExternalStore } from 'react'
import { Site } from './Site'

const AdminApp = lazy(() => import('./admin/AdminApp'))

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function readHash(): string {
  return window.location.hash
}

export function App() {
  const hash = useSyncExternalStore(subscribeToHash, readHash)

  if (hash.startsWith('#/admin')) {
    return (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    )
  }
  return <Site />
}
