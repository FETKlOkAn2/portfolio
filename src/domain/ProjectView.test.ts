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
