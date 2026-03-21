/**
 * Página de Temarios - Listado de todos los temarios disponibles
 * /temarios
 * Generada estáticamente desde OPOSICIONES (lib/config/oposiciones.ts)
 */

import { Metadata } from 'next'
import Link from 'next/link'
import { OPOSICIONES } from '@/lib/config/oposiciones'

export const metadata: Metadata = {
  title: 'Temarios de Oposiciones Gratis 2026 | Vence',
  description: `Temarios completos y actualizados para ${OPOSICIONES.length} oposiciones. Auxiliar Administrativo, Tramitación Procesal, Auxilio Judicial y más. Temarios oficiales BOE gratis.`,
  keywords: [
    'temarios oposiciones gratis',
    'temario auxiliar administrativo',
    'temario administrativo estado',
    'temario tramitacion procesal',
    'temarios oposiciones 2026',
    'temario C1 C2 gratis',
    'temario BOE gratis',
  ],
  openGraph: {
    title: 'Temarios de Oposiciones Gratis | Vence',
    description: `${OPOSICIONES.length} temarios completos y actualizados para oposiciones`,
    url: 'https://www.vence.es/temarios',
    type: 'website',
  },
  alternates: {
    canonical: 'https://www.vence.es/temarios',
  },
}

// JSON-LD para SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Temarios de Oposiciones Gratis',
  description: `Temarios completos y actualizados para ${OPOSICIONES.length} oposiciones.`,
  url: 'https://www.vence.es/temarios',
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: OPOSICIONES.map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Course',
        name: `Temario ${o.name}`,
        provider: { '@type': 'Organization', name: 'Vence', url: 'https://www.vence.es' },
        isAccessibleForFree: true,
        numberOfCredits: o.totalTopics,
        url: `https://www.vence.es/${o.slug}/temario`,
      },
    })),
  },
}

// Colores por badge para variedad visual
const badgeColors: Record<string, string> = {
  C2: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  C1: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  A2: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  A1: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export default function TemariosPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white text-center">
            Temarios de Oposiciones
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto">
            {OPOSICIONES.length} temarios completos y actualizados. Elige tu oposición y empieza a estudiar gratis.
          </p>
        </div>
      </div>

      {/* Lista de temarios */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {OPOSICIONES.map((oposicion) => {
            const totalTemas = oposicion.blocks.reduce((sum, b) => sum + b.themes.length, 0)
            const colorClass = badgeColors[oposicion.badge] || badgeColors.C2

            return (
              <Link
                key={oposicion.slug}
                href={`/${oposicion.slug}/temario`}
                className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200"
              >
                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{oposicion.emoji}</span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
                          {oposicion.badge}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-tight">
                        {oposicion.name}
                      </h2>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalTemas}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">temas</p>
                    </div>
                  </div>
                </div>

                {/* Bloques */}
                <div className="p-5 bg-gray-50 dark:bg-gray-800/50">
                  <div className="space-y-1.5">
                    {oposicion.blocks.map((bloque) => (
                      <div key={bloque.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400 truncate mr-2">
                          <span className="mr-1">{bloque.icon}</span>
                          {bloque.title}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500 whitespace-nowrap">
                          {bloque.themes.length}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium group-hover:underline">
                      Ver temario
                    </span>
                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
