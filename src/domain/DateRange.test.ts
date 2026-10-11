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
