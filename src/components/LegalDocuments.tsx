import type { LegalSnapshot } from '@hallelujahhomechurch/account-client'
import { useLocale } from '../i18n/locale-context'

export function LegalDocuments({ snapshot }: { snapshot: LegalSnapshot }) {
  const { messages: t } = useLocale()
  return (
    <div className="legal-documents">
      {(['terms', 'privacy'] as const).map((key) => {
        const document = snapshot.documents[key].data
        return (
          <article
            key={key}
            aria-label={key === 'terms' ? t.nav.terms : t.nav.privacy}
          >
            <h2>{document.heroTitle}</h2>
            {document.heroSubtitle ? <p>{document.heroSubtitle}</p> : null}
            <p>
              {document.updatedAtLabel} {document.updatedAt}
            </p>
            <p>{document.intro}</p>
            {document.sections.map((section, index) => (
              <section key={index}>
                <h3>{section.title}</h3>
                {section.body.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
              </section>
            ))}
          </article>
        )
      })}
    </div>
  )
}
