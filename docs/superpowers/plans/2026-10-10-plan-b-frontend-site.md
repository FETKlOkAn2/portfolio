# Plan B: Portfolio Frontend Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-file HTML portfolio with a React + TypeScript site that renders from a bundled content snapshot and revalidates against the content API in the background.

**Architecture:** Vite builds a static bundle for GitHub Pages. Classes own the data layer (`ApiClient`, `ContentStore`, `DateRange`, `ProjectView`); React function components render it. `ContentStore` starts from `snapshot.json`, so the page paints with the API asleep, and swaps content in place when the API answers with a newer version.

**Tech Stack:** Vite, React 19, TypeScript (strict), CSS Modules with design tokens, Vitest + Testing Library, `lucide-react`, `simple-icons`, `@fontsource` IBM Plex Sans and Mono.

**Spec:** `docs/superpowers/specs/2026-10-10-portfolio-rebuild-design.md` (read sections 6 and 7).

**Run order:** Plan B of three. Needs Plan A Tasks 1 to 8 done: Task 2 here reads its first snapshot from the API running on `localhost:8000`. Plan C (admin and deploy) follows this plan.

## Global Constraints

- Work in the `portfolio` repo on branch `claude/portfolio-ts-rebuild-9c4472` (worktree: `/Users/tomasmaxim/Developer/portfolio/.claude/worktrees/portfolio-ts-rebuild-9c4472`). Never commit to `main`. Never push, merge or change a GitHub setting.
- Stage with `git add -A -- . ':(exclude)docs'` so the plan documents stay out of commits unless the owner asks.
- TypeScript: no `enum`, no constructor parameter properties, no `namespace`, no `any`. Declare class fields in full. Use `import type` for type-only imports.
- Dependencies: only those installed in Task 1. No Tailwind, no component library, no animation library, no router.
- Colour, radius and font values come from `src/styles/tokens.css`. Never write a hex value in a component stylesheet, except the one status dot colour given in Task 7.
- Never add: gradients, glows, box-shadows, particles, parallax, transforms on hover, emoji, PNG icons, centred hero text.
- Icons: `lucide-react` names `ArrowRight, ArrowUpRight, Award, Download, FileText, Lock, Mail, Menu, Phone, X`, always with `aria-hidden="true"`; brand marks only through `BrandIcon`. If a lucide name fails to import, pick the closest glyph from lucide.dev and keep the size and stroke.
- Motion: `transition` on `color`, `background-color` and `border-color` at `150ms`. Nothing else animates.
- Copy is final. Use the strings in this plan and in `snapshot.json` as written. No em dashes.
- The page must render every section with the network off.
- Tests that touch no DOM start with `// @vitest-environment node`.

## File Structure

```
index.html, package.json, tsconfig.json, vite.config.ts, .gitignore, .env.development, .env.production
public/avatar.png, public/cv/tomas-maxim-cv.pdf, public/favicon.svg
scripts/snapshot.mjs                  refresh src/data/snapshot.json from the API
src/main.tsx, src/App.tsx, src/Site.tsx, src/vite-env.d.ts
src/test/setup.ts, src/test/fixtures.ts
src/domain/types.ts                   payload types
src/domain/DateRange.ts               class
src/domain/ProjectView.ts             class
src/data/snapshot.json                bundled content
src/data/parseContent.ts              runtime guard
src/data/profile.ts                   PROFILE, CONTACTS (static, not from the API)
src/api/ApiClient.ts                  class + ApiError
src/state/ContentStore.ts             class
src/state/container.ts                apiClient, contentStore singletons
src/hooks/useContent.ts, src/hooks/useActiveSection.ts
src/styles/tokens.css, src/styles/global.css
src/components/BrandIcon.tsx
src/components/Nav.tsx (+ .module.css), Section.tsx, Hero.tsx, Footer.tsx
src/components/ProjectCard.tsx, FlowLine.tsx, ProjectGrid.tsx
src/components/ExperienceTimeline.tsx, ArticleList.tsx, CertificateList.tsx, ContactLinks.tsx
```

---

### Task 1: Tooling and an app that builds

**Files:**
- Delete: `index.html` (old), `styles.css`, `projects.json`, `images/` (after moving two files)
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.env.development`, `.env.production`, `index.html`, `public/favicon.svg`, `src/vite-env.d.ts`, `src/test/setup.ts`, `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`
- Move: `images/coffee.png` → `public/avatar.png`, `images/intch-cv.pdf` → `public/cv/tomas-maxim-cv.pdf`

**Interfaces:**
- Produces: `npm run dev | build | typecheck | test | snapshot`; `App` (named export from `src/App.tsx`); `import.meta.env.VITE_API_URL`; Vite `base` of `/portfolio/`.

- [ ] **Step 1: Move the two assets worth keeping and delete the old site**

```bash
mkdir -p public/cv
git mv images/coffee.png public/avatar.png
git mv images/intch-cv.pdf public/cv/tomas-maxim-cv.pdf
git rm -r --quiet images index.html styles.css projects.json
```

Expected: `ls` shows `README.md`, `docs`, `public`. The old files stay in git history.

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "portfolio",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "snapshot": "node scripts/snapshot.mjs"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install react react-dom lucide-react simple-icons @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom vitest jsdom @testing-library/react @testing-library/jest-dom
```

Expected: both commands end without `ERR!`. `package-lock.json` appears.

- [ ] **Step 4: Write the config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/portfolio/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

`.gitignore`:

```gitignore
node_modules/
dist/
.env.local
*.tsbuildinfo
```

`.env.development`:

```dotenv
VITE_API_URL=http://localhost:8000
```

`.env.production`:

```dotenv
VITE_API_URL=https://portfolio-backend-y1jy.onrender.com
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Write `index.html` and the favicon**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tomáš Maxim · Python Developer</title>
    <meta
      name="description"
      content="Tomáš Maxim, Python developer in Bratislava. Backend systems, data pipelines and LLM agent loops."
    />
    <meta name="theme-color" content="#0f0f23" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Tomáš Maxim · Python Developer" />
    <meta property="og:description" content="Backend systems, data pipelines and LLM agent loops." />
    <meta property="og:url" content="https://fetklokan2.github.io/portfolio/" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#4f46e5"/><text x="16" y="21.5" font-family="ui-monospace, Menlo, monospace" font-size="13" font-weight="600" fill="#fff" text-anchor="middle">TM</text></svg>
```

- [ ] **Step 6: Write the failing test**

`src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('App', () => {
  it('shows the owner name as the page heading', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Tomáš Maxim' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run it and watch it fail**

Run: `npm test`
Expected: FAIL, `Failed to resolve import "./App"`.

- [ ] **Step 8: Write `src/App.tsx` and `src/main.tsx`**

`src/App.tsx`:

```tsx
export function App() {
  return (
    <main>
      <h1>Tomáš Maxim</h1>
    </main>
  )
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 9: Run all three gates**

```bash
npm test && npm run typecheck && npm run build
```

Expected: `1 passed`, no type errors, and `dist/index.html` exists. `grep -c '/portfolio/assets/' dist/index.html` prints `1` or more.

If `tsc` rejects a compiler option by name, delete that one option from `tsconfig.json` and rerun. Keep `strict`, `erasableSyntaxOnly` and `verbatimModuleSyntax`.

- [ ] **Step 10: Commit**

```bash
git add -A -- . ':(exclude)docs'
git commit -m "chore: replace the static page with a Vite, React and TypeScript scaffold"
```

---

### Task 2: Content types, runtime guard, first snapshot

**Files:**
- Create: `src/domain/types.ts`, `src/data/parseContent.ts`, `src/data/parseContent.test.ts`, `scripts/snapshot.mjs`, `src/data/snapshot.json` (generated), `src/data/snapshot.test.ts`

**Interfaces:**
- Consumes: the Plan A API on `http://localhost:8000`.
- Produces:
  - Types `ProjectStatus`, `ProjectCategory`, `RepoVisibility`, `LinkKind`, `ProjectLink`, `ProjectInput`, `Project`, `Experience`, `Certificate`, `Article`, `Content`
  - `parseContent(raw: unknown): Content` (throws `Error` on a wrong shape)
  - `src/data/snapshot.json` matching `Content`
  - `npm run snapshot`

- [ ] **Step 1: Write `src/domain/types.ts`**

```ts
export type ProjectStatus = 'released' | 'prototype' | 'in-progress' | 'archived'
export type ProjectCategory = 'platform' | 'agents' | 'data' | 'web'
export type RepoVisibility = 'public' | 'private'
export type LinkKind = 'live' | 'repo' | 'doc'

export interface ProjectLink {
  kind: LinkKind
  label: string
  url: string
}

export interface ProjectInput {
  slug: string
  title: string
  tagline: string
  description: string
  highlights: string[]
  tech: string[]
  flow: string[]
  links: ProjectLink[]
  status: ProjectStatus
  category: ProjectCategory
  repoVisibility: RepoVisibility
  featured: boolean
  sortOrder: number
}

export interface Project extends ProjectInput {
  id: number
}

export interface Experience {
  id: number
  role: string
  company: string
  employmentType: string | null
  location: string | null
  startDate: string
  endDate: string | null
  summary: string
  skills: string[]
}

export interface Certificate {
  id: number
  title: string
  issuer: string
  issuedLabel: string
  sortOrder: number
}

export interface Article {
  id: number
  title: string
  publication: string
  topic: string
  summary: string
  url: string
  sortOrder: number
}

export interface Content {
  version: string
  projects: Project[]
  experience: Experience[]
  certificates: Certificate[]
  articles: Article[]
}
```

- [ ] **Step 2: Write the failing guard tests**

`src/data/parseContent.test.ts`:

```ts
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
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run src/data/parseContent.test.ts`
Expected: FAIL, `Failed to resolve import "./parseContent"`.

- [ ] **Step 4: Write `src/data/parseContent.ts`**

```ts
import type { Content } from '../domain/types'

const SECTIONS = ['projects', 'experience', 'certificates', 'articles'] as const

/** Guards every payload that enters the app: the bundled snapshot and API responses alike. */
export function parseContent(raw: unknown): Content {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Content payload is not an object')
  }
  const record = raw as Record<string, unknown>
  if (typeof record.version !== 'string' || record.version === '') {
    throw new Error('Content payload has no version')
  }
  for (const section of SECTIONS) {
    if (!Array.isArray(record[section])) {
      throw new Error(`Content payload is missing "${section}"`)
    }
  }
  return raw as Content
}
```

Run: `npx vitest run src/data/parseContent.test.ts`
Expected: `8 passed`.

- [ ] **Step 5: Write `scripts/snapshot.mjs`**

```js
// Refreshes src/data/snapshot.json from the content API.
// On any failure it keeps the committed file and exits 0, so a sleeping API never breaks a build.
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const apiUrl = (process.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')
const target = fileURLToPath(new URL('../src/data/snapshot.json', import.meta.url))
const SECTIONS = ['projects', 'experience', 'certificates', 'articles']

async function main() {
  const response = await fetch(`${apiUrl}/api/v1/content`, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok) throw new Error(`API answered ${response.status}`)
  const content = await response.json()
  const wellFormed =
    typeof content.version === 'string' && SECTIONS.every((name) => Array.isArray(content[name]))
  if (!wellFormed) throw new Error('API answered with an unexpected shape')
  if (content.projects.length === 0) throw new Error('API returned no projects')
  await writeFile(target, `${JSON.stringify(content, null, 2)}\n`)
  console.log(`snapshot: wrote version ${content.version} with ${content.projects.length} projects`)
}

main().catch((error) => {
  console.warn(`snapshot: kept the committed file (${error.message})`)
})
```

- [ ] **Step 6: Generate the first snapshot from the local API**

Start the Plan A API as a background process and leave it running for the rest of this plan:

```bash
cd /Users/tomasmaxim/Developer/portfolio_backend
uv run alembic upgrade head && uv run python -m app.cli seed
uv run uvicorn app.main:app --port 8000
```

Back in the `portfolio` worktree:

```bash
VITE_API_URL=http://localhost:8000 npm run snapshot
```

Expected: `snapshot: wrote version <16 hex chars> with 7 projects`, and `src/data/snapshot.json` exists.

If it prints `kept the committed file`, the API is not reachable. Fix that before continuing; there is no committed file yet.

- [ ] **Step 7: Lock the snapshot's shape with a test**

`src/data/snapshot.test.ts`:

```ts
// @vitest-environment node
import { parseContent } from './parseContent'
import rawSnapshot from './snapshot.json'

describe('bundled snapshot', () => {
  const content = parseContent(rawSnapshot)

  it('carries every section the page renders', () => {
    expect(content.projects.length).toBeGreaterThanOrEqual(7)
    expect(content.experience.length).toBeGreaterThanOrEqual(4)
    expect(content.certificates.length).toBeGreaterThanOrEqual(6)
    expect(content.articles.length).toBeGreaterThanOrEqual(2)
  })

  it('leads with Aptum and its sandbox link', () => {
    const first = content.projects[0]

    expect(first.slug).toBe('aptum')
    expect(first.links[0].url).toBe('https://sandbox-aptum.com/practice')
  })

  it('contains no em dashes', () => {
    expect(JSON.stringify(content)).not.toContain('\u2014')
  })
})
```

Run: `npm test && npm run typecheck`
Expected: `12 passed`, no type errors.

- [ ] **Step 8: Commit**

```bash
git add -A -- . ':(exclude)docs'
git commit -m "feat: add content types, a payload guard and the first bundled snapshot"
```

---

### Task 3: DateRange and ProjectView

**Files:**
- Create: `src/domain/DateRange.ts`, `src/domain/DateRange.test.ts`, `src/domain/ProjectView.ts`, `src/domain/ProjectView.test.ts`, `src/test/fixtures.ts`

**Interfaces:**
- Consumes: types from Task 2.
- Produces:
  - `new DateRange(startIso: string, endIso: string | null)` with `isCurrent: boolean`, `label(): string`, `months(today?: Date): number`, `duration(today?: Date): string`
  - `new ProjectView(project: Project)` with `project`, `statusLabel: string`, `categoryLabel: string`, `showsPrivateNote: boolean`
  - `makeProject(overrides?: Partial<Project>): Project`, `makeContent(overrides?: Partial<Content>): Content` from `src/test/fixtures.ts`

- [ ] **Step 1: Write the fixtures**

`src/test/fixtures.ts`:

```ts
import type { Content, Project } from '../domain/types'

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    slug: 'demo',
    title: 'Demo',
    tagline: 'A demo project.',
    description: 'Longer text about the demo.',
    highlights: ['First highlight'],
    tech: ['Python', 'FastAPI'],
    flow: ['draft', 'critique', 'revise'],
    links: [{ kind: 'repo', label: 'Source', url: 'https://github.com/example/demo' }],
    status: 'released',
    category: 'platform',
    repoVisibility: 'public',
    featured: false,
    sortOrder: 10,
    ...overrides,
  }
}

export function makeContent(overrides: Partial<Content> = {}): Content {
  return {
    version: 'v1',
    projects: [makeProject()],
    experience: [
      {
        id: 1,
        role: 'Software Engineer',
        company: 'Iron Mountain',
        employmentType: 'Full-time',
        location: 'Bratislava, Slovakia · Remote',
        startDate: '2026-07-01',
        endDate: null,
        summary: '',
        skills: [],
      },
    ],
    certificates: [
      { id: 1, title: 'CCNA 1', issuer: 'Cisco', issuedLabel: '2023', sortOrder: 10 },
    ],
    articles: [
      {
        id: 1,
        title: 'A post',
        publication: 'Medium',
        topic: 'Engineering',
        summary: 'About a thing.',
        url: 'https://medium.com/post',
        sortOrder: 10,
      },
    ],
    ...overrides,
  }
}
```

- [ ] **Step 2: Write the failing tests**

`src/domain/DateRange.test.ts`:

```ts
// @vitest-environment node
import { DateRange } from './DateRange'

const today = new Date(2026, 9, 10) // 10 October 2026

describe('DateRange', () => {
  it('labels an open range as Present', () => {
    const range = new DateRange('2026-07-01', null)

    expect(range.label()).toBe('Jul 2026 – Present')
    expect(range.isCurrent).toBe(true)
  })

  it('counts the first and the last month of an open range', () => {
    expect(new DateRange('2026-07-01', null).duration(today)).toBe('4 mos')
  })

  it('labels and measures a closed range across a year boundary', () => {
    const range = new DateRange('2025-09-01', '2026-01-01')

    expect(range.label()).toBe('Sep 2025 – Jan 2026')
    expect(range.duration(today)).toBe('5 mos')
    expect(range.isCurrent).toBe(false)
  })

  it('rolls twelve months into a year', () => {
    expect(new DateRange('2024-01-01', '2025-03-01').duration(today)).toBe('1 yr 3 mos')
    expect(new DateRange('2023-01-01', '2024-12-01').duration(today)).toBe('2 yrs')
  })

  it('uses the singular for one month', () => {
    expect(new DateRange('2024-07-01', '2024-07-01').duration(today)).toBe('1 mo')
  })

  it('rejects a malformed date', () => {
    expect(() => new DateRange('July 2026', null)).toThrow('Invalid date')
  })
})
```

`src/domain/ProjectView.test.ts`:

```ts
// @vitest-environment node
import { makeProject } from '../test/fixtures'
import { ProjectView } from './ProjectView'

describe('ProjectView', () => {
  it('turns status and category into display labels', () => {
    const view = new ProjectView(makeProject({ status: 'in-progress', category: 'agents' }))

    expect(view.statusLabel).toBe('In progress')
    expect(view.categoryLabel).toBe('Agent system')
  })

  it('shows the private note for a private project with no repo link', () => {
    const view = new ProjectView(makeProject({ repoVisibility: 'private', links: [] }))

    expect(view.showsPrivateNote).toBe(true)
  })

  it('keeps the private note when the only link is a live demo', () => {
    const view = new ProjectView(
      makeProject({
        repoVisibility: 'private',
        links: [{ kind: 'live', label: 'Open sandbox', url: 'https://example.com' }],
      }),
    )

    expect(view.showsPrivateNote).toBe(true)
  })

  it('hides the private note for a public project', () => {
    expect(new ProjectView(makeProject()).showsPrivateNote).toBe(false)
  })
})
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run src/domain`
Expected: FAIL, unresolved imports `./DateRange` and `./ProjectView`.

- [ ] **Step 4: Write `src/domain/DateRange.ts`**

```ts
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface YearMonth {
  year: number
  month: number
}

/** A span of whole months. A null end means the range is still open. */
export class DateRange {
  private readonly start: YearMonth
  private readonly end: YearMonth | null

  constructor(startIso: string, endIso: string | null) {
    this.start = DateRange.parse(startIso)
    this.end = endIso === null ? null : DateRange.parse(endIso)
  }

  private static parse(iso: string): YearMonth {
    const match = /^(\d{4})-(\d{2})/.exec(iso)
    if (!match) throw new Error(`Invalid date: ${iso}`)
    return { year: Number(match[1]), month: Number(match[2]) }
  }

  private static format(value: YearMonth): string {
    return `${MONTHS[value.month - 1]} ${value.year}`
  }

  get isCurrent(): boolean {
    return this.end === null
  }

  label(): string {
    const end = this.end === null ? 'Present' : DateRange.format(this.end)
    return `${DateRange.format(this.start)} – ${end}`
  }

  /** Inclusive month count: July to October is four months. */
  months(today: Date = new Date()): number {
    const end = this.end ?? { year: today.getFullYear(), month: today.getMonth() + 1 }
    return (end.year - this.start.year) * 12 + (end.month - this.start.month) + 1
  }

  duration(today: Date = new Date()): string {
    const total = this.months(today)
    const years = Math.floor(total / 12)
    const months = total % 12
    const parts: string[] = []
    if (years > 0) parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`)
    if (months > 0) parts.push(`${months} ${months === 1 ? 'mo' : 'mos'}`)
    return parts.join(' ')
  }
}
```

- [ ] **Step 5: Write `src/domain/ProjectView.ts`**

```ts
import type { Project, ProjectCategory, ProjectStatus } from './types'

const STATUS_LABELS: Record<ProjectStatus, string> = {
  released: 'Released',
  prototype: 'Prototype',
  'in-progress': 'In progress',
  archived: 'Archived',
}

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  platform: 'Platform',
  agents: 'Agent system',
  data: 'Data pipeline',
  web: 'Web app',
}

/** Everything a card derives from a project, kept out of the component. */
export class ProjectView {
  readonly project: Project

  constructor(project: Project) {
    this.project = project
  }

  get statusLabel(): string {
    return STATUS_LABELS[this.project.status]
  }

  get categoryLabel(): string {
    return CATEGORY_LABELS[this.project.category]
  }

  get showsPrivateNote(): boolean {
    const hasRepoLink = this.project.links.some((link) => link.kind === 'repo')
    return this.project.repoVisibility === 'private' && !hasRepoLink
  }
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test && npm run typecheck`
Expected: `22 passed`, no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A -- . ':(exclude)docs'
git commit -m "feat: add DateRange and ProjectView domain classes"
```

---

### Task 4: ApiClient, ContentStore and the useContent hook

**Files:**
- Create: `src/api/ApiClient.ts`, `src/api/ApiClient.test.ts`, `src/state/ContentStore.ts`, `src/state/ContentStore.test.ts`, `src/state/container.ts`, `src/hooks/useContent.ts`

**Interfaces:**
- Consumes: types and `parseContent` (Task 2), fixtures (Task 3).
- Produces:
  - `class ApiError extends Error` with `status: number`
  - `type ContentResult = { changed: false } | { changed: true; content: Content }`
  - `new ApiClient(baseUrl: string, fetcher?: typeof fetch)` with `getContent(knownVersion?: string): Promise<ContentResult>`, `login(password: string): Promise<{ accessToken: string; expiresIn: number }>`, `listProjects(): Promise<Project[]>`, `createProject(input: ProjectInput, token: string): Promise<Project>`, `updateProject(id: number, input: ProjectInput, token: string): Promise<Project>`, `deleteProject(id: number, token: string): Promise<void>`
  - `interface ContentSource { getContent(knownVersion?: string): Promise<ContentResult> }`
  - `new ContentStore(initial: Content, source: ContentSource)` with `subscribe(listener): () => void`, `getSnapshot(): Content`, `revalidate(): Promise<boolean>`
  - `apiClient`, `contentStore` from `src/state/container.ts`
  - `useContent(store: ContentStore): Content`

- [ ] **Step 1: Write the failing ApiClient tests**

`src/api/ApiClient.test.ts`:

```ts
// @vitest-environment node
import type { Mock } from 'vitest'
import { makeContent, makeProject } from '../test/fixtures'
import { ApiClient, ApiError } from './ApiClient'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function clientAnswering(response: Response) {
  const fetcher: Mock<typeof fetch> = vi.fn(async () => response)
  return { client: new ApiClient('http://api.test/', fetcher), fetcher }
}

function sentHeaders(fetcher: Mock<typeof fetch>): Record<string, string> {
  return (fetcher.mock.calls[0][1]?.headers ?? {}) as Record<string, string>
}

describe('ApiClient.getContent', () => {
  it('returns parsed content on 200', async () => {
    const content = makeContent()
    const { client, fetcher } = clientAnswering(json(content))

    const result = await client.getContent()

    expect(result).toEqual({ changed: true, content })
    expect(fetcher.mock.calls[0][0]).toBe('http://api.test/api/v1/content')
    expect(sentHeaders(fetcher)['If-None-Match']).toBeUndefined()
  })

  it('sends the known version as an ETag and reports 304 as unchanged', async () => {
    const { client, fetcher } = clientAnswering(new Response(null, { status: 304 }))

    const result = await client.getContent('abc123')

    expect(result).toEqual({ changed: false })
    expect(sentHeaders(fetcher)['If-None-Match']).toBe('"abc123"')
  })

  it('throws ApiError on a server error', async () => {
    const { client } = clientAnswering(json({ detail: 'boom' }, 500))

    await expect(client.getContent()).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })

  it('throws when the body is not a content payload', async () => {
    const { client } = clientAnswering(json({ hello: 'world' }))

    await expect(client.getContent()).rejects.toThrow('no version')
  })
})

describe('ApiClient admin calls', () => {
  it('posts the password as JSON and returns the token', async () => {
    const { client, fetcher } = clientAnswering(json({ accessToken: 't', expiresIn: 1800 }))

    const result = await client.login('secret')

    const init = fetcher.mock.calls[0][1]
    expect(result).toEqual({ accessToken: 't', expiresIn: 1800 })
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"password":"secret"}')
    expect(sentHeaders(fetcher)['Content-Type']).toBe('application/json')
  })

  it('surfaces the API detail message on failure', async () => {
    const { client } = clientAnswering(json({ detail: 'Wrong password' }, 401))

    const error = await client.login('nope').catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect((error as ApiError).message).toBe('Wrong password')
  })

  it('joins validation messages from a 422', async () => {
    const detail = [{ msg: 'slug is invalid' }, { msg: 'title is required' }]
    const { client } = clientAnswering(json({ detail }, 422))

    await expect(client.createProject(makeProject(), 't')).rejects.toThrow(
      'slug is invalid; title is required',
    )
  })

  it('sends the bearer token on writes', async () => {
    const { client, fetcher } = clientAnswering(json(makeProject({ id: 9 })))

    await client.updateProject(9, makeProject(), 'tok')

    expect(fetcher.mock.calls[0][0]).toBe('http://api.test/api/v1/projects/9')
    expect(fetcher.mock.calls[0][1]?.method).toBe('PUT')
    expect(sentHeaders(fetcher).Authorization).toBe('Bearer tok')
  })

  it('resolves a 204 delete with no body', async () => {
    const { client } = clientAnswering(new Response(null, { status: 204 }))

    await expect(client.deleteProject(9, 'tok')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Write the failing ContentStore tests**

`src/state/ContentStore.test.ts`:

```ts
// @vitest-environment node
import type { ContentResult } from '../api/ApiClient'
import { makeContent } from '../test/fixtures'
import { ContentStore } from './ContentStore'

function storeAnswering(answer: () => Promise<ContentResult>) {
  const source = { getContent: vi.fn(answer) }
  const store = new ContentStore(makeContent({ version: 'v1' }), source)
  const listener = vi.fn()
  store.subscribe(listener)
  return { store, source, listener }
}

describe('ContentStore', () => {
  it('starts from the content it was given', () => {
    const { store } = storeAnswering(async () => ({ changed: false }))

    expect(store.getSnapshot().version).toBe('v1')
  })

  it('asks the source with its current version', async () => {
    const { store, source } = storeAnswering(async () => ({ changed: false }))

    await store.revalidate()

    expect(source.getContent).toHaveBeenCalledWith('v1')
  })

  it('keeps its content and stays quiet on "unchanged"', async () => {
    const { store, listener } = storeAnswering(async () => ({ changed: false }))

    expect(await store.revalidate()).toBe(false)
    expect(listener).not.toHaveBeenCalled()
    expect(store.getSnapshot().version).toBe('v1')
  })

  it('replaces its content and notifies on a new version', async () => {
    const fresh = makeContent({ version: 'v2', projects: [] })
    const { store, listener } = storeAnswering(async () => ({ changed: true, content: fresh }))

    expect(await store.revalidate()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toBe(fresh)
  })

  it('ignores a 200 that carries the version it already has', async () => {
    const same = makeContent({ version: 'v1' })
    const { store, listener } = storeAnswering(async () => ({ changed: true, content: same }))

    expect(await store.revalidate()).toBe(false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps its content when the source fails', async () => {
    const { store, listener } = storeAnswering(async () => {
      throw new Error('offline')
    })

    expect(await store.revalidate()).toBe(false)
    expect(listener).not.toHaveBeenCalled()
    expect(store.getSnapshot().version).toBe('v1')
  })

  it('stops notifying a listener that unsubscribed', async () => {
    const fresh = makeContent({ version: 'v2' })
    const source = { getContent: async (): Promise<ContentResult> => ({ changed: true, content: fresh }) }
    const store = new ContentStore(makeContent({ version: 'v1' }), source)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    await store.revalidate()

    expect(listener).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run src/api src/state`
Expected: FAIL, unresolved imports `./ApiClient` and `./ContentStore`.

- [ ] **Step 4: Write `src/api/ApiClient.ts`**

```ts
import { parseContent } from '../data/parseContent'
import type { Content, Project, ProjectInput } from '../domain/types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export type ContentResult = { changed: false } | { changed: true; content: Content }

export interface LoginResult {
  accessToken: string
  expiresIn: number
}

/** The only place in the app that knows the API's URLs and wire format. */
export class ApiClient {
  private readonly baseUrl: string
  private readonly fetcher: typeof fetch

  constructor(baseUrl: string, fetcher: typeof fetch = (input, init) => fetch(input, init)) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.fetcher = fetcher
  }

  async getContent(knownVersion?: string): Promise<ContentResult> {
    const headers: Record<string, string> = {}
    if (knownVersion) headers['If-None-Match'] = `"${knownVersion}"`
    const response = await this.fetcher(`${this.baseUrl}/api/v1/content`, { headers })
    if (response.status === 304) return { changed: false }
    if (!response.ok) throw new ApiError(response.status, 'Could not load content')
    return { changed: true, content: parseContent(await response.json()) }
  }

  login(password: string): Promise<LoginResult> {
    return this.send<LoginResult>('POST', '/api/v1/auth/login', { password })
  }

  listProjects(): Promise<Project[]> {
    return this.send<Project[]>('GET', '/api/v1/projects')
  }

  createProject(input: ProjectInput, token: string): Promise<Project> {
    return this.send<Project>('POST', '/api/v1/projects', input, token)
  }

  updateProject(id: number, input: ProjectInput, token: string): Promise<Project> {
    return this.send<Project>('PUT', `/api/v1/projects/${id}`, input, token)
  }

  async deleteProject(id: number, token: string): Promise<void> {
    await this.send<undefined>('DELETE', `/api/v1/projects/${id}`, undefined, token)
  }

  private async send<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) throw new ApiError(response.status, await ApiClient.describe(response))
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  /** FastAPI sends `detail` as a string for HTTP errors and as a list for validation errors. */
  private static async describe(response: Response): Promise<string> {
    const fallback = `Request failed (${response.status})`
    let data: unknown
    try {
      data = await response.json()
    } catch {
      return fallback
    }
    if (typeof data !== 'object' || data === null || !('detail' in data)) return fallback
    const detail = data.detail
    if (typeof detail === 'string') return detail
    if (!Array.isArray(detail)) return fallback
    const messages = detail
      .map((item: unknown) =>
        typeof item === 'object' && item !== null && 'msg' in item && typeof item.msg === 'string'
          ? item.msg
          : '',
      )
      .filter((message) => message !== '')
    return messages.length > 0 ? messages.join('; ') : fallback
  }
}
```

- [ ] **Step 5: Write `src/state/ContentStore.ts`**

```ts
import type { ContentResult } from '../api/ApiClient'
import type { Content } from '../domain/types'

type Listener = () => void

export interface ContentSource {
  getContent(knownVersion?: string): Promise<ContentResult>
}

/**
 * Holds the content the page renders. It starts from the bundled snapshot,
 * and `revalidate` replaces it only when the source has a newer version.
 * A failed or slow source never changes what the visitor sees.
 */
export class ContentStore {
  private content: Content
  private readonly source: ContentSource
  private readonly listeners = new Set<Listener>()

  constructor(initial: Content, source: ContentSource) {
    this.content = initial
    this.source = source
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): Content => this.content

  async revalidate(): Promise<boolean> {
    let result: ContentResult
    try {
      result = await this.source.getContent(this.content.version)
    } catch {
      return false
    }
    if (!result.changed || result.content.version === this.content.version) return false
    this.content = result.content
    for (const listener of this.listeners) listener()
    return true
  }
}
```

- [ ] **Step 6: Write `src/state/container.ts` and `src/hooks/useContent.ts`**

`src/state/container.ts`:

```ts
import { ApiClient } from '../api/ApiClient'
import { parseContent } from '../data/parseContent'
import rawSnapshot from '../data/snapshot.json'
import { ContentStore } from './ContentStore'

export const apiClient = new ApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:8000')
export const contentStore = new ContentStore(parseContent(rawSnapshot), apiClient)
```

`src/hooks/useContent.ts`:

```ts
import { useEffect, useSyncExternalStore } from 'react'
import type { Content } from '../domain/types'
import type { ContentStore } from '../state/ContentStore'

/** Renders from the store at once, then asks the API for anything newer. */
export function useContent(store: ContentStore): Content {
  const content = useSyncExternalStore(store.subscribe, store.getSnapshot)

  useEffect(() => {
    void store.revalidate()
  }, [store])

  return content
}
```

- [ ] **Step 7: Run the tests**

Run: `npm test && npm run typecheck`
Expected: `38 passed`, no type errors.

- [ ] **Step 8: Commit**

```bash
git add -A -- . ':(exclude)docs'
git commit -m "feat: add ApiClient and a snapshot-first ContentStore"
```

---

### Task 5: Design tokens, global styles, fonts, brand icons, profile data

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `src/components/BrandIcon.tsx`, `src/data/profile.ts`
- Modify: `src/main.tsx` (replace whole file)

**Interfaces:**
- Produces:
  - CSS custom properties listed below; global classes `.container`, `.mono`, `.skip-link`, `.visually-hidden`
  - `BrandIcon({ name, size? })`, `type BrandName = 'github' | 'instagram' | 'medium' | 'linkedin'`
  - `PROFILE` (`name, eyebrow, summary, contactLine, cvUrl, avatarUrl, siteRepo, apiRepo`), `CONTACTS: readonly Contact[]`, `type ContactKind`, `interface Contact { kind, label, value, href }`

- [ ] **Step 1: Write `src/styles/tokens.css`**

```css
:root {
  color-scheme: dark;

  --bg: #0f0f23;
  --surface: #15152d;
  --border: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.18);
  --text: #e5e7eb;
  --text-muted: #9ca3af;
  --accent: #6366f1;
  --accent-text: #a5b4fc;
  --accent-solid: #4f46e5;
  --accent-solid-hover: #4338ca;
  --accent-wash: rgba(99, 102, 241, 0.07);

  --radius: 12px;
  --radius-sm: 6px;
  --maxw: 1080px;
  --gutter: clamp(1rem, 4vw, 2rem);
  --nav-h: 56px;

  --font-sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
```

- [ ] **Step 2: Write `src/styles/global.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
  scroll-padding-top: calc(var(--nav-h) + 16px);
}

@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 1rem;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3,
p,
ul,
ol {
  margin: 0;
}

ul,
ol {
  padding: 0;
  list-style: none;
}

a {
  color: var(--accent-text);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 4px;
}

img,
svg {
  display: block;
  max-width: 100%;
}

button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}

.container {
  width: 100%;
  max-width: var(--maxw);
  margin-inline: auto;
  padding-inline: var(--gutter);
}

.mono {
  font-family: var(--font-mono);
}

.skip-link {
  position: absolute;
  top: -100px;
  left: var(--gutter);
  z-index: 100;
  padding: 8px 12px;
  background: var(--accent-solid);
  color: #fff;
  border-radius: var(--radius-sm);
}

.skip-link:focus {
  top: 8px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

- [ ] **Step 3: Write `src/components/BrandIcon.tsx`**

LinkedIn is no longer in the `simple-icons` package, so its path is a constant here.

```tsx
import { siGithub, siInstagram, siMedium } from 'simple-icons'

const LINKEDIN_PATH =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'

const BRAND_PATHS = {
  github: siGithub.path,
  instagram: siInstagram.path,
  medium: siMedium.path,
  linkedin: LINKEDIN_PATH,
} as const

export type BrandName = keyof typeof BRAND_PATHS

/** A 24-unit brand mark that takes the surrounding text colour. Always decorative. */
export function BrandIcon({ name, size = 18 }: { name: BrandName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={BRAND_PATHS[name]} />
    </svg>
  )
}
```

If `simple-icons` no longer exports `siGithub`, `siInstagram` or `siMedium`, replace that import with a string constant holding the brand's official 24×24 SVG path, the same way `LINKEDIN_PATH` does.

- [ ] **Step 4: Write `src/data/profile.ts`**

```ts
/** Static facts about the owner. These do not come from the API. */
export const PROFILE = {
  name: 'Tomáš Maxim',
  eyebrow: 'Python Developer · Bratislava, Slovakia · Remote (EU)',
  summary:
    'Software Engineer at Iron Mountain. I build backend systems, data pipelines and LLM agent loops in Python, with TypeScript on the front end.',
  contactLine: 'Email reaches me fastest.',
  cvUrl: `${import.meta.env.BASE_URL}cv/tomas-maxim-cv.pdf`,
  avatarUrl: `${import.meta.env.BASE_URL}avatar.png`,
  siteRepo: 'https://github.com/FETKlOkAn2/portfolio',
  apiRepo: 'https://github.com/FETKlOkAn2/portfolio_backend',
} as const

export type ContactKind = 'email' | 'linkedin' | 'github' | 'phone' | 'instagram'

export interface Contact {
  kind: ContactKind
  label: string
  value: string
  href: string
}

export const CONTACTS: readonly Contact[] = [
  {
    kind: 'email',
    label: 'Email',
    value: 'tomas.maxim33@gmail.com',
    href: 'mailto:tomas.maxim33@gmail.com',
  },
  {
    kind: 'linkedin',
    label: 'LinkedIn',
    value: 'tomas-maxim',
    href: 'https://linkedin.com/in/tomas-maxim-870866320/',
  },
  { kind: 'github', label: 'GitHub', value: 'FETKlOkAn2', href: 'https://github.com/FETKlOkAn2' },
  { kind: 'phone', label: 'Phone', value: '+421 904 848 636', href: 'tel:+421904848636' },
  {
    kind: 'instagram',
    label: 'Instagram',
    value: '@tomasmaxim',
    href: 'https://www.instagram.com/tomasmaxim/',
  },
]
```

- [ ] **Step 5: Load fonts and styles in `src/main.tsx`**

Replace the whole file:

```tsx
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './styles/tokens.css'
import './styles/global.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: Verify**

```bash
npm test && npm run typecheck && npm run build
```

Expected: `38 passed`, no type errors, build succeeds. `ls dist/assets | grep -c woff2` prints a number above 0.

- [ ] **Step 7: Commit**

```bash
git add -A -- . ':(exclude)docs'
git commit -m "feat: add design tokens, global styles, self-hosted fonts and brand icons"
```

---

### Task 6: Nav, Section, Hero, Footer

**Files:**
- Create: `src/hooks/useActiveSection.ts`, `src/components/Nav.tsx`, `src/components/Nav.module.css`, `src/components/Section.tsx`, `src/components/Section.module.css`, `src/components/Hero.tsx`, `src/components/Hero.module.css`, `src/components/Footer.tsx`, `src/components/Footer.module.css`, `src/components/layout.test.tsx`

**Interfaces:**
- Consumes: `PROFILE` (Task 5), global classes (Task 5).
- Produces: `useActiveSection(ids: readonly string[]): string | null`; `Nav()`; `Section({ id, title, children })`; `Hero()`; `Footer()`. Section ids used across the app: `top`, `projects`, `experience`, `writing`, `certificates`, `contact`.

- [ ] **Step 1: Write the failing tests**

`src/components/layout.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { Footer } from './Footer'
import { Hero } from './Hero'
import { Nav } from './Nav'
import { Section } from './Section'

describe('Nav', () => {
  it('links to every section and to the CV', () => {
    render(<Nav />)

    for (const [name, href] of [
      ['Projects', '#projects'],
      ['Experience', '#experience'],
      ['Writing', '#writing'],
      ['Certificates', '#certificates'],
      ['Contact', '#contact'],
    ]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
    }
    expect(screen.getByRole('link', { name: 'CV' })).toHaveAttribute(
      'href',
      expect.stringMatching(/cv\/tomas-maxim-cv\.pdf$/),
    )
  })

  it('toggles the menu button state', () => {
    render(<Nav />)
    const button = screen.getByRole('button', { name: 'Menu' })

    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('Hero', () => {
  it('shows the name, role line and both actions', () => {
    render(<Hero />)

    expect(screen.getByRole('heading', { level: 1, name: 'Tomáš Maxim' })).toBeInTheDocument()
    expect(
      screen.getByText('Python Developer · Bratislava, Slovakia · Remote (EU)'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View projects' })).toHaveAttribute('href', '#projects')
    expect(screen.getByRole('link', { name: 'Download CV' })).toHaveAttribute(
      'href',
      expect.stringMatching(/cv\/tomas-maxim-cv\.pdf$/),
    )
  })
})

describe('Section', () => {
  it('labels the region with its heading', () => {
    render(
      <Section id="projects" title="Projects">
        <p>body</p>
      </Section>,
    )

    expect(screen.getByRole('region', { name: 'Projects' })).toHaveAttribute('id', 'projects')
    expect(screen.getByRole('heading', { level: 2, name: 'Projects' })).toBeInTheDocument()
  })
})

describe('Footer', () => {
  it('links to both source repositories', () => {
    render(<Footer />)

    expect(screen.getByRole('link', { name: 'Site source' })).toHaveAttribute(
      'href',
      'https://github.com/FETKlOkAn2/portfolio',
    )
    expect(screen.getByRole('link', { name: 'API source' })).toHaveAttribute(
      'href',
      'https://github.com/FETKlOkAn2/portfolio_backend',
    )
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/layout.test.tsx`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Write `src/hooks/useActiveSection.ts`**

```ts
import { useEffect, useState } from 'react'

/** Returns the id of the section crossing the middle of the viewport. Pass a stable array. */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id)
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    for (const id of ids) {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [ids])

  return active
}
```

- [ ] **Step 4: Write Nav**

`src/components/Nav.tsx`:

```tsx
import { Download, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { PROFILE } from '../data/profile'
import { useActiveSection } from '../hooks/useActiveSection'
import styles from './Nav.module.css'

const LINKS = [
  { id: 'projects', label: 'Projects' },
  { id: 'experience', label: 'Experience' },
  { id: 'writing', label: 'Writing' },
  { id: 'certificates', label: 'Certificates' },
  { id: 'contact', label: 'Contact' },
] as const

const SECTION_IDS = LINKS.map((link) => link.id)

export function Nav() {
  const [open, setOpen] = useState(false)
  const active = useActiveSection(SECTION_IDS)

  return (
    <header className={styles.header}>
      <nav className={`container ${styles.nav}`} aria-label="Primary">
        <a href="#top" className={styles.name}>
          {PROFILE.name}
        </a>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          <span className="visually-hidden">Menu</span>
        </button>
        <ul id="nav-links" className={styles.links} data-open={open}>
          {LINKS.map((link) => (
            <li key={link.id}>
              <a
                href={`#${link.id}`}
                aria-current={active === link.id ? 'true' : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a href={PROFILE.cvUrl} target="_blank" rel="noreferrer" className={styles.cv}>
              <Download size={16} strokeWidth={1.75} aria-hidden="true" />
              CV
            </a>
          </li>
        </ul>
      </nav>
    </header>
  )
}
```

`src/components/Nav.module.css`:

```css
.header {
  position: sticky;
  top: 0;
  z-index: 10;
  height: var(--nav-h);
  background: rgba(15, 15, 35, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  height: 100%;
}

.name {
  color: var(--text);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.name:hover {
  text-decoration: none;
}

.toggle {
  display: none;
}

.links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.links a {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0 0.75rem;
  color: var(--text-muted);
  font-size: 0.9375rem;
  border-radius: var(--radius-sm);
  transition: color 150ms;
}

.links a:hover,
.links a[aria-current='true'] {
  color: var(--text);
  text-decoration: none;
}

.links a.cv {
  min-height: 36px;
  margin-left: 0.5rem;
  color: var(--text);
  border: 1px solid var(--border-strong);
  transition: border-color 150ms;
}

.links a.cv:hover {
  border-color: var(--accent);
}

@media (max-width: 720px) {
  .toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-right: -10px;
    background: none;
    border: 0;
    cursor: pointer;
  }

  .links {
    display: none;
    position: absolute;
    top: var(--nav-h);
    right: 0;
    left: 0;
    flex-direction: column;
    align-items: stretch;
    padding: 0.5rem var(--gutter) 1rem;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }

  .links[data-open='true'] {
    display: flex;
  }

  .links a.cv {
    align-self: flex-start;
    margin: 0.5rem 0 0 0.75rem;
  }
}
```

- [ ] **Step 5: Write Section**

`src/components/Section.tsx`:

```tsx
import type { ReactNode } from 'react'
import styles from './Section.module.css'

export function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        <h2 id={`${id}-title`} className={styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </section>
  )
}
```

`src/components/Section.module.css`:

```css
.section {
  padding-block: clamp(3rem, 7vw, 5rem);
  border-top: 1px solid var(--border);
}

.title {
  margin-bottom: 2rem;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
```

- [ ] **Step 6: Write Hero**

`src/components/Hero.tsx`:

```tsx
import { Download } from 'lucide-react'
import { PROFILE } from '../data/profile'
import styles from './Hero.module.css'

export function Hero() {
  return (
    <section id="top" className={styles.hero}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.copy}>
          <p className={`mono ${styles.eyebrow}`}>{PROFILE.eyebrow}</p>
          <h1 className={styles.name}>{PROFILE.name}</h1>
          <p className={styles.summary}>{PROFILE.summary}</p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#projects">
              View projects
            </a>
            <a className={styles.secondary} href={PROFILE.cvUrl} target="_blank" rel="noreferrer">
              <Download size={16} strokeWidth={1.75} aria-hidden="true" />
              Download CV
            </a>
          </div>
        </div>
        <img className={styles.avatar} src={PROFILE.avatarUrl} alt="" width={128} height={128} />
      </div>
    </section>
  )
}
```

`src/components/Hero.module.css`:

```css
.hero {
  padding-block: clamp(3.5rem, 10vw, 7rem) clamp(3rem, 8vw, 5.5rem);
}

.inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3rem;
}

.copy {
  max-width: 640px;
}

.eyebrow {
  margin-bottom: 1rem;
  color: var(--accent-text);
  font-size: 0.8125rem;
  letter-spacing: 0.04em;
}

.name {
  font-size: clamp(2.25rem, 6vw, 3.25rem);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.summary {
  margin-top: 1.25rem;
  color: var(--text-muted);
  font-size: 1.125rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 2rem;
}

.primary,
.secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0 1.1rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  transition:
    background-color 150ms,
    border-color 150ms;
}

.primary:hover,
.secondary:hover {
  text-decoration: none;
}

.primary {
  color: #fff;
  background: var(--accent-solid);
}

.primary:hover {
  background: var(--accent-solid-hover);
}

.secondary {
  color: var(--text);
  border: 1px solid var(--border-strong);
}

.secondary:hover {
  border-color: var(--accent);
}

.avatar {
  flex: none;
  width: 128px;
  height: 128px;
  object-fit: cover;
  object-position: top;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
}

@media (max-width: 720px) {
  .inner {
    flex-direction: column-reverse;
    align-items: flex-start;
    gap: 1.5rem;
  }

  .avatar {
    width: 88px;
    height: 88px;
  }
}
```

- [ ] **Step 7: Write Footer**

`src/components/Footer.tsx`:

```tsx
import { PROFILE } from '../data/profile'
import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p>
          © {new Date().getFullYear()} {PROFILE.name}
        </p>
        <p>
          Built with TypeScript, React, FastAPI and SQLAlchemy. <a href={PROFILE.siteRepo}>Site source</a>
          {' · '}
          <a href={PROFILE.apiRepo}>API source</a>
        </p>
      </div>
    </footer>
  )
}
```

`src/components/Footer.module.css`:

```css
.footer {
  padding-block: 2rem;
  color: var(--text-muted);
  font-size: 0.875rem;
  border-top: 1px solid var(--border);
}

.inner {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 2rem;
}
```

- [ ] **Step 8: Run the tests**

Run: `npm test && npm run typecheck`
Expected: `43 passed`, no type errors.

- [ ] **Step 9: Commit**

```bash
git add -A -- . ':(exclude)docs'
git commit -m "feat: add nav, hero, section and footer components"
```

---

### Task 7: Project cards

**Files:**
- Create: `src/components/FlowLine.tsx`, `src/components/FlowLine.module.css`, `src/components/ProjectCard.tsx`, `src/components/ProjectCard.module.css`, `src/components/ProjectGrid.tsx`, `src/components/ProjectGrid.module.css`, `src/components/ProjectCard.test.tsx`

**Interfaces:**
- Consumes: `Project`, `ProjectLink` (Task 2), `ProjectView` (Task 3), `BrandIcon` (Task 5), `makeProject` (Task 3).
- Produces: `FlowLine({ steps: string[] })`, `ProjectCard({ project: Project })`, `ProjectGrid({ projects: Project[] })`.

- [ ] **Step 1: Write the failing tests**

`src/components/ProjectCard.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import { makeProject } from '../test/fixtures'
import { ProjectCard } from './ProjectCard'
import { ProjectGrid } from './ProjectGrid'

describe('ProjectCard', () => {
  it('shows the title, tagline, description and labels', () => {
    render(<ProjectCard project={makeProject({ status: 'prototype', category: 'agents' })} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Demo' })).toBeInTheDocument()
    expect(screen.getByText('A demo project.')).toBeInTheDocument()
    expect(screen.getByText('Longer text about the demo.')).toBeInTheDocument()
    expect(screen.getByText('Agent system')).toBeInTheDocument()
    expect(screen.getByText('Prototype')).toBeInTheDocument()
  })

  it('lists the pipeline steps in order', () => {
    render(<ProjectCard project={makeProject({ flow: ['draft', 'critique', 'revise'] })} />)

    const steps = within(screen.getByRole('list', { name: 'Pipeline' })).getAllByRole('listitem')

    expect(steps.map((step) => step.textContent)).toEqual(['draft', 'critique', 'revise'])
  })

  it('leaves the pipeline and highlights out when a project has none', () => {
    render(<ProjectCard project={makeProject({ flow: [], highlights: [] })} />)

    expect(screen.queryByRole('list', { name: 'Pipeline' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Highlights' })).not.toBeInTheDocument()
  })

  it('lists the technologies', () => {
    render(<ProjectCard project={makeProject({ tech: ['Python', 'Redis'] })} />)

    const tech = within(screen.getByRole('list', { name: 'Technologies' })).getAllByRole('listitem')

    expect(tech.map((item) => item.textContent)).toEqual(['Python', 'Redis'])
  })

  it('opens links in a new tab without leaking the opener', () => {
    const project = makeProject({
      links: [{ kind: 'live', label: 'Open sandbox', url: 'https://sandbox-aptum.com/practice' }],
    })
    render(<ProjectCard project={project} />)

    const link = screen.getByRole('link', { name: 'Open sandbox' })

    expect(link).toHaveAttribute('href', 'https://sandbox-aptum.com/practice')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('says the repo is private when there is no repo link to show', () => {
    render(<ProjectCard project={makeProject({ repoVisibility: 'private', links: [] })} />)

    expect(screen.getByText('Private repo')).toBeInTheDocument()
  })

  it('does not mention privacy on a public project', () => {
    render(<ProjectCard project={makeProject()} />)

    expect(screen.queryByText('Private repo')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Source' })).toBeInTheDocument()
  })
})

describe('ProjectGrid', () => {
  it('renders one card per project, in the order given', () => {
    const projects = [
      makeProject({ id: 1, slug: 'a', title: 'First' }),
      makeProject({ id: 2, slug: 'b', title: 'Second' }),
    ]
    render(<ProjectGrid projects={projects} />)

    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

    expect(titles).toEqual(['First', 'Second'])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/ProjectCard.test.tsx`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Write FlowLine**

`src/components/FlowLine.tsx`:

```tsx
import { ArrowRight } from 'lucide-react'
import styles from './FlowLine.module.css'

/** A pipeline as text: step, arrow, step. This is how a card shows an agent loop. */
export function FlowLine({ steps }: { steps: string[] }) {
  return (
    <ol className={`mono ${styles.flow}`} aria-label="Pipeline">
      {steps.map((step, index) => (
        <li key={step}>
          {index > 0 && <ArrowRight size={12} aria-hidden="true" className={styles.arrow} />}
          {step}
        </li>
      ))}
    </ol>
  )
}
```

`src/components/FlowLine.module.css`:

```css
.flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
  padding: 0.6rem 0.75rem;
  color: var(--text);
  font-size: 0.78125rem;
  background: var(--accent-wash);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.flow li {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.arrow {
  flex: none;
  color: var(--accent);
}
```

- [ ] **Step 4: Write ProjectCard**

`src/components/ProjectCard.tsx`:

```tsx
import { ArrowUpRight, FileText, Lock } from 'lucide-react'
import { ProjectView } from '../domain/ProjectView'
import type { Project, ProjectLink } from '../domain/types'
import { BrandIcon } from './BrandIcon'
import { FlowLine } from './FlowLine'
import styles from './ProjectCard.module.css'

function LinkIcon({ link }: { link: ProjectLink }) {
  if (link.kind === 'repo' && link.url.startsWith('https://github.com/')) {
    return <BrandIcon name="github" size={16} />
  }
  if (link.kind === 'doc') {
    return <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
  }
  return <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
}

export function ProjectCard({ project }: { project: Project }) {
  const view = new ProjectView(project)

  return (
    <article className={styles.card} data-featured={project.featured}>
      <header className={`mono ${styles.head}`}>
        <span className={styles.category}>{view.categoryLabel}</span>
        <span className={styles.status} data-status={project.status}>
          {view.statusLabel}
        </span>
      </header>

      <h3 className={styles.title}>{project.title}</h3>
      <p className={styles.tagline}>{project.tagline}</p>
      <p className={styles.description}>{project.description}</p>

      {project.highlights.length > 0 && (
        <ul className={styles.highlights} aria-label="Highlights">
          {project.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      )}

      {project.flow.length > 0 && <FlowLine steps={project.flow} />}

      <ul className={`mono ${styles.tech}`} aria-label="Technologies">
        {project.tech.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>

      {(project.links.length > 0 || view.showsPrivateNote) && (
        <footer className={styles.links}>
          {project.links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
              <LinkIcon link={link} />
              {link.label}
            </a>
          ))}
          {view.showsPrivateNote && (
            <span className={styles.private}>
              <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
              Private repo
            </span>
          )}
        </footer>
      )}
    </article>
  )
}
```

`src/components/ProjectCard.module.css`:

```css
.card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: border-color 150ms;
}

.card:hover {
  border-color: var(--border-strong);
}

.card[data-featured='true'] {
  grid-column: 1 / -1;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.category {
  color: var(--accent-text);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-muted);
}

.status::before {
  content: '';
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
}

/* The one colour outside the tokens: a released project gets a green dot. */
.status[data-status='released']::before {
  background: #4ade80;
}

.title {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.tagline {
  color: var(--text);
}

.description {
  max-width: 65ch;
  color: var(--text-muted);
}

.highlights {
  display: grid;
  gap: 0.35rem;
  color: var(--text-muted);
  font-size: 0.9375rem;
}

.card[data-featured='true'] .highlights {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  column-gap: 2rem;
}

.highlights li {
  position: relative;
  padding-left: 1rem;
}

.highlights li::before {
  content: '';
  position: absolute;
  top: 0.75em;
  left: 0;
  width: 6px;
  height: 1px;
  background: var(--accent);
}

.tech {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: auto;
  padding-top: 0.5rem;
}

.tech li {
  padding: 0.15rem 0.5rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.25rem;
  padding-top: 0.75rem;
  font-size: 0.9375rem;
  border-top: 1px solid var(--border);
}

.links a {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 32px;
}

.private {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-muted);
}
```

- [ ] **Step 5: Write ProjectGrid**

`src/components/ProjectGrid.tsx`:

```tsx
import type { Project } from '../domain/types'
import { ProjectCard } from './ProjectCard'
import styles from './ProjectGrid.module.css'

export function ProjectGrid({ projects }: { projects: Project[] }) {
  return (
    <div className={styles.grid}>
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
```

`src/components/ProjectGrid.module.css`:

```css
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}

@media (min-width: 860px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test && npm run typecheck`
Expected: `51 passed`, no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A -- . ':(exclude)docs'
git commit -m "feat: add project cards with pipeline flow lines"
```

---

### Task 8: Remaining sections and the assembled page

**Files:**
- Create: `src/components/ExperienceTimeline.tsx`, `src/components/ExperienceTimeline.module.css`, `src/components/ArticleList.tsx`, `src/components/ArticleList.module.css`, `src/components/CertificateList.tsx`, `src/components/CertificateList.module.css`, `src/components/ContactLinks.tsx`, `src/components/ContactLinks.module.css`, `src/Site.tsx`, `src/Site.test.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx` (replace both)

**Interfaces:**
- Consumes: everything from Tasks 2 to 7.
- Produces: `ExperienceTimeline({ items: Experience[] })`, `ArticleList({ items: Article[] })`, `CertificateList({ items: Certificate[] })`, `ContactLinks()`, `Site({ store?: ContentStore })`. `App` renders `<Site />`.

- [ ] **Step 1: Write the failing page tests**

`src/Site.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import type { ContentResult } from './api/ApiClient'
import { Site } from './Site'
import { ContentStore } from './state/ContentStore'
import { makeContent, makeProject } from './test/fixtures'

function storeAnswering(answer: () => Promise<ContentResult>) {
  return new ContentStore(makeContent(), { getContent: answer })
}

describe('Site', () => {
  it('renders every section from the content it starts with', () => {
    render(<Site store={storeAnswering(async () => ({ changed: false }))} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Tomáš Maxim' })).toBeInTheDocument()
    for (const title of ['Projects', 'Experience', 'Writing', 'Certificates', 'Contact']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { level: 3, name: 'Demo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Software Engineer' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /A post/ })).toHaveAttribute(
      'href',
      'https://medium.com/post',
    )
    expect(screen.getByRole('heading', { level: 3, name: 'CCNA 1' })).toBeInTheDocument()
  })

  it('shows the date range and length of a current role', () => {
    render(<Site store={storeAnswering(async () => ({ changed: false }))} />)
    const experience = screen.getByRole('region', { name: 'Experience' })

    expect(within(experience).getByText('Jul 2026 – Present')).toBeInTheDocument()
    expect(within(experience).getByText('Iron Mountain')).toBeInTheDocument()
  })

  it('lists five contact links with visible values', () => {
    render(<Site store={storeAnswering(async () => ({ changed: false }))} />)
    const contact = screen.getByRole('region', { name: 'Contact' })

    expect(within(contact).getAllByRole('link')).toHaveLength(5)
    expect(within(contact).getByRole('link', { name: /tomas\.maxim33@gmail\.com/ })).toHaveAttribute(
      'href',
      'mailto:tomas.maxim33@gmail.com',
    )
  })

  it('swaps in newer content when the API answers', async () => {
    const fresh = makeContent({
      version: 'v2',
      projects: [makeProject({ id: 2, slug: 'fresh', title: 'Fresh project' })],
    })
    render(<Site store={storeAnswering(async () => ({ changed: true, content: fresh }))} />)

    expect(await screen.findByRole('heading', { level: 3, name: 'Fresh project' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Demo' })).not.toBeInTheDocument()
  })

  it('keeps rendering its starting content when the API is down', async () => {
    const store = storeAnswering(async () => {
      throw new Error('offline')
    })
    render(<Site store={store} />)

    await store.revalidate()

    expect(screen.getByRole('heading', { level: 3, name: 'Demo' })).toBeInTheDocument()
  })

  it('offers a skip link to the main content', () => {
    render(<Site store={storeAnswering(async () => ({ changed: false }))} />)

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })
})
```

Replace `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the site from the bundled snapshot with the network off', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Tomáš Maxim' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Aptum' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open sandbox' })).toHaveAttribute(
      'href',
      'https://sandbox-aptum.com/practice',
    )
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/Site.test.tsx src/App.test.tsx`
Expected: FAIL. `Site.test.tsx` cannot resolve `./Site`; `App.test.tsx` finds no "Aptum" heading.

- [ ] **Step 3: Write ExperienceTimeline**

`src/components/ExperienceTimeline.tsx`:

```tsx
import { DateRange } from '../domain/DateRange'
import type { Experience } from '../domain/types'
import styles from './ExperienceTimeline.module.css'

export function ExperienceTimeline({ items }: { items: Experience[] }) {
  return (
    <ol className={styles.timeline}>
      {items.map((item) => {
        const range = new DateRange(item.startDate, item.endDate)
        const meta = [item.employmentType, item.location].filter(Boolean).join(' · ')

        return (
          <li key={item.id} className={styles.item} data-current={range.isCurrent}>
            <p className={`mono ${styles.when}`}>
              <span>{range.label()}</span>
              <span className={styles.duration}>{range.duration()}</span>
            </p>
            <div className={styles.body}>
              <h3 className={styles.role}>{item.role}</h3>
              <p>
                <span>{item.company}</span>
                {meta !== '' && <span className={styles.meta}> · {meta}</span>}
              </p>
              {item.summary !== '' && <p className={styles.summary}>{item.summary}</p>}
              {item.skills.length > 0 && (
                <ul className={`mono ${styles.skills}`} aria-label="Skills">
                  {item.skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
```

`src/components/ExperienceTimeline.module.css`:

```css
.item {
  display: grid;
  grid-template-columns: 200px 1fr;
  column-gap: 2rem;
}

.when {
  display: flex;
  flex-direction: column;
  padding-top: 0.2rem;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.duration {
  opacity: 0.75;
}

.body {
  position: relative;
  padding: 0 0 2.25rem 2rem;
  border-left: 1px solid var(--border-strong);
}

.item:last-child .body {
  padding-bottom: 0;
}

.body::before {
  content: '';
  position: absolute;
  top: 0.5rem;
  left: -5px;
  width: 9px;
  height: 9px;
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: 50%;
}

.item[data-current='true'] .body::before {
  background: var(--accent);
  border-color: var(--accent);
}

.role {
  font-size: 1.0625rem;
  font-weight: 600;
}

.meta {
  color: var(--text-muted);
}

.summary {
  max-width: 65ch;
  margin-top: 0.5rem;
  color: var(--text-muted);
}

.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.skills li {
  padding: 0.15rem 0.5rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

@media (max-width: 720px) {
  .item {
    grid-template-columns: 1fr;
  }

  .when {
    flex-direction: row;
    gap: 0.75rem;
    padding: 0 0 0.35rem;
  }

  .body {
    padding-left: 0;
    border-left: 0;
  }

  .body::before {
    display: none;
  }
}
```

- [ ] **Step 4: Write ArticleList**

`src/components/ArticleList.tsx`:

```tsx
import { ArrowUpRight } from 'lucide-react'
import type { Article } from '../domain/types'
import styles from './ArticleList.module.css'

export function ArticleList({ items }: { items: Article[] }) {
  return (
    <ul className={styles.list}>
      {items.map((article) => (
        <li key={article.id}>
          <p className={`mono ${styles.meta}`}>
            {article.publication} · {article.topic}
          </p>
          <h3 className={styles.title}>
            <a href={article.url} target="_blank" rel="noreferrer">
              {article.title}
              <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" className={styles.icon} />
            </a>
          </h3>
          <p className={styles.summary}>{article.summary}</p>
        </li>
      ))}
    </ul>
  )
}
```

`src/components/ArticleList.module.css`:

```css
.list {
  display: grid;
  gap: 1.75rem;
}

.meta {
  margin-bottom: 0.25rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.title {
  font-size: 1.125rem;
  font-weight: 600;
}

.title a {
  color: var(--text);
  transition: color 150ms;
}

.title a:hover {
  color: var(--accent-text);
  text-decoration: none;
}

.icon {
  display: inline;
  margin-left: 0.3rem;
  vertical-align: -2px;
  color: var(--accent-text);
}

.summary {
  max-width: 65ch;
  margin-top: 0.25rem;
  color: var(--text-muted);
}
```

- [ ] **Step 5: Write CertificateList**

`src/components/CertificateList.tsx`:

```tsx
import { Award } from 'lucide-react'
import type { Certificate } from '../domain/types'
import styles from './CertificateList.module.css'

export function CertificateList({ items }: { items: Certificate[] }) {
  return (
    <ul className={styles.list}>
      {items.map((certificate) => (
        <li key={certificate.id} className={styles.item}>
          <Award size={18} strokeWidth={1.75} aria-hidden="true" className={styles.icon} />
          <div>
            <h3 className={styles.title}>{certificate.title}</h3>
            <p className={styles.meta}>
              {certificate.issuer} <span className="mono">· {certificate.issuedLabel}</span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

`src/components/CertificateList.module.css`:

```css
.list {
  display: grid;
  grid-template-columns: 1fr;
}

@media (min-width: 720px) {
  .list {
    grid-template-columns: 1fr 1fr;
    column-gap: 2.5rem;
  }
}

.item {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 0.75rem;
  padding: 0.9rem 0;
  border-top: 1px solid var(--border);
}

.icon {
  margin-top: 0.2rem;
  color: var(--accent);
}

.title {
  font-size: 1rem;
  font-weight: 500;
}

.meta {
  color: var(--text-muted);
  font-size: 0.9375rem;
}
```

- [ ] **Step 6: Write ContactLinks**

`src/components/ContactLinks.tsx`:

```tsx
import { Mail, Phone } from 'lucide-react'
import { CONTACTS, PROFILE } from '../data/profile'
import type { ContactKind } from '../data/profile'
import { BrandIcon } from './BrandIcon'
import styles from './ContactLinks.module.css'

function ContactIcon({ kind }: { kind: ContactKind }) {
  switch (kind) {
    case 'email':
      return <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
    case 'phone':
      return <Phone size={18} strokeWidth={1.75} aria-hidden="true" />
    case 'linkedin':
      return <BrandIcon name="linkedin" />
    case 'github':
      return <BrandIcon name="github" />
    case 'instagram':
      return <BrandIcon name="instagram" />
  }
}

export function ContactLinks() {
  return (
    <>
      <p className={styles.intro}>{PROFILE.contactLine}</p>
      <ul className={styles.list}>
        {CONTACTS.map((contact) => {
          const external = contact.href.startsWith('http')
          return (
            <li key={contact.kind}>
              <a
                className={styles.link}
                href={contact.href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
              >
                <span className={styles.icon}>
                  <ContactIcon kind={contact.kind} />
                </span>
                <span>{contact.label}</span>
                <span className={`mono ${styles.value}`}>{contact.value}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </>
  )
}
```

`src/components/ContactLinks.module.css`:

```css
.intro {
  margin-bottom: 1.5rem;
  color: var(--text-muted);
}

.list {
  max-width: 560px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.list li + li {
  border-top: 1px solid var(--border);
}

.link {
  display: grid;
  grid-template-columns: 20px 88px 1fr;
  align-items: center;
  gap: 0.75rem;
  min-height: 52px;
  padding: 0 1rem;
  color: var(--text);
  transition: background-color 150ms;
}

.link:hover {
  text-decoration: none;
  background: var(--surface);
}

.icon {
  display: inline-flex;
  color: var(--text-muted);
}

.value {
  color: var(--accent-text);
  font-size: 0.875rem;
  text-align: right;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 7: Assemble the page**

`src/Site.tsx`:

```tsx
import { ArticleList } from './components/ArticleList'
import { CertificateList } from './components/CertificateList'
import { ContactLinks } from './components/ContactLinks'
import { ExperienceTimeline } from './components/ExperienceTimeline'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Nav } from './components/Nav'
import { ProjectGrid } from './components/ProjectGrid'
import { Section } from './components/Section'
import { useContent } from './hooks/useContent'
import type { ContentStore } from './state/ContentStore'
import { contentStore } from './state/container'

export function Site({ store = contentStore }: { store?: ContentStore }) {
  const content = useContent(store)

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Section id="projects" title="Projects">
          <ProjectGrid projects={content.projects} />
        </Section>
        <Section id="experience" title="Experience">
          <ExperienceTimeline items={content.experience} />
        </Section>
        <Section id="writing" title="Writing">
          <ArticleList items={content.articles} />
        </Section>
        <Section id="certificates" title="Certificates">
          <CertificateList items={content.certificates} />
        </Section>
        <Section id="contact" title="Contact">
          <ContactLinks />
        </Section>
      </main>
      <Footer />
    </>
  )
}
```

Replace `src/App.tsx`:

```tsx
import { Site } from './Site'

export function App() {
  return <Site />
}
```

- [ ] **Step 8: Run all three gates**

```bash
npm test && npm run typecheck && npm run build
```

Expected: `57 passed`, no type errors, build succeeds.

- [ ] **Step 9: Look at it**

With the Plan A API still on port 8000, run `npm run dev` and open `http://localhost:5173/portfolio/`. Check each line. Fix what fails before committing.

1. At 1280 px wide: the hero is left-aligned with the avatar on the right. The Aptum card spans both columns and its three highlights sit in a row. The other six cards sit two per row.
2. Every card shows a mono category label, a status with a dot, a flow line with arrows (except Face Recognition App), and bordered tech tags with no fill.
3. Aptum has "Open sandbox" and "Private repo". Book Pipeline and BetBrain show only "Private repo". The four public projects show a GitHub mark and "Source".
4. Experience: four rows, newest first, and only Iron Mountain has a filled dot. Iron Mountain reads `Jul 2026 – Present`.
5. At 375 px wide: no horizontal scroll, one column of cards, the nav collapses behind a menu button, the timeline has no line or dots.
6. Tab from the top of the page: the skip link appears first, every link and button shows a 2 px indigo focus ring.
7. Nothing on the page moves except colour changes on hover.
8. Stop the API, hard-reload: the page looks the same. The console shows a failed request and no uncaught error.
9. No emoji, no gradient and no PNG icon anywhere.

- [ ] **Step 10: Commit**

```bash
git add -A -- . ':(exclude)docs'
git commit -m "feat: assemble the page with experience, writing, certificates and contact"
```
