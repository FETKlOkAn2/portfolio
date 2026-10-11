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
