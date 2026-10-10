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
