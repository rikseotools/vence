import { getOposicion } from '@/lib/config/oposiciones'
import { getOposicionesCompatiblesCached } from '@/lib/api/oposiciones-compatibles/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import type { OposicionOverlap } from '@/lib/api/oposiciones-compatibles/types'
import UserProgressOverlay from './UserProgressOverlay'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const dynamic = 'force-dynamic'

// ============================================
// SEO METADATA
// ============================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ oposicion: string }>
}): Promise<Metadata> {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) return {}

  const title = `Oposiciones compatibles con ${config.name} | Vence`
  const description = `Descubre qué otras oposiciones puedes preparar si estudias ${config.name}. Análisis artículo por artículo del solapamiento de temarios.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${config.slug}/oposiciones-compatibles`,
      siteName: 'Vence',
      locale: 'es_ES',
      type: 'website',
    },
    alternates: {
      canonical: `${SITE_URL}/${config.slug}/oposiciones-compatibles`,
    },
    robots: { index: true, follow: true },
  }
}

// ============================================
// HELPERS
// ============================================

function getOverlapColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500'
  if (pct >= 40) return 'bg-amber-500'
  if (pct >= 20) return 'bg-orange-400'
  return 'bg-gray-400'
}

function getOverlapLabel(pct: number): string {
  if (pct >= 70) return 'Muy compatible'
  if (pct >= 40) return 'Compatible'
  if (pct >= 20) return 'Parcialmente compatible'
  return 'Poco solapamiento'
}

function getOverlapBadgeClasses(pct: number): string {
  if (pct >= 70)
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (pct >= 40)
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  if (pct >= 20)
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

const ADMIN_LABELS: Record<string, string> = {
  estado: 'AGE',
  justicia: 'Justicia',
  autonomica: 'CCAA',
  local: 'Local',
  empresa_publica: 'Empresa P.',
}

// ============================================
// OVERLAP CARD COMPONENT
// ============================================

function OverlapCard({ overlap }: { overlap: OposicionOverlap }) {
  const topLaws = overlap.lawBreakdown.filter((l) => l.coveredArticles > 0).slice(0, 5)
  const missingLaws = overlap.lawBreakdown.filter(
    (l) => l.coveredArticles === 0
  )

  return (
    <details className="group border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
      <summary className="cursor-pointer p-4 sm:p-5 flex items-center gap-3 sm:gap-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors list-none [&::-webkit-details-marker]:hidden">
        {/* Badge grupo */}
        <span className="flex-shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-bold">
          {overlap.badge}
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {overlap.nombre}
            </h3>
            <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              {ADMIN_LABELS[overlap.administracion] || overlap.administracion}
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getOverlapColor(overlap.overlapPct)}`}
                style={{ width: `${overlap.overlapPct}%` }}
              />
            </div>
            <span className="flex-shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-300 w-12 text-right">
              {overlap.overlapPct}%
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {overlap.coveredArticles} de {overlap.totalArticles} artículos
            cubiertos
          </p>
        </div>

        {/* Compatibility badge */}
        <span
          className={`flex-shrink-0 hidden sm:inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${getOverlapBadgeClasses(overlap.overlapPct)}`}
        >
          {getOverlapLabel(overlap.overlapPct)}
        </span>

        {/* Chevron */}
        <svg
          className="flex-shrink-0 w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </summary>

      {/* Expanded detail */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 p-5">
        {/* Laws you already cover */}
        {topLaws.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
              Leyes que ya cubres
            </h4>
            <div className="space-y-2">
              {topLaws.map((law) => (
                <div key={law.lawId} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">
                      {law.lawShortName}
                    </span>
                  </div>
                  <div className="flex-shrink-0 w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getOverlapColor(law.overlapPct)}`}
                      style={{ width: `${law.overlapPct}%` }}
                    />
                  </div>
                  <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
                    {law.overlapPct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What you'd need to study */}
        {missingLaws.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-2">
              Lo que te faltaría estudiar ({missingLaws.length}{' '}
              {missingLaws.length === 1 ? 'ley' : 'leyes'} nuevas)
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {missingLaws.slice(0, 8).map((law) => (
                <span
                  key={law.lawId}
                  className="text-xs px-2 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-md"
                >
                  {law.lawShortName}
                </span>
              ))}
              {missingLaws.length > 8 && (
                <span className="text-xs px-2 py-1 text-gray-500 dark:text-gray-400">
                  +{missingLaws.length - 8} más
                </span>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <Link
          href={`/${overlap.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
        >
          Ver temario de {overlap.shortName}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </details>
  )
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function OposicionesCompatiblesPage({
  params,
}: {
  params: Promise<{ oposicion: string }>
}) {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) notFound()

  const allOverlaps = await getOposicionesCompatiblesCached(
    config.positionType
  )

  // Filter: only show oposiciones with >0% overlap
  const overlaps = allOverlaps.filter((o) => o.overlapPct > 0)
  const highCompat = overlaps.filter((o) => o.overlapPct >= 40)
  const lowCompat = overlaps.filter(
    (o) => o.overlapPct > 0 && o.overlapPct < 40
  )

  // Stats for intro
  const bestMatch = overlaps[0]
  const over50Count = overlaps.filter((o) => o.overlapPct >= 50).length

  // FAQ data for SEO
  const faqs = [
    {
      q: `¿Qué otras oposiciones puedo preparar si estudio ${config.name}?`,
      a: bestMatch
        ? `Con tu preparación de ${config.name}, la oposición más compatible es ${bestMatch.nombre} con un ${bestMatch.overlapPct}% de temario compartido. En total, ${over50Count} oposiciones comparten más del 50% del temario.`
        : `Actualmente no hay datos de compatibilidad para ${config.name}.`,
    },
    {
      q: `¿Cómo se calcula la compatibilidad de temarios?`,
      a: `Analizamos artículo por artículo las leyes que componen el temario de cada oposición. Si dos oposiciones incluyen los mismos artículos de una ley, esos artículos cuentan como cubiertos. El porcentaje indica qué fracción del temario de la otra oposición ya cubres con tu estudio actual.`,
    },
    {
      q: `¿Puedo preparar dos oposiciones a la vez?`,
      a: `Sí, y es una estrategia muy habitual. Si dos oposiciones comparten un alto porcentaje de temario, el esfuerzo adicional para preparar la segunda es mucho menor. Con Vence puedes practicar tests de ambas oposiciones con la misma suscripción.`,
    },
  ]

  return (
    <>
      <ClientBreadcrumbsWrapper />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Oposiciones compatibles con{' '}
            <span className="text-indigo-600 dark:text-indigo-400">
              {config.name}
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            {bestMatch ? (
              <>
                Con tu preparación de {config.shortName},{' '}
                <strong>{over50Count} oposiciones</strong> comparten más del
                50% del temario. La más compatible es{' '}
                <strong>{bestMatch.nombre}</strong> con un{' '}
                <strong>{bestMatch.overlapPct}%</strong> de solapamiento
                artículo por artículo.
              </>
            ) : (
              <>
                Análisis de compatibilidad de temarios para{' '}
                {config.name}.
              </>
            )}
          </p>
          <Link
            href="/comparar-temarios"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 mt-3"
          >
            O compara dos oposiciones concretas
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </header>

        {/* Summary stats */}
        {overlaps.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {overlaps.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Oposiciones compatibles
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {over50Count}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Con +50% compartido
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {bestMatch?.overlapPct ?? 0}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Máximo solapamiento
              </div>
            </div>
          </div>
        )}

        {/* Personal progress (client-side, only visible when logged in) */}
        <UserProgressOverlay sourcePositionType={config.positionType} />

        {/* High compatibility section */}
        {highCompat.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Alta compatibilidad (+40%)
            </h2>
            <div className="space-y-3">
              {highCompat.map((o) => (
                <OverlapCard key={o.slug} overlap={o} />
              ))}
            </div>
          </section>
        )}

        {/* Low compatibility section */}
        {lowCompat.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Compatibilidad parcial
            </h2>
            <div className="space-y-3">
              {lowCompat.map((o) => (
                <OverlapCard key={o.slug} overlap={o} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {overlaps.length === 0 && (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <p className="text-lg">
              Aún no hay datos de compatibilidad para esta oposición.
            </p>
            <p className="text-sm mt-2">
              El temario puede no tener artículos configurados todavía.
            </p>
          </div>
        )}

        {/* FAQ Section for SEO */}
        <section className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Preguntas frecuentes
          </h2>
          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <div key={i}>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  {faq.q}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link
            href={`/${config.slug}/test`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Practicar test de {config.shortName}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </main>

      {/* JSON-LD: FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((faq) => ({
              '@type': 'Question',
              name: faq.q,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.a,
              },
            })),
          }),
        }}
      />
    </>
  )
}
