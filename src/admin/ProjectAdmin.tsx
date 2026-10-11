import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/ApiClient'
import type { Project, ProjectInput } from '../domain/types'
import { apiClient, contentStore } from '../state/container'
import styles from './Admin.module.css'
import { ProjectEditor } from './ProjectEditor'
import { EMPTY_DRAFT, toDraft } from './projectDraft'
import { useSlowNotice } from './useSlowNotice'

interface Props {
  token: string
  onUnauthorised: () => void
}

export function ProjectAdmin({ token, onUnauthorised }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [editing, setEditing] = useState<Project | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const slow = useSlowNotice(projects === null && error === null)

  const load = useCallback(async () => {
    try {
      setProjects(await apiClient.listProjects())
      setError(null)
    } catch {
      setError('Could not load projects. The API may still be waking up.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function fail(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      onUnauthorised()
      return
    }
    setError(cause instanceof ApiError ? cause.message : 'The request failed. Try again.')
  }

  async function afterWrite() {
    setEditing(null)
    await load()
    void contentStore.revalidate()
  }

  async function save(input: ProjectInput) {
    try {
      if (editing === 'new') await apiClient.createProject(input, token)
      else if (editing !== null) await apiClient.updateProject(editing.id, input, token)
      await afterWrite()
    } catch (cause) {
      fail(cause)
    }
  }

  async function remove(project: Project) {
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return
    try {
      await apiClient.deleteProject(project.id, token)
      await afterWrite()
    } catch (cause) {
      fail(cause)
    }
  }

  return (
    <>
      {error !== null && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {editing !== null ? (
        <ProjectEditor
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? EMPTY_DRAFT : toDraft(editing)}
          isNew={editing === 'new'}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      ) : (
        <>
          <button type="button" className={styles.button} onClick={() => setEditing('new')}>
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            New project
          </button>

          {slow && <p className={styles.notice}>Waking the API. The first request can take a minute.</p>}

          {projects !== null && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Title</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td className="mono">{project.sortOrder}</td>
                    <td>{project.title}</td>
                    <td>{project.status}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <button type="button" className={styles.ghost} onClick={() => setEditing(project)}>
                          Edit
                        </button>
                        <button type="button" className={styles.danger} onClick={() => void remove(project)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  )
}
