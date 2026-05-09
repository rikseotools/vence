import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import CompararTemariosClient from './CompararTemariosClient'
import { OPOSICIONES } from '@/lib/config/oposiciones'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Comparar temarios de oposiciones | Vence',
  description:
    'Compara el temario de dos oposiciones art\u00edculo por art\u00edculo. Descubre qu\u00e9 leyes comparten y cu\u00e1nto se solapan los temarios.',
  openGraph: {
    title: 'Comparar temarios de oposiciones | Vence',
    description:
      'Compara el temario de dos oposiciones art\u00edculo por art\u00edculo.',
    url: `${SITE_URL}/comparar-temarios`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  alternates: { canonical: `${SITE_URL}/comparar-temarios` },
  robots: { index: true, follow: true },
}

export default function CompararTemariosPage() {
  // Pass oposiciones list as serializable data to client component
  const oposiciones = OPOSICIONES.map((o) => ({
    slug: o.slug,
    name: o.name,
    shortName: o.shortName,
    badge: o.badge,
  })).sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return (
    <>
      <ClientBreadcrumbsWrapper />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Comparar temarios de oposiciones
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            Selecciona dos oposiciones para ver qu\u00e9 leyes comparten, cu\u00e1les
            son exclusivas de cada una y el porcentaje exacto de solapamiento
            art\u00edculo por art\u00edculo.
          </p>
        </header>

        <CompararTemariosClient oposiciones={oposiciones} />

        {/* SEO content */}
        <section className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Preguntas frecuentes
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                ¿C\u00f3mo se comparan los temarios?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Analizamos art\u00edculo por art\u00edculo las leyes de cada
                oposici\u00f3n. Si ambas incluyen el mismo art\u00edculo de una
                ley, cuenta como compartido. El porcentaje indica qu\u00e9
                fracci\u00f3n del temario de cada oposici\u00f3n se solapa con
                la otra.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                ¿Puedo preparar dos oposiciones a la vez?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                S\u00ed. Si dos oposiciones comparten un alto porcentaje de
                temario, el esfuerzo adicional es mucho menor. Con Vence puedes
                practicar tests de ambas con la misma suscripci\u00f3n.
              </p>
            </div>
          </div>
        </section>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: '\u00bfC\u00f3mo se comparan los temarios de oposiciones?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Se analizan art\u00edculo por art\u00edculo las leyes que componen cada temario. Los art\u00edculos compartidos se cuentan como solapamiento.',
                },
              },
              {
                '@type': 'Question',
                name: '\u00bfPuedo preparar dos oposiciones a la vez?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'S\u00ed, especialmente si comparten un alto porcentaje de temario. Con Vence puedes practicar tests de ambas oposiciones.',
                },
              },
            ],
          }),
        }}
      />
    </>
  )
}
