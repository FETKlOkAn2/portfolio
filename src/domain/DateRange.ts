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
