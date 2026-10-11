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
