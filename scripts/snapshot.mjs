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
