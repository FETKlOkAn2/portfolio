# Portfolio rebuild: design

Date: 2026-10-10
Repos: `FETKlOkAn2/portfolio` (frontend), `FETKlOkAn2/portfolio_backend` (API)

## 1. Where we start

- Frontend: one `index.html` (447 lines, inline JS), `styles.css` (856 lines), `projects.json`. GitHub Pages serves it from `main` at `https://fetklokan2.github.io/portfolio/` (legacy branch build).
- Backend: a 67-line Flask app on Render (`portfolio-backend-y1jy.onrender.com`). One endpoint, `POST /add_project`, checks a shared password and commits to `projects.json` through the GitHub API. No database.
- The "Add New Project" card and its password field show to every visitor.
- Problems in the backend repo: `venv/` (1,100 files) and `.env` are tracked, and commit `3f861e0` contains a `GITHUB_TOKEN` value.
- Content is stale: three projects, no work history, headline says "Developer & Data Analyst".

## 2. Goals

1. Rebuild the frontend in TypeScript and the backend in Python with SQLAlchemy, both object-oriented where objects earn their place.
2. Publish seven projects, including Aptum with its sandbox link and three LLM pipeline projects that show agent loops.
3. Add a work-history timeline from LinkedIn.
4. Keep the current identity (dark navy, indigo accent, same section order) and remove the effects: particles, gradient text, parallax, emoji, PNG icons.
5. The page must render at once, including when the API is asleep.

## 3. Non-goals

- No blog engine, CMS UI for every entity, analytics, contact form, i18n or light theme.
- No server-side rendering. The page stays a static bundle on GitHub Pages.
- No project detail pages or modals. Each card carries its whole story.
- No ESLint setup in this pass. `tsc --noEmit` in strict mode and the test suite are the gates.

## 4. Architecture

```
GitHub Pages (static)                     Render (free web service)          Neon (free Postgres)
┌──────────────────────────┐   GET /api/v1/content    ┌───────────────────┐        ┌──────────┐
│ React + TS bundle        │ ───────────────────────▶ │ FastAPI           │ ─────▶ │ Postgres │
│ + bundled snapshot.json  │   If-None-Match: "v"     │ SQLAlchemy 2 ORM  │        └──────────┘
│                          │ ◀─────────────────────── │ Alembic           │
│ #/admin (lazy chunk)     │   200 payload | 304      │                   │
│                          │ ── Bearer JWT, CRUD ───▶ │                   │
└──────────────────────────┘                          └───────────────────┘
```

The database is the single source of truth. The frontend bundles a snapshot of `GET /api/v1/content` at build time, renders from it on first paint, then revalidates in the background with the snapshot's version as an ETag. A `304` changes nothing. A `200` replaces the content in place. A failed or slow request changes nothing, so a sleeping Render instance costs the visitor zero seconds.

Two repos stay two repos. Deployment wiring for both already exists and nothing gains from merging them.

### Why this shape

| Option | Verdict |
|---|---|
| Static page + content API with bundled snapshot | **Chosen.** Instant paint, a real Python/SQLAlchemy service, and the existing "add a project from the browser" feature survives. |
| Static only, content in TS files | Fastest to build and zero upkeep, but drops the Python backend the owner asked for. |
| Fully dynamic | Render's free tier sleeps after 15 minutes; first visitor waits 30 to 60 seconds for content. |

## 5. Backend (`portfolio_backend`)

Stack: Python 3.13, FastAPI, SQLAlchemy 2 (sync `Session`, typed `Mapped[]` models), Alembic, Pydantic v2, pydantic-settings, PyJWT, argon2-cffi, psycopg 3, uv, pytest. SQLite for local dev and tests, Postgres in production.

```
app/
  main.py                 create_app() factory, CORS, router wiring
  cli.py                  `python -m app.cli seed | hash-password`
  core/config.py          Settings (env-driven)
  core/security.py        PasswordVerifier, TokenService, LoginThrottle
  db/base.py              Base, TimestampMixin
  db/session.py           engine, SessionLocal, get_session
  models/                 Project, Experience, Certificate, Article
  schemas/                ApiModel base (camelCase aliases) + read/write schemas
  repositories/base.py    Repository[ModelT]: list, get, add, update, delete, count
  repositories/content.py ProjectRepository, ExperienceRepository, CertificateRepository, ArticleRepository
  services/content.py     ContentService: aggregate payload + version hash
  services/auth.py        AuthService: login, verify
  services/seed.py        SeedService: seed_if_empty
  api/deps.py             session, services, require_admin
  api/crud.py             build_crud_router(): one factory, four resources
  api/v1/                 content.py, auth.py, router.py
alembic/                  migrations
seeds/content.json        bootstrap content (API shape, camelCase)
tests/
```

### Object model

- `Repository[ModelT]` is a generic base class. Subclasses set `model` and override `ordering()`. `ProjectRepository` adds `get_by_slug`.
- Services take their collaborators through the constructor. Routes hold no logic beyond HTTP mapping.
- `build_crud_router` produces list/create/update/delete routes for any repository and schema pair, so four resources cost one implementation.

### Data model

| Table | Columns |
|---|---|
| `projects` | id, slug (unique), title, tagline, description, highlights (JSON list), tech (JSON list), flow (JSON list), links (JSON list of `{kind,label,url}`), status, category, repo_visibility, featured, sort_order, created_at, updated_at |
| `experience` | id, role, company, employment_type, location, start_date, end_date (null = present), summary, skills (JSON list), created_at, updated_at |
| `certificates` | id, title, issuer, issued_label, sort_order, created_at, updated_at |
| `articles` | id, title, publication, topic, summary, url, sort_order, created_at, updated_at |

Enumerations, validated by Pydantic and stored as short strings:
`status`: `released | prototype | in-progress | archived` · `category`: `platform | agents | data | web` · `repo_visibility`: `public | private` · link `kind`: `live | repo | doc`.

Ordering: projects, certificates and articles by `sort_order, id`; experience by `start_date` descending.

### API (all JSON camelCase, prefix `/api/v1`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/healthz` | none | `{ "status": "ok" }` (no prefix) |
| GET | `/content` | none | `{version, projects, experience, certificates, articles}`. Sends `ETag: "<version>"`, honours `If-None-Match` with `304`. |
| POST | `/auth/login` | none | `{password}` → `{accessToken, expiresIn}`. Five failed attempts per IP per five minutes, then `429`. |
| GET | `/projects`, `/experience`, `/certificates`, `/articles` | none | Ordered list. |
| POST | same four | Bearer | `201`. Duplicate project slug → `409`. |
| PUT | `/<resource>/{id}` | Bearer | Full replace. `404` when missing. |
| DELETE | `/<resource>/{id}` | Bearer | `204`. |

`version` is the first 16 hex characters of the SHA-256 of the canonical JSON payload, so it changes when content changes and never otherwise.

### Auth

One admin. Render holds `ADMIN_PASSWORD_HASH` (argon2id) and `JWT_SECRET`. Login returns an HS256 JWT valid for 30 minutes. The old shared-password-in-body scheme and the `GITHUB_TOKEN` go away.

### Seeding and migrations

The start command runs `alembic upgrade head`, then `python -m app.cli seed`, then uvicorn. The seed inserts `seeds/content.json` into each table that is empty and skips tables that have rows, so it runs on every boot at no risk. Render's free tier has no shell, which is why both run at start.

### Repo hygiene

- Untrack `venv/` and `.env`, and write a real `.gitignore`.
- The owner confirms on GitHub that the token from commit `3f861e0` is revoked. Rewriting history is optional and the owner's call; revocation is the part that matters.

## 6. Frontend (`portfolio`)

Stack: Vite, React 19 function components, TypeScript strict, CSS Modules with design tokens, Vitest + Testing Library, `lucide-react`, `simple-icons`, self-hosted IBM Plex Sans and Mono via `@fontsource`.

```
index.html
src/
  main.tsx, App.tsx              hash switch: "#/admin" → lazy AdminApp, else Site
  domain/types.ts                payload types (unions, no enums)
  domain/DateRange.ts            class: label + duration ("Jul 2026 – Present · 4 mos")
  domain/ProjectView.ts          class: derived labels and link lookups for a Project
  data/snapshot.json             bundled content
  data/parseContent.ts           runtime guard for any payload entering the app
  data/profile.ts                name, hero copy and contact links (static)
  api/ApiClient.ts               class: content, login, CRUD; throws ApiError
  state/ContentStore.ts          class: holds content, revalidates, notifies subscribers
  state/AuthSession.ts           class: token in sessionStorage
  state/container.ts             the three singletons the app shares
  hooks/useContent.ts            useSyncExternalStore over ContentStore
  hooks/useActiveSection.ts      IntersectionObserver for nav highlight
  components/                    Nav, Hero, Section, ProjectCard, FlowLine, ExperienceTimeline,
                                 ArticleList, CertificateList, ContactLinks, Footer, BrandIcon
  admin/                         AdminApp, LoginForm, ProjectAdmin, ProjectEditor, projectDraft, slugify
  styles/tokens.css, global.css
scripts/snapshot.mjs             refresh snapshot.json from the API; keeps the old file on failure
public/                          avatar.png, cv/tomas-maxim-cv.pdf, favicon.svg
.github/workflows/               ci.yml, deploy.yml
```

Classes live in the data layer (`ApiClient`, `ContentStore`, `AuthSession`, `DateRange`, `ProjectView`). Components stay functions, which is how React 19 is written. The TypeScript config uses `erasableSyntaxOnly`, so classes declare fields in full: no parameter properties, no enums.

### Page

Single page, anchor navigation, in this order: Nav, Hero, Projects, Experience, Writing, Certificates, Contact, Footer.

- **Nav**: sticky, name on the left, section links and a CV link on the right. Highlights the section in view. Below 720 px the links collapse behind a menu button with `aria-expanded`.
- **Hero**: left-aligned. Mono eyebrow with role and location, name as `h1`, two sentences, two buttons (View projects, Download CV). Avatar on the right, stacked on mobile.
- **Projects**: two-column grid above 860 px. A `featured` card spans both columns. Card anatomy, top to bottom: category label and status pill, title, tagline, description, up to three highlights, the flow line, tech tags, links.
- **Flow line**: the pipeline as mono text steps joined by arrow icons, for example `outline → draft → critique → revise → extract canon`. This is how the cards show agent loops without diagrams.
- **Experience**: timeline. Dates and duration in a mono left column, role, company, type, location and summary on the right. The current role gets a filled accent dot.
- **Writing**: two article rows with publication, topic, title link and summary.
- **Certificates**: compact two-column rows with one icon, title, issuer and date.
- **Contact**: one sentence and five links (email, LinkedIn, GitHub, phone, Instagram), each with its icon and visible value.
- **Footer**: copyright, stack line, links to both source repos.

Removed from the old site: particle background, hero parallax and blur, gradient text and borders, emoji, PNG icon files, the CV iframe modal (the CV link opens the PDF), and the public Add Project card.

### Admin (`#/admin`)

Lazy-loaded so visitors never download it. Password form, then a project table with create, edit and delete, backed by one editor form. While the first request waits on a cold API for more than three seconds the screen says so. Experience, certificates and articles are edited through the API's `/docs` page with the same token; a UI for them can come later.

### Design system

Dark only. Tokens:

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0f0f23` | page (the old gradient's first stop, now flat) |
| `--surface` | `#15152d` | cards |
| `--border` | `rgba(255,255,255,0.08)` | hairlines |
| `--border-strong` | `rgba(255,255,255,0.18)` | hover, inputs |
| `--text` | `#e5e7eb` | body |
| `--text-muted` | `#9ca3af` | secondary, 7.5:1 on `--bg` |
| `--accent` | `#6366f1` | lines, dots, focus ring (decorative) |
| `--accent-text` | `#a5b4fc` | links and labels, 9:1 on `--bg` |
| `--accent-solid` | `#4f46e5` | primary button fill, 6.3:1 under white text |
| `--radius` | `12px` | cards; `6px` for tags and inputs |
| `--maxw` | `1080px` | content width |

Type: IBM Plex Sans 400/500/600 for text, IBM Plex Mono 400/500 for dates, labels, tags and flow lines. Body 16 px, line-height 1.6, measure capped at 65 characters.

Icons: `lucide-react` for interface glyphs at 16 or 18 px with 1.75 stroke. Brand marks render through one `BrandIcon` component from `simple-icons` path data (GitHub, Instagram, Medium). LinkedIn left the `simple-icons` package, so its path lives in the repo as a constant.

Motion: 150 ms colour and border transitions on hover and focus. Smooth scrolling only under `prefers-reduced-motion: no-preference`. Nothing else moves.

Accessibility: skip link, one `h1`, landmark elements, visible `:focus-visible` ring, 44 px touch targets in the nav and contact list, `scroll-margin-top` on sections so anchors clear the sticky nav.

## 7. Content

Project lineup, in display order. Full copy lives in `seeds/content.json` in the backend plan and is drawn only from each project's README, the old `projects.json` and the LinkedIn screenshot.

| # | Project | Category | Status | Source | Link |
|---|---|---|---|---|---|
| 1 | Aptum (featured) | platform | prototype | private | `https://sandbox-aptum.com/practice` |
| 2 | Crypto Quant Platform | platform | released | public | GitHub repo |
| 3 | Book Pipeline | agents | prototype | private | none |
| 4 | BetBrain | agents | in-progress | private | none |
| 5 | Website Audit Agent | agents | released | public | GitHub repo |
| 6 | Image Analyzer | data | prototype | public | GitHub repo |
| 7 | Face Recognition App | web | archived | public | GitHub repo |

Changes to existing entries: "CryptoBot" becomes Crypto Quant Platform and loses the "10% per 6 months" line, which the project's own README now contradicts ("Not a source of alpha"). "Parts Scraper – Image Analyzer" becomes Image Analyzer and points at the public repo.

Experience, newest first: Software Engineer at Iron Mountain (Jul 2026 to present), Python Developer at Veach Solutions (Sep 2025 to Jan 2026, contract), RITR Project Participant at Unicorn (Dec 2024 to Mar 2025, internship), Tester at WABCO (Jul 2024 to Sep 2024).

Certificates (six) and articles (two) carry over unchanged.

Hero: "Tomáš Maxim", eyebrow "Python Developer · Bratislava, Slovakia · Remote (EU)", summary "Software Engineer at Iron Mountain. I build backend systems, data pipelines and LLM agent loops in Python, with TypeScript on the front end." Page title: "Tomáš Maxim · Python Developer".

### Content the owner still has to supply or confirm

1. Iron Mountain has no description on LinkedIn. The seed ships it with an empty summary.
2. LinkedIn cut the Veach and Unicorn descriptions at "… more". The seed uses the first complete sentence of each.
3. Aptum and BetBrain live in private repos. The owner reads both cards before they go public.
4. `images/intch-cv.pdf` may predate the Iron Mountain role.
5. The avatar is the existing cartoon (`images/coffee.png`). A photo can replace `public/avatar.png` at any time.

## 8. Build, deploy, rollout

- Frontend CI: `npm ci`, `npm run typecheck`, `npm test`, `npm run build` on every push and pull request.
- Frontend deploy: on push to `main`, refresh the snapshot from the live API (falls back to the committed file), build with `base: '/portfolio/'`, publish `dist/` through GitHub Pages Actions.
- Backend CI: `uv sync`, `uv run pytest`.
- Backend deploy: Render auto-deploys `main`. Build `pip install uv && uv sync --frozen --no-dev`. Start: migrate, seed, serve.

Rollout order, each step confirmed by the owner because each one touches a live service:

1. Confirm the old GitHub token is revoked.
2. Create the Neon database. Set `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, `CORS_ORIGINS`, `PYTHON_VERSION` on Render. Remove `GITHUB_TOKEN` and `FORM_PASSWORD`.
3. Change Render's build and start commands, merge the backend, check `/healthz` and `/api/v1/content`.
4. Switch GitHub Pages from "Deploy from a branch" to "GitHub Actions", then merge the frontend. Doing these in the other order would serve the raw Vite `index.html` and break the site.

## 9. Testing

- Backend: repository ordering and CRUD, content payload shape, ETag and `304`, version changes after a write, login success, failure and throttle, bearer protection on writes, duplicate slug `409`, seed idempotence. SQLite in memory, no network.
- Frontend: `DateRange` labels and durations, `parseContent` accept and reject, `ContentStore` revalidation (`304`, `200`, network error), `ProjectView` derivations, `ProjectCard` rendering for a public and a private project.
- Manual: the page at 375, 768 and 1280 px; keyboard pass through nav, cards and contact; reduced-motion on; API stopped (page still renders); admin create, edit, delete against a local API.

## 10. Risks

| Risk | Handling |
|---|---|
| Render and Neon both suspend when idle | Snapshot-first rendering; admin shows a "waking the API" notice. |
| Snapshot drifts from the database after an admin edit | Runtime revalidation closes the gap for visitors; the next deploy refreshes the bundle. |
| TypeScript 7 and Vite 8 are recent | Hand-written minimal configs, no ESLint, conservative compiler options. |
| A library renamed an icon | Icons import by name in one file per concern; the plan lists every name used. |
