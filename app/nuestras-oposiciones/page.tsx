// app/nuestras-oposiciones/page.tsx
// Server Component: renderiza HTML completo para SEO, datos de BD
import type { Metadata } from 'next'
import { OPOSICIONES } from '@/lib/config/oposiciones'
import { getAllOposicionesCardData } from '@/lib/api/convocatoria/queries'
import OposicionCards, { type CardData } from './OposicionCards'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const revalidate = 86400 // ISR 24h

export const metadata: Metadata = {
  title: 'Oposiciones Disponibles 2026 | Tests y Temario Gratis | Vence',
  description: 'Prepara tu oposicion con tests tipo examen y temario completo. Auxiliar Administrativo del Estado, Madrid, Canarias, Tramitacion Procesal y mas. Material gratuito actualizado.',
  keywords: [
    'oposiciones 2026',
    'auxiliar administrativo estado',
    'oposiciones tests gratis',
    'temario oposiciones',
    'preparar oposiciones online',
    'auxiliar administrativo comunidades autonomas',
    'tramitacion procesal',
  ],
  openGraph: {
    title: 'Oposiciones Disponibles 2026 | Vence',
    description: 'Tests tipo examen y temario completo para oposiciones. Material gratuito actualizado.',
    url: `${SITE_URL}/nuestras-oposiciones`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  alternates: {
    canonical: `${SITE_URL}/nuestras-oposiciones`,
  },
}

export default async function NuestrasOposicionesPage() {
  const dbData = await getAllOposicionesCardData()

  // Merge: config central (bloques, temas, slugs) + datos BD (plazas, fechas, descripcion)
  const oposiciones: CardData[] = OPOSICIONES.map(config => {
    const db = dbData.get(config.slug)
    const slugToGuiones = config.slug

    return {
      id: config.id,
      slug: slugToGuiones,
      name: config.name,
      emoji: config.emoji,
      badge: config.badge,
      totalTopics: config.totalTopics,
      blocksCount: config.blocks.length,
      description: db?.landingDescription ?? `Prepara ${config.name} con tests tipo examen y temario completo. ${config.totalTopics} temas.`,
      level: `Grupo ${db?.grupo ?? 'C'}, Subgrupo ${db?.subgrupo ?? config.badge}`,
      difficulty: db?.landingDifficulty ?? 'Intermedio',
      duration: db?.landingDuration ?? '6-12 meses',
      salary: db?.salarioMin && db?.salarioMax
        ? `${formatNumber(db.salarioMin)} - ${formatNumber(db.salarioMax)}`
        : '18.000 - 22.000',
      features: parseJsonbArray(db?.landingFeatures) ?? [
        `Temario oficial (${config.totalTopics} temas)`,
        'Tests por temas y bloques',
        'Seguimiento de progreso',
        'Estadisticas detalladas',
      ],
      requirements: parseJsonbArray(db?.landingRequirements) ?? [
        db?.tituloRequerido ?? 'Titulo de Graduado en ESO o equivalente',
        'Nacionalidad espanola o UE',
        'Tener 16 anos y no exceder edad jubilacion',
      ],
      boeUrl: db?.programaUrl ?? null,
      plazasLibres: db?.plazasLibres ?? null,
      isConvocatoriaActiva: db?.isConvocatoriaActiva ?? false,
    }
  })

  // Schema JSON-LD: lista de cursos/oposiciones para rich snippets
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Oposiciones disponibles en Vence",
    "numberOfItems": oposiciones.length,
    "itemListElement": oposiciones.map((op, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": op.name,
      "url": `${SITE_URL}/${op.slug}`,
    }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-950 text-white">
          <div className="container mx-auto px-4 py-10">
            <div className="text-center">
              <span className="text-4xl">🏛️</span>
              <h1 className="text-3xl md:text-4xl font-bold mt-3 mb-2">
                Oposiciones Disponibles
              </h1>
              <p className="text-lg text-blue-100 mb-4">
                Elige tu oposicion y empieza a hacer tests. Asi de facil.
              </p>
              <div className="flex items-center justify-center gap-4 text-blue-100 text-sm">
                <span className="flex items-center gap-1">
                  <span className="text-green-400">✓</span> Preguntas ilimitadas
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-green-400">✓</span> Seguimiento detallado
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="container mx-auto px-4 py-12">
          <OposicionCards oposiciones={oposiciones} />

          {/* Coming Soon */}
          <div className="mt-16 text-center">
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-8 max-w-2xl mx-auto">
              <h3 className="text-xl font-bold text-slate-700 mb-3">
                Proximamente mas oposiciones
              </h3>
              <p className="text-slate-600 mb-4 text-sm">
                Estamos trabajando para anadir mas oposiciones a nuestra plataforma.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
                <span>Gestion Procesal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function formatNumber(n: number | null): string {
  if (n == null) return ''
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Parsea un campo jsonb que puede venir como string o como array */
function parseJsonbArray(value: unknown): string[] | null {
  if (!value) return null
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return null }
  }
  return null
}
