// app/page.tsx
// Home page — datos de OPOSICIONES config + leyes top de BD. HTML estático (ISR 24h).
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // eslint-disable-next-line no-restricted-syntax -- Server Component (sin 'use client'): SERVICE_ROLE corre server-side, no se incluye en el bundle cliente
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Step 1: Get articles grouped by law_id with question count
  // articles → questions is the join path (questions.primary_article_id → articles.id)
  const { data: articles } = await supabase
    .from('articles')
    .select('law_id')
    .eq('is_active', true)

  if (!articles) return []

  // Step 2: Get law metadata
  const { data: laws } = await supabase
    .from('laws')
    .select('id, short_name, slug')
    .eq('is_active', true)
    .eq('is_virtual', false)
    .not('slug', 'is', null)

  if (!laws) return []

  const lawMap = new Map(laws.map(l => [l.id, l]))

  // Step 3: Count articles per law (as proxy — laws with more articles tend to have more questions)
  // For accuracy, count questions per law in parallel but only for non-virtual laws with slugs
  const lawIds = laws.map(l => l.id)
  const articlesByLaw = new Map<string, string[]>()
  for (const art of articles) {
    if (!lawIds.includes(art.law_id)) continue
    if (!articlesByLaw.has(art.law_id)) articlesByLaw.set(art.law_id, [])
    articlesByLaw.get(art.law_id)!.push(art.law_id) // just counting
  }

  // Step 4: For laws with articles, count questions in parallel (only ~50 laws to check)
  const lawsWithArticles = [...articlesByLaw.keys()]
  const counts = await Promise.all(
    lawsWithArticles.map(async (lawId) => {
      const { data: artIds } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', lawId)
        .eq('is_active', true)

      if (!artIds || artIds.length === 0) return { lawId, count: 0 }

      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .in('primary_article_id', artIds.map(a => a.id))
        .eq('is_active', true)

      return { lawId, count: count ?? 0 }
    })
  )

  return counts
    .filter(c => c.count >= 100 && lawMap.has(c.lawId))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map(c => {
      const law = lawMap.get(c.lawId)!
      return { short_name: law.short_name, slug: law.slug!, question_count: c.count }
    })
}

function getFormattedDate(): string {
  const now = new Date()
  const day = now.getDate()
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${day} ${months[now.getMonth()]} ${now.getFullYear()}`
}

export default async function HomePage() {
  const topLaws = await getTopLaws()

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
