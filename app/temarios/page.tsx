/**
 * Página de Temarios - Listado de todos los temarios disponibles
 * /temarios
 */

import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Temarios de Oposiciones Gratis 2026 | Vence',
  description: 'Temarios completos y actualizados para oposiciones. Auxiliar Administrativo del Estado (C2), Administrativo del Estado (C1). Temarios oficiales BOE 2025 gratis.',
  keywords: [
    'temarios oposiciones gratis',
    'temario auxiliar administrativo',
    'temario administrativo estado',
    'temarios oposiciones 2026',
    'temario C1 C2 gratis',
    'temario BOE 2025'
  ],
  openGraph: {
    title: 'Temarios de Oposiciones Gratis | Vence',
    description: 'Temarios completos y actualizados para oposiciones',
    url: 'https://www.vence.es/temarios',
    type: 'website'
  },
  alternates: {
    canonical: 'https://www.vence.es/temarios'
  }
};

const temarios = [
  {
    id: 'auxiliar-administrativo-estado',
    nombre: 'Auxiliar Administrativo del Estado',
    badge: 'C2',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    descripcion: 'Temario oficial publicado en BOE 22/12/2025. 28 temas organizados en 2 bloques.',
    temas: 28,
    bloques: [
      { nombre: 'Bloque I', descripcion: 'Organización del Estado y Administración Pública', temas: 16 },
      { nombre: 'Bloque II', descripcion: 'Informática y Ofimática', temas: 12 }
    ],
    href: '/auxiliar-administrativo-estado/temario',
    color: 'emerald'
  },
  {
    id: 'administrativo-estado',
    nombre: 'Administrativo del Estado',
    badge: 'C1',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    descripcion: 'Temario oficial publicado en BOE 22/12/2025. 45 temas organizados en 6 bloques.',
    temas: 45,
    bloques: [
      { nombre: 'Bloque I', descripcion: 'Organización del Estado', temas: 11 },
      { nombre: 'Bloque II', descripcion: 'Organización de Oficinas Públicas', temas: 4 },
      { nombre: 'Bloque III', descripcion: 'Derecho Administrativo General', temas: 7 },
      { nombre: 'Bloque IV', descripcion: 'Gestión de Personal', temas: 9 },
      { nombre: 'Bloque V', descripcion: 'Gestión Financiera', temas: 6 },
      { nombre: 'Bloque VI', descripcion: 'Informática y Ofimática', temas: 8 }
    ],
    href: '/administrativo-estado/temario',
    color: 'blue'
  }
];

// JSON-LD para SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Temarios de Oposiciones Gratis',
  description: 'Temarios completos y actualizados para oposiciones. Auxiliar Administrativo del Estado, Administrativo del Estado.',
  url: 'https://www.vence.es/temarios',
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: temarios.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Course',
        name: `Temario ${t.nombre}`,
        description: t.descripcion,
        provider: {
          '@type': 'Organization',
          name: 'Vence',
          url: 'https://www.vence.es'
        },
        isAccessibleForFree: true,
        numberOfCredits: t.temas,
        url: `https://www.vence.es${t.href}`
      }
    }))
  }
};

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
            Temarios completos y actualizados según BOE 2025. Elige tu oposición y empieza a estudiar gratis.
          </p>
        </div>
      </div>

      {/* Lista de temarios */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-8 md:grid-cols-2">
          {temarios.map((temario) => (
            <Link
              key={temario.id}
              href={temario.href}
              className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200"
            >
              {/* Header del temario */}
              <div className={`p-6 border-b border-gray-100 dark:border-gray-700`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${temario.badgeColor}`}>
                      Grupo {temario.badge}
                    </span>
                    <h2 className="mt-3 text-xl font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {temario.nombre}
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{temario.temas}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">temas</p>
                  </div>
                </div>
                <p className="mt-3 text-gray-600 dark:text-gray-400">
                  {temario.descripcion}
                </p>
              </div>

              {/* Bloques */}
              <div className="p-6 bg-gray-50 dark:bg-gray-800/50">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  Contenido del temario:
                </p>
                <div className="space-y-2">
                  {temario.bloques.map((bloque, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        <span className="font-medium">{bloque.nombre}:</span> {bloque.descripcion}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">
                        {bloque.temas} temas
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium group-hover:underline">
                    Ver temario completo
                  </span>
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Próximamente */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Próximamente: Guardia Civil, Policía Nacional, Gestión Procesal y más.
          </p>
        </div>
      </div>
    </div>
  );
}
