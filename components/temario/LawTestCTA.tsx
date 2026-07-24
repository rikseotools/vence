'use client'
// components/temario/LawTestCTA.tsx
//
// CTA "Hacer test de {ley}" del temario (dentro de LawSection). ÚNICO punto donde se
// construye la URL del test de una ley DESDE EL TEMARIO: enlaza al test ACOTADO a los
// artículos del TEMA (su scope) vía buildLawTestLink → no sirve preguntas fuera de
// temario (fix T-073). Antes estaba hand-rolleado en 125 TopicContentView duplicados,
// que driftaron → el CTA de la ley enlazaba a la ley ENTERA (`/leyes/{ley}` sin scope).
//
// Centralizado a propósito (patrón de ArticleTestCTA): la lógica de URL vive en UNA
// función pura testeada (buildLawTestLink) y el evento de observabilidad se emite en UN
// solo punto de choque. Guardarraíl __tests__/guardrails/lawTestCtaNoBareLink.test.ts
// prohíbe volver a hand-rollear el enlace en cualquier TopicContentView.
import Link from 'next/link'
import { useLawSlugs } from '@/contexts/LawSlugContext'
import { emitClientEvent } from '@/lib/observability/client'
import { buildLawTestLink } from '@/lib/navigation/backToArticleLink'

interface LawTestCTAProps {
  /** shortName de la ley (se resuelve a slug con useLawSlugs, igual que LawSection) */
  lawShortName: string
  /** artículos de la ley que están EN EL TEMA (su scope) */
  articles: Array<{ articleNumber: string | number }>
  /** origen del enlace (default 'temario') */
  source?: string
}

export default function LawTestCTA({ lawShortName, articles, source = 'temario' }: LawTestCTAProps) {
  const { getSlug } = useLawSlugs()
  const lawSlug = getSlug(lawShortName)
  const articleNumbers = (articles ?? []).map((a) => a.articleNumber)
  const href = buildLawTestLink(lawSlug, articleNumbers, source)

  return (
    <Link
      href={href}
      onClick={() =>
        emitClientEvent({
          severity: 'info',
          eventType: 'law_test_cta_click',
          metadata: {
            source,
            lawSlug,
            // nº de artículos con los que se ACOTA el test. 0 = sin scope = regresión a vigilar.
            scopedArticleCount: new Set(
              articleNumbers.map(String).filter((s) => s.trim().length > 0),
            ).size,
          },
        })
      }
      className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline"
    >
      Hacer test de {lawShortName} →
    </Link>
  )
}
