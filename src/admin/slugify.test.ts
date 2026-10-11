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
