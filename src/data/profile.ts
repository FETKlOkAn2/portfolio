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
