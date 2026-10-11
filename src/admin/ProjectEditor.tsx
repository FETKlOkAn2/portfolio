import { Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type {
  LinkKind,
  ProjectCategory,
  ProjectInput,
  ProjectLink,
  ProjectStatus,
  RepoVisibility,
} from '../domain/types'
import styles from './Admin.module.css'
import type { ProjectDraft } from './projectDraft'
import { fromDraft } from './projectDraft'
import { slugify } from './slugify'

// The hint sits outside the <label> so the control's accessible name is the label text alone.
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.control}>
        <span className={styles.label}>{label}</span>
        {children}
      </label>
      {hint !== undefined && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}

interface Props {
  initial: ProjectDraft
  isNew: boolean
  onCancel: () => void
  onSave: (input: ProjectInput) => Promise<void>
}

export function ProjectEditor({ initial, isNew, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState(initial)
  const [slugEdited, setSlugEdited] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  function set<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function setTitle(title: string) {
    setDraft((current) => ({
      ...current,
      title,
      slug: slugEdited ? current.slug : slugify(title),
    }))
  }

  function setLink(index: number, patch: Partial<ProjectLink>) {
    set(
      'links',
      draft.links.map((link, position) => (position === index ? { ...link, ...patch } : link)),
    )
  }

  async function save() {
    setSaving(true)
    try {
      await onSave(fromDraft(draft))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className={styles.row}>
        <Field label="Title">
          <input required value={draft.title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Slug" hint="Lowercase letters, digits and hyphens.">
          <input
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={draft.slug}
            onChange={(event) => {
              setSlugEdited(true)
              set('slug', event.target.value)
            }}
          />
        </Field>
      </div>

      <Field label="Tagline" hint="One sentence, up to 200 characters.">
        <input
          required
          maxLength={200}
          value={draft.tagline}
          onChange={(event) => set('tagline', event.target.value)}
        />
      </Field>

      <Field label="Description">
        <textarea
          required
          value={draft.description}
          onChange={(event) => set('description', event.target.value)}
        />
      </Field>

      <Field label="Highlights" hint="One per line, three at most.">
        <textarea
          value={draft.highlights}
          onChange={(event) => set('highlights', event.target.value)}
        />
      </Field>

      <div className={styles.row}>
        <Field label="Pipeline steps" hint="One per line. Leave empty for none.">
          <textarea value={draft.flow} onChange={(event) => set('flow', event.target.value)} />
        </Field>
        <Field label="Technologies" hint="One per line.">
          <textarea value={draft.tech} onChange={(event) => set('tech', event.target.value)} />
        </Field>
      </div>

      <fieldset className={styles.links}>
        <legend>Links</legend>
        {draft.links.map((link, index) => (
          <div key={index} className={styles.linkRow}>
            <select
              aria-label={`Link ${index + 1} kind`}
              value={link.kind}
              onChange={(event) => setLink(index, { kind: event.target.value as LinkKind })}
            >
              <option value="live">Live</option>
              <option value="repo">Repo</option>
              <option value="doc">Document</option>
            </select>
            <input
              aria-label={`Link ${index + 1} label`}
              placeholder="Label"
              value={link.label}
              onChange={(event) => setLink(index, { label: event.target.value })}
            />
            <input
              aria-label={`Link ${index + 1} URL`}
              type="url"
              placeholder="https://"
              value={link.url}
              onChange={(event) => setLink(index, { url: event.target.value })}
            />
            <button
              type="button"
              className={styles.ghost}
              aria-label={`Remove link ${index + 1}`}
              onClick={() =>
                set(
                  'links',
                  draft.links.filter((_, position) => position !== index),
                )
              }
            >
              <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => set('links', [...draft.links, { kind: 'repo', label: 'Source', url: '' }])}
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            Add link
          </button>
        </div>
      </fieldset>

      <div className={styles.row}>
        <Field label="Status">
          <select
            value={draft.status}
            onChange={(event) => set('status', event.target.value as ProjectStatus)}
          >
            <option value="released">Released</option>
            <option value="prototype">Prototype</option>
            <option value="in-progress">In progress</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
        <Field label="Category">
          <select
            value={draft.category}
            onChange={(event) => set('category', event.target.value as ProjectCategory)}
          >
            <option value="platform">Platform</option>
            <option value="agents">Agent system</option>
            <option value="data">Data pipeline</option>
            <option value="web">Web app</option>
          </select>
        </Field>
        <Field label="Source code">
          <select
            value={draft.repoVisibility}
            onChange={(event) => set('repoVisibility', event.target.value as RepoVisibility)}
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </Field>
        <Field label="Sort order" hint="Lower numbers come first.">
          <input
            type="number"
            step={10}
            value={draft.sortOrder}
            onChange={(event) => set('sortOrder', event.target.value)}
          />
        </Field>
      </div>

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={draft.featured}
          onChange={(event) => set('featured', event.target.checked)}
        />
        Featured (the card spans both columns)
      </label>

      <div className={styles.actions}>
        <button type="submit" className={styles.button} disabled={saving}>
          Save project
        </button>
        <button type="button" className={styles.ghost} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
