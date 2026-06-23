// app/page.tsx
// Home page — datos de OPOSICIONES config + leyes top de BD. HTML estático (ISR 24h).
import type { Metadata } from 'next'
import Link from 'next/link'
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { unstable_cache } from 'next/cache'
import { isOpenForDisplay, todayMadrid } from '@/lib/oposiciones/inscripcion'
import { OPOSICIONES } from '@/lib/config/oposiciones'
import CcaaFlag from '@/components/CcaaFlag'

export const revalidate = false // estática, se regenera solo en deploy

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata: Metadata = {
  title: 'Test de Oposiciones y Leyes | Vence',
  description: 'Tests gratuitos de leyes españolas y oposiciones. Constitución Española, Ley 39/2015, Guardia Civil, Administrativo. +20.000 preguntas actualizadas.',
  keywords: [
    'test de ley', 'test oposiciones', 'test constitución española',
    'ley 39/2015 test', 'test de leyes', 'test oposiciones gratis',
    'test guardia civil', 'test administrativo del estado',
    'test auxilio judicial', 'test tramitación procesal', 'tests jurídicos españa'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: SITE_URL,
    languages: { 'es-ES': SITE_URL, 'x-default': SITE_URL }
  },
  openGraph: {
    title: 'Tests de Oposiciones y Leyes | Vence',
    description: 'Practica con +20.000 tests gratuitos de legislación española y prepara tus oposiciones online.',
    url: SITE_URL,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests de Oposiciones y Leyes | Vence',
    description: 'Prepara tus oposiciones con Vence.',
    images: ['/twitter-image-es.jpg'],
  },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' as const, 'max-snippet': -1 },
  },
}

// Categorías para agrupar oposiciones
const ADMIN_LABELS: Record<string, string> = {
  estado: 'Administración General del Estado',
  autonomica: 'Comunidades Autónomas',
  local: 'Administración Local',
  justicia: 'Justicia',
}

// Emojis según categoría para temarios
const CATEGORY_EMOJI: Record<string, string> = {
  estado: '🏛️',
  autonomica: '🏛️',
  local: '🏛️',
  justicia: '⚖️',
}

// Detectar si es sanitario o seguridad por el nombre
function getOpoCategory(o: typeof OPOSICIONES[number]): string {
  const name = o.name.toLowerCase()
  if (name.includes('celador') || name.includes('tcae') || name.includes('enfermero')) return 'sanidad'
  if (name.includes('guardia civil') || name.includes('policía') || name.includes('policia')) return 'seguridad'
  return o.administracion
}

function getCategoryLabel(cat: string): string {
  if (cat === 'sanidad') return 'Sanidad'
  if (cat === 'seguridad') return 'Seguridad'
  return ADMIN_LABELS[cat] || cat
}

function getCategoryEmoji(cat: string): string {
  if (cat === 'sanidad') return '🏥'
  if (cat === 'seguridad') return '🛡️'
  return CATEGORY_EMOJI[cat] || '🏛️'
}

interface TopLaw {
  short_name: string
  slug: string
  question_count: number
}

async function getTopLaws(): Promise<TopLaw[]> {
  // Agnóstico (Fase C1): el N+1 anterior (articles + 1 COUNT de questions por ley,
  // con .in() limitado a 1000 ids) → un solo JOIN+GROUP BY equivalente. Cada
  // question tiene UN primary_article_id (→ 1 artículo → 1 ley), así que COUNT(q.id)
  // = el mismo conteo, sin el cap de 1000 (más exacto en leyes enormes). getAdminDb
  // bypasea RLS (= el service_role anterior). NO se expone correct_option (es un COUNT).
  try {
    const rows = await getAdminDb().execute(sql`
      SELECT l.short_name, l.slug, COUNT(q.id)::int AS question_count
      FROM laws l
      JOIN articles a ON a.law_id = l.id AND a.is_active = true
      JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
      WHERE l.is_active = true AND l.is_virtual = false AND l.slug IS NOT NULL
      GROUP BY l.id, l.short_name, l.slug
      HAVING COUNT(q.id) >= 100
      ORDER BY question_count DESC
      LIMIT 15
    `)
    const results = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []
    return results as unknown as TopLaw[]
  } catch (e) {
    console.warn('[home] getTopLaws falló:', (e as Error).message)
    return []
  }
}

interface OpenConvocatoria {
  slug: string
  nombre: string
  inscription_start: string | null
  inscription_deadline: string | null
  plazas_libres: number | null
  is_active: boolean
  seguimiento_url: string | null
}

// Convocatorias con inscripción abierta. FUENTE DE VERDAD = fechas (isInscripcionAbierta),
// NO estado_proceso (que puede quedar desfasado y mostraba convocatorias vencidas / se
// contradecía con el banner — incidente 20/06). Mismo criterio que el banner y la SEO.
//
// Incluye DOS niveles (20/06):
//   - PUBLICADAS (is_active=true): tenemos landing/tests → la card enlaza interno.
//   - CATALOGADAS (is_active=false): aún sin tests pero con inscripción abierta y URL
//     oficial → se muestran como "sin test todavía" enlazando a la convocatoria oficial
//     (nunca a una landing inexistente). Gateadas a tener seguimiento_url (si no, no hay
//     a dónde enlazar y el dato suele ser menos fiable). El service-role ve las
//     catalogadas (RLS las ocultaría al anon); alineado con la retirada de RLS (Fase P).
// revalidate:3600 → la apertura cambia a medianoche; el tag 'landing' la refresca al
// cambiar una convocatoria.
const getOpenConvocatorias = unstable_cache(
  async (): Promise<OpenConvocatoria[]> => {
    // Agnóstico (Fase C1): Drizzle (getAdminDb = service_role, ve catalogadas
    // is_active=false que RLS ocultaría). Fechas ::text (string 'YYYY-MM-DD';
    // isOpenForDisplay/formatDeadline hacen .slice). Sin WHERE is_active: trae todas
    // y filtra isOpenForDisplay, igual que antes.
    let rows: unknown = []
    try {
      rows = await getAdminDb().execute(sql`
        SELECT slug, nombre,
               inscription_start::text AS inscription_start,
               inscription_deadline::text AS inscription_deadline,
               plazas_libres, is_active, seguimiento_url
        FROM oposiciones
        ORDER BY inscription_deadline ASC NULLS LAST
      `)
    } catch (e) {
      console.warn('[home] getOpenConvocatorias falló:', (e as Error).message)
      return []
    }
    const data = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []) as unknown as OpenConvocatoria[]
    const today = todayMadrid()
    return data
      // ÚNICA puerta de inclusión (publicadas abiertas + catalogadas abiertas con url oficial)
      .filter((o) => isOpenForDisplay(o, today))
      .sort((a, b) => {
        // publicadas primero (son producto), en su orden por cierre más próximo (estable)
        if (a.is_active !== b.is_active) return Number(b.is_active) - Number(a.is_active)
        if (a.is_active) return 0
        // catalogadas: por plazas desc (la más relevante arriba, p.ej. IIPP 1050)
        return (b.plazas_libres ?? 0) - (a.plazas_libres ?? 0)
      })
  },
  ['home-open-convocatorias'],
  { revalidate: 3600, tags: ['landing'] }
)

function formatDeadline(d: string | null): string {
  if (!d) return ''
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return `${day} ${months[m - 1]} ${y}`
}

function getFormattedDate(): string {
  const now = new Date()
  const day = now.getDate()
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${day} ${months[now.getMonth()]} ${now.getFullYear()}`
}

export default async function HomePage() {
  const [topLaws, openConvocatorias] = await Promise.all([getTopLaws(), getOpenConvocatorias()])

  // Group oposiciones by category, preserving config order
  const categoryOrder = ['estado', 'autonomica', 'local', 'justicia', 'sanidad', 'seguridad']
  const grouped = new Map<string, typeof OPOSICIONES>()
  for (const cat of categoryOrder) grouped.set(cat, [])

  for (const o of OPOSICIONES) {
    const cat = getOpoCategory(o)
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(o)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16 max-w-3xl">

        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-white mb-4">
            Vence
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-2">
            Plataforma de tests para oposiciones y leyes
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            +20.000 preguntas
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            Última revisión: {getFormattedDate()}
          </p>
        </div>

        {/* Convocatorias con inscripción abierta — CTA a la página SEO dedicada.
            Solo se muestra si hay alguna abierta. */}
        {openConvocatorias.length > 0 && (
          <Link
            href="/oposiciones/inscripcion-abierta"
            className="block mb-10 rounded-xl border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 p-5 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-600"></span>
              </span>
              <h2 className="text-base font-bold text-green-800 dark:text-green-300">
                {openConvocatorias.length === 1
                  ? '1 convocatoria con inscripción abierta'
                  : `${openConvocatorias.length} convocatorias con inscripción abierta`}
              </h2>
            </div>
            <ul className="space-y-1 mb-2">
              {openConvocatorias.map(c => (
                <li key={c.slug} className="text-sm text-green-900 dark:text-green-200 flex items-center justify-between gap-3">
                  <span className="truncate flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{c.nombre}</span>
                    {!c.is_active && (
                      <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-200/70 dark:bg-green-800/60 text-green-800 dark:text-green-300">
                        sin test
                      </span>
                    )}
                  </span>
                  {c.inscription_deadline && (
                    <span className="shrink-0 text-xs text-green-700 dark:text-green-400 whitespace-nowrap">
                      cierra {formatDeadline(c.inscription_deadline)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Ver convocatorias abiertas →
            </span>
          </Link>
        )}

        <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
          Puedes hacer Test por oposición o por leyes
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-12">

          {/* Tests por Oposición */}
          <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">🏛️</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
              Test por Oposición
            </h2>
            <div className="space-y-3">
              {categoryOrder.map(cat => {
                const opos = grouped.get(cat)
                if (!opos || opos.length === 0) return null
                return (
                  <div key={cat}>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide pt-2">
                      {getCategoryLabel(cat)}
                    </p>
                    {opos.map(o => (
                      <Link
                        key={o.slug}
                        href={`/${o.slug}/test`}
                        className="block py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm"
                      >
                        {o.shortName} ({o.badge})
                      </Link>
                    ))}
                  </div>
                )
              })}
              <Link
                href="/oposiciones"
                className="block py-2 px-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm font-medium"
              >
                Ver todas las oposiciones →
              </Link>
            </div>
          </div>

          {/* Test de Leyes */}
          <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">📚</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
              Test de Leyes
            </h2>
            <div className="space-y-2">
              {topLaws.map(law => (
                <Link
                  key={law.slug}
                  href={`/leyes/${law.slug}`}
                  className="block py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm"
                >
                  {law.short_name}
                </Link>
              ))}
              <Link
                href="/leyes"
                className="block py-2 px-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm font-medium"
              >
                Ver todas las leyes →
              </Link>
            </div>
          </div>

        </div>

        {/* Temarios */}
        <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-4">📖</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              Temarios Completos
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Estudia los artículos de cada tema con la legislación actualizada
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {OPOSICIONES.map(o => (
              <Link
                key={o.slug}
                href={`/${o.slug}/temario`}
                className="block py-4 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-center transition-colors relative"
              >
                <span className="block mb-2">
                  <CcaaFlag oposicionId={o.id} size="md" />
                </span>
                <span className="block font-medium text-slate-700 dark:text-slate-300 text-sm">{o.shortName}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">{o.totalTopics} temas</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
