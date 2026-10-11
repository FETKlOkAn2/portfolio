# Plan C: Admin Screen and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the owner a private screen at `#/admin` for adding, editing and deleting projects, then ship the site through GitHub Pages Actions.

**Architecture:** `App` switches on the URL hash and lazy-loads the admin chunk, so visitors never download it. `AuthSession` keeps the 30-minute token in `sessionStorage`. The admin talks to the API through the `ApiClient` from Plan B. A deploy workflow refreshes the snapshot from the live API, builds, and publishes `dist/`.

**Tech Stack:** Same as Plan B. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-10-portfolio-rebuild-design.md` (read sections 6 "Admin" and 8).

**Run order:** Plan C of three. Needs Plan B finished. Tasks 1 to 3 need the Plan A API on `localhost:8000` only for the manual check in Task 2.

## Global Constraints

- Every constraint in Plan B applies: branch `claude/portfolio-ts-rebuild-9c4472`, staging with `git add -A -- . ':(exclude)docs'`, no enums or parameter properties, tokens only, lucide and `BrandIcon` only, no new dependencies, no em dashes.
- Never push, merge, deploy or change a GitHub setting. Task 4 lists those steps for the owner.
- Never store the admin password. Only the token goes into `sessionStorage`, and it expires with the session.
- The admin chunk must stay out of the main bundle: import `AdminApp` only through `lazy(() => import(...))`.
- Lucide names added in this plan: `Plus`, `Trash2`. Both take `aria-hidden="true"`.

## File Structure

```
src/state/AuthSession.ts             class: token in sessionStorage with expiry
src/state/container.ts               add authSession (modify)
src/admin/slugify.ts                 title → slug
src/admin/projectDraft.ts            ProjectDraft, EMPTY_DRAFT, toDraft, fromDraft
src/admin/useSlowNotice.ts           true after a request has waited 3 s
src/admin/AdminApp.tsx               default export; login or project admin
src/admin/LoginForm.tsx
src/admin/ProjectAdmin.tsx           table + create/edit/delete
src/admin/ProjectEditor.tsx          the one form
src/admin/Admin.module.css
src/App.tsx                          hash switch (modify)
.github/workflows/ci.yml, .github/workflows/deploy.yml
README.md                            rewrite
```

---

### Task 1: AuthSession, slugify and project drafts

**Files:**
- Create: `src/state/AuthSession.ts`, `src/state/AuthSession.test.ts`, `src/admin/slugify.ts`, `src/admin/slugify.test.ts`, `src/admin/projectDraft.ts`, `src/admin/projectDraft.test.ts`
- Modify: `src/state/container.ts` (replace whole file)

**Interfaces:**
- Consumes: `Project`, `ProjectInput`, `ProjectLink`, `ProjectStatus`, `ProjectCategory`, `RepoVisibility` from `src/domain/types.ts`; `makeProject` from `src/test/fixtures.ts`.
- Produces:
  - `new AuthSession(storage, now?)` with getter `token: string | null`, `save(accessToken: string, expiresInSeconds: number): void`, `clear(): void`
  - `authSession` exported from `src/state/container.ts`
  - `slugify(title: string): string`
  - `interface ProjectDraft` (list fields as newline-separated strings, `sortOrder` as a string), `EMPTY_DRAFT`, `toDraft(project: Project): ProjectDraft`, `fromDraft(draft: ProjectDraft): ProjectInput`

- [ ] **Step 1: Write the failing tests**

`src/state/AuthSession.test.ts`:

```ts
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
```

`src/admin/slugify.test.ts`:

```ts
// @vitest-environment node
import { slugify } from './slugify'

describe('slugify', () => {
  it.each([
    ['Crypto Quant Platform', 'crypto-quant-platform'],
    ['  Book   Pipeline  ', 'book-pipeline'],
    ['Parts Scraper – Image Analyzer', 'parts-scraper-image-analyzer'],
    ['Tomáš’s Project!', 'tomas-s-project'],
    ['', ''],
  ])('turns %j into %j', (title, slug) => {
    expect(slugify(title)).toBe(slug)
  })
})
```

`src/admin/projectDraft.test.ts`:

```ts
// @vitest-environment node
import { makeProject } from '../test/fixtures'
import { EMPTY_DRAFT, fromDraft, toDraft } from './projectDraft'

describe('project drafts', () => {
  it('round-trips a project through the form shape', () => {
    const project = makeProject({ highlights: ['One', 'Two'], sortOrder: 30, featured: true })
    const { id: _id, ...input } = project

    expect(fromDraft(toDraft(project))).toEqual(input)
  })

  it('splits list fields on new lines and drops blanks', () => {
    const input = fromDraft({
      ...EMPTY_DRAFT,
      slug: 'x',
      title: 'X',
      tagline: 't',
      description: 'd',
      tech: ' Python \n\n FastAPI\n',
      flow: 'draft\ncritique',
      highlights: '',
    })

    expect(input.tech).toEqual(['Python', 'FastAPI'])
    expect(input.flow).toEqual(['draft', 'critique'])
    expect(input.highlights).toEqual([])
  })

  it('drops link rows with no URL and trims the rest', () => {
    const input = fromDraft({
      ...EMPTY_DRAFT,
      links: [
        { kind: 'repo', label: ' Source ', url: ' https://github.com/x/y ' },
        { kind: 'live', label: 'Demo', url: '   ' },
      ],
    })

    expect(input.links).toEqual([{ kind: 'repo', label: 'Source', url: 'https://github.com/x/y' }])
  })

  it('reads the sort order as a whole number and falls back to 0', () => {
    expect(fromDraft({ ...EMPTY_DRAFT, sortOrder: '40' }).sortOrder).toBe(40)
    expect(fromDraft({ ...EMPTY_DRAFT, sortOrder: 'abc' }).sortOrder).toBe(0)
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/state/AuthSession.test.ts src/admin`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Write `src/state/AuthSession.ts`**

```ts
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
```

- [ ] **Step 4: Write `src/admin/slugify.ts`**

```ts
/** "Crypto Quant Platform" → "crypto-quant-platform". Matches the API's slug pattern. */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 5: Write `src/admin/projectDraft.ts`**

```ts
import type {
  Project,
  ProjectCategory,
  ProjectInput,
  ProjectLink,
  ProjectStatus,
  RepoVisibility,
} from '../domain/types'

/** A project as the form holds it: lists are text with one entry per line. */
export interface ProjectDraft {
  slug: string
  title: string
  tagline: string
  description: string
  highlights: string
  tech: string
  flow: string
  links: ProjectLink[]
  status: ProjectStatus
  category: ProjectCategory
  repoVisibility: RepoVisibility
  featured: boolean
  sortOrder: string
}

export const EMPTY_DRAFT: ProjectDraft = {
  slug: '',
  title: '',
  tagline: '',
  description: '',
  highlights: '',
  tech: '',
  flow: '',
  links: [],
  status: 'prototype',
  category: 'platform',
  repoVisibility: 'public',
  featured: false,
  sortOrder: '100',
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

export function toDraft(project: Project): ProjectDraft {
  return {
    slug: project.slug,
    title: project.title,
    tagline: project.tagline,
    description: project.description,
    highlights: project.highlights.join('\n'),
    tech: project.tech.join('\n'),
    flow: project.flow.join('\n'),
    links: project.links.map((link) => ({ ...link })),
    status: project.status,
    category: project.category,
    repoVisibility: project.repoVisibility,
    featured: project.featured,
    sortOrder: String(project.sortOrder),
  }
}

export function fromDraft(draft: ProjectDraft): ProjectInput {
  const sortOrder = Number.parseInt(draft.sortOrder, 10)
  return {
    slug: draft.slug.trim(),
    title: draft.title.trim(),
    tagline: draft.tagline.trim(),
    description: draft.description.trim(),
    highlights: lines(draft.highlights),
    tech: lines(draft.tech),
    flow: lines(draft.flow),
    links: draft.links
      .map((link) => ({ kind: link.kind, label: link.label.trim(), url: link.url.trim() }))
      .filter((link) => link.url !== ''),
    status: draft.status,
    category: draft.category,
    repoVisibility: draft.repoVisibility,
    featured: draft.featured,
    sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
  }
}
```

- [ ] **Step 6: Export `authSession` from the container**

Replace `src/state/container.ts`:

```ts
import { ApiClient } from '../api/ApiClient'
import { parseContent } from '../data/parseContent'
import rawSnapshot from '../data/snapshot.json'
import { AuthSession } from './AuthSession'
import { ContentStore } from './ContentStore'

export const apiClient = new ApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:8000')
export const contentStore = new ContentStore(parseContent(rawSnapshot), apiClient)
export const authSession = new AuthSession(window.sessionStorage)
```

- [ ] **Step 7: Run the tests**

Run: `npm test && npm run typecheck`
Expected: `80 passed`, no type errors.

- [ ] **Step 8: Commit**

```bash
git add -A -- . ':(exclude)docs'
git commit -m "feat: add admin session storage, slugify and project form drafts"
```

---

### Task 2: The admin screen

**Files:**
- Create: `src/admin/useSlowNotice.ts`, `src/admin/Admin.module.css`, `src/admin/LoginForm.tsx`, `src/admin/ProjectEditor.tsx`, `src/admin/ProjectAdmin.tsx`, `src/admin/AdminApp.tsx`, `src/admin/admin.test.tsx`
- Modify: `src/App.tsx` (replace whole file)

**Interfaces:**
- Consumes: `apiClient`, `authSession`, `contentStore` (container); `ApiError` (`src/api/ApiClient.ts`); `slugify`, `ProjectDraft`, `EMPTY_DRAFT`, `toDraft`, `fromDraft` (Task 1); `Site` (Plan B).
- Produces: `AdminApp` (default export), `LoginForm({ onSignedIn })`, `ProjectAdmin({ token, onUnauthorised })`, `ProjectEditor({ initial, isNew, onCancel, onSave })`, `useSlowNotice(pending: boolean, delayMs?: number): boolean`. `App` renders `AdminApp` when the hash starts with `#/admin`.

- [ ] **Step 1: Write the failing tests**

`src/admin/admin.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '../api/ApiClient'
import { App } from '../App'
import { apiClient, authSession, contentStore } from '../state/container'
import { makeProject } from '../test/fixtures'
import { LoginForm } from './LoginForm'
import { ProjectAdmin } from './ProjectAdmin'

afterEach(() => {
  vi.restoreAllMocks()
  authSession.clear()
  window.location.hash = ''
})

describe('App routing', () => {
  it('shows the login form at #/admin', async () => {
    vi.spyOn(contentStore, 'revalidate').mockResolvedValue(false)
    window.location.hash = '#/admin'

    render(<App />)

    expect(await screen.findByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Projects' })).not.toBeInTheDocument()
  })
})

describe('LoginForm', () => {
  it('saves the token and reports success', async () => {
    vi.spyOn(apiClient, 'login').mockResolvedValue({ accessToken: 'tok', expiresIn: 1800 })
    const onSignedIn = vi.fn()
    render(<LoginForm onSignedIn={onSignedIn} />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith('tok'))
    expect(apiClient.login).toHaveBeenCalledWith('secret')
    expect(authSession.token).toBe('tok')
  })

  it('shows the API message when the password is wrong', async () => {
    vi.spyOn(apiClient, 'login').mockRejectedValue(new ApiError(401, 'Wrong password'))
    render(<LoginForm onSignedIn={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong password')
    expect(authSession.token).toBeNull()
  })
})

describe('ProjectAdmin', () => {
  it('lists projects and creates a new one', async () => {
    const existing = makeProject({ id: 1, title: 'Existing' })
    const list = vi.spyOn(apiClient, 'listProjects').mockResolvedValue([existing])
    const create = vi.spyOn(apiClient, 'createProject').mockResolvedValue(makeProject({ id: 2 }))
    vi.spyOn(contentStore, 'revalidate').mockResolvedValue(true)
    render(<ProjectAdmin token="tok" onUnauthorised={vi.fn()} />)

    expect(await screen.findByRole('cell', { name: 'Existing' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'New project' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Route Agent' } })
    expect(screen.getByLabelText('Slug')).toHaveValue('route-agent')
    fireEvent.change(screen.getByLabelText('Tagline'), { target: { value: 'A tagline.' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A description.' } })
    fireEvent.change(screen.getByLabelText('Technologies'), { target: { value: 'Python\nuv' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    const [input, token] = create.mock.calls[0]
    expect(token).toBe('tok')
    expect(input).toMatchObject({
      slug: 'route-agent',
      title: 'Route Agent',
      tech: ['Python', 'uv'],
      status: 'prototype',
    })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
  })

  it('opens the editor filled in and saves an update', async () => {
    const existing = makeProject({ id: 7, title: 'Existing', slug: 'existing' })
    vi.spyOn(apiClient, 'listProjects').mockResolvedValue([existing])
    const update = vi.spyOn(apiClient, 'updateProject').mockResolvedValue(existing)
    vi.spyOn(contentStore, 'revalidate').mockResolvedValue(true)
    render(<ProjectAdmin token="tok" onUnauthorised={vi.fn()} />)

    const row = (await screen.findByRole('cell', { name: 'Existing' })).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Slug')).toHaveValue('existing')
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed' } })
    expect(screen.getByLabelText('Slug')).toHaveValue('existing')
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][0]).toBe(7)
    expect(update.mock.calls[0][1]).toMatchObject({ title: 'Renamed', slug: 'existing' })
  })

  it('signs out when the API rejects the token', async () => {
    vi.spyOn(apiClient, 'listProjects').mockResolvedValue([makeProject({ id: 1, title: 'Existing' })])
    vi.spyOn(apiClient, 'deleteProject').mockRejectedValue(new ApiError(401, 'Not authenticated'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onUnauthorised = vi.fn()
    render(<ProjectAdmin token="old" onUnauthorised={onUnauthorised} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onUnauthorised).toHaveBeenCalledTimes(1))
  })

  it('does not delete when the owner cancels the confirmation', async () => {
    vi.spyOn(apiClient, 'listProjects').mockResolvedValue([makeProject({ id: 1, title: 'Existing' })])
    const remove = vi.spyOn(apiClient, 'deleteProject').mockResolvedValue()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ProjectAdmin token="tok" onUnauthorised={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(remove).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/admin/admin.test.tsx`
Expected: FAIL, unresolved imports `./LoginForm` and `./ProjectAdmin`.

- [ ] **Step 3: Write `src/admin/useSlowNotice.ts`**

```ts
import { useEffect, useState } from 'react'

/** True once `pending` has lasted `delayMs`. The free API tier sleeps, so the first call can take a minute. */
export function useSlowNotice(pending: boolean, delayMs = 3000): boolean {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!pending) return
    const timer = window.setTimeout(() => setSlow(true), delayMs)
    return () => {
      window.clearTimeout(timer)
      setSlow(false)
    }
  }, [pending, delayMs])

  return pending && slow
}
```

- [ ] **Step 4: Write `src/admin/Admin.module.css`**

```css
.admin {
  padding-block: 2rem 4rem;
}

.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.top h1 {
  margin-right: auto;
  font-size: 1.25rem;
  font-weight: 600;
}

.button,
.ghost,
.danger {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 36px;
  padding: 0 0.85rem;
  font-size: 0.9375rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background-color 150ms,
    border-color 150ms;
}

.button {
  color: #fff;
  background: var(--accent-solid);
}

.button:hover {
  background: var(--accent-solid-hover);
}

.button:disabled {
  opacity: 0.6;
  cursor: default;
}

.ghost,
.danger {
  background: none;
  border-color: var(--border-strong);
}

.ghost:hover {
  border-color: var(--accent);
}

.danger:hover {
  border-color: var(--text-muted);
}

.notice {
  margin-block: 1rem;
  color: var(--text-muted);
}

.error {
  margin-block: 1rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border-strong);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-sm);
}

.login {
  display: grid;
  gap: 1rem;
  max-width: 360px;
}

.form {
  display: grid;
  gap: 1rem;
  max-width: 720px;
}

.row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}

.field,
.control {
  display: grid;
  gap: 0.3rem;
}

.label {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.hint {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.field input,
.field select,
.field textarea,
.linkRow input,
.linkRow select {
  width: 100%;
  padding: 0.5rem 0.65rem;
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
}

.field textarea {
  min-height: 5.5rem;
  resize: vertical;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.links {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.links legend {
  padding-inline: 0.4rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.linkRow {
  display: grid;
  grid-template-columns: 110px 1fr 2fr auto;
  gap: 0.5rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
}

.table {
  width: 100%;
  margin-top: 1rem;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 0.6rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.table th {
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
}

.rowActions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@media (max-width: 720px) {
  .linkRow {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Write `src/admin/LoginForm.tsx`**

```tsx
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
```

- [ ] **Step 6: Write `src/admin/ProjectEditor.tsx`**

```tsx
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
```

- [ ] **Step 7: Write `src/admin/ProjectAdmin.tsx`**

```tsx
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
```

- [ ] **Step 8: Write `src/admin/AdminApp.tsx`**

```tsx
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
```

- [ ] **Step 9: Switch on the hash in `src/App.tsx`**

Replace the whole file:

```tsx
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
```

- [ ] **Step 10: Run all three gates**

```bash
npm test && npm run typecheck && npm run build
```

Expected: `87 passed`, no type errors. The build output lists a separate `AdminApp-<hash>.js` chunk next to `index-<hash>.js`.

- [ ] **Step 11: Try it against the local API**

The local API has no admin password yet. In the backend repo, create one for local use only:

```bash
cd /Users/tomasmaxim/Developer/portfolio_backend
uv run python -c "from app.core.security import PasswordVerifier; print('ADMIN_PASSWORD_HASH=' + PasswordVerifier.hash('local-dev-only'))" >> .env
uv run uvicorn app.main:app --port 8000
```

`.env` is ignored by git and was empty before this step; `>>` appends in case it is not. `local-dev-only` works on this machine only and must never reach Render.

In the `portfolio` worktree run `npm run dev`, open `http://localhost:5173/portfolio/#/admin`, and check:

1. A wrong password shows "Wrong password".
2. `local-dev-only` signs in and the table lists seven projects in display order.
3. "New project": typing a title fills the slug. Save, and the row appears in the table.
4. "Back to the site" shows the new card without a reload.
5. Back in the admin, edit that project's tagline, save, then delete it. Seven rows remain.
6. Reload at `#/admin`: still signed in. "Sign out" returns to the password form.

- [ ] **Step 12: Commit**

```bash
git add -A -- . ':(exclude)docs'
git commit -m "feat: add a lazy-loaded admin screen for managing projects"
```

---

### Task 3: CI, deploy workflow and README

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- Modify: `README.md` (replace whole file)

**Interfaces:**
- Consumes: `npm run typecheck | test | snapshot | build`.
- Produces: a branch ready for the owner to merge. Nothing in this task runs on GitHub until the owner pushes.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
  push:
    branches-ignore: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      # Bundles the newest content. If the API is asleep or down, the committed snapshot ships.
      - run: npm run snapshot
        env:
          VITE_API_URL: https://portfolio-backend-y1jy.onrender.com
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Replace `README.md`**

````markdown
# portfolio

Source for [fetklokan2.github.io/portfolio](https://fetklokan2.github.io/portfolio/).
React and TypeScript on GitHub Pages, with content from a
[FastAPI + SQLAlchemy API](https://github.com/FETKlOkAn2/portfolio_backend).

## How content reaches the page

The build bundles `src/data/snapshot.json`, a copy of the API's
`GET /api/v1/content`. The page renders from that file at once, then asks the
API whether anything is newer, sending the snapshot's version as an ETag. A
`304` changes nothing. A `200` swaps the content in place. If the API is asleep
or down, the visitor still sees the whole site.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173/portfolio/
```

The site works with no API running. To edit content locally, start the API on
port 8000 and open `#/admin`.

| Command | What it does |
|---|---|
| `npm test` | Vitest suite |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run build` | Production bundle in `dist/` |
| `npm run snapshot` | Refresh `snapshot.json` from the API at `VITE_API_URL` |

## Layout

| Path | Role |
|---|---|
| `src/domain` | Payload types, `DateRange`, `ProjectView` |
| `src/api/ApiClient.ts` | The only code that knows the API's URLs |
| `src/state` | `ContentStore` (snapshot first, then revalidate), `AuthSession` |
| `src/components` | Page sections |
| `src/admin` | Lazy-loaded project editor at `#/admin` |
| `src/styles/tokens.css` | Every colour, radius and font the site uses |

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: typecheck, test, refresh
the snapshot, build, publish to GitHub Pages.
````

- [ ] **Step 4: Check the workflows parse and the suite still passes**

```bash
node -e "for (const f of ['ci','deploy']) { const t = require('fs').readFileSync('.github/workflows/' + f + '.yml','utf8'); if (/\t/.test(t)) throw new Error(f + ' contains a tab'); console.log(f, 'ok', t.split('\n').length, 'lines') }"
npm test && npm run typecheck && npm run build
```

Expected: `ci ok` and `deploy ok`, `87 passed`, a clean build.

- [ ] **Step 5: Commit**

```bash
git add -A -- . ':(exclude)docs'
git commit -m "ci: add checks and a GitHub Pages deploy workflow; rewrite the README"
```

---

### Task 4: Hand the rollout to the owner

**Files:** none.

- [ ] **Step 1: Print a final report**

Report these facts, with the real numbers from this run:

- Test count from `npm test`, and that `npm run typecheck` and `npm run build` pass.
- Sizes from the build output: the main JS chunk, the admin chunk, the CSS file.
- `git log --oneline main..HEAD` for the branch.

- [ ] **Step 2: Stop and give the owner this checklist**

Do not run any of the following.

1. **Read the copy.** Open the site locally and read the Aptum and BetBrain cards; both describe private work. Read the Image Analyzer line about contract work. Change any of it in `#/admin` after launch, or ask for an edit to `seeds/content.json` before it.
2. **Fill the gaps.** Iron Mountain has no summary, and the Veach and Unicorn summaries are one sentence each because LinkedIn cut the rest. Send the full text, or add it later through the API's `/docs` page.
3. **Check two files.** `public/cv/tomas-maxim-cv.pdf` should include the Iron Mountain role. `public/avatar.png` is the old cartoon; replace the file with a photo if you prefer one.
4. **Finish Plan A's rollout first.** `curl https://portfolio-backend-y1jy.onrender.com/api/v1/content` must return seven projects.
5. **Switch GitHub Pages to Actions.** Repo → Settings → Pages → Build and deployment → Source: "GitHub Actions". Do this before merging. Merging first would publish the raw Vite `index.html` and blank the site.
6. **Merge.** Push `claude/portfolio-ts-rebuild-9c4472`, open a pull request, wait for CI, merge to `main`.
7. **Verify.** The Deploy workflow goes green. `https://fetklokan2.github.io/portfolio/` shows seven projects and four roles. `https://fetklokan2.github.io/portfolio/#/admin` accepts the password you set on Render.
