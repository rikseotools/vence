// app/ayuda/page.tsx - Centro de ayuda público (SEO)
import { Metadata } from 'next'
import Link from 'next/link'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export const revalidate = 3600 // Revalidar cada hora

export const metadata: Metadata = {
  title: 'Centro de Ayuda - Vence | Preparacion de Oposiciones',
  description: 'Guias y tutoriales para usar Vence: tests, temarios, estadisticas, simulacros de examen, psicotecnicos y mas. Todo lo que necesitas para preparar tu oposicion.',
  openGraph: {
    title: 'Centro de Ayuda - Vence',
    description: 'Guias y tutoriales para preparar tu oposicion con Vence',
  },
}

interface HelpArticle {
  slug: string
  title: string
  category: string
  content: string
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; order: number }> = {
  tests: { label: 'Tests y practica', icon: '🎯', order: 1 },
  contenido: { label: 'Contenido y temario', icon: '📚', order: 2 },
  funcionalidades: { label: 'Funcionalidades', icon: '⚙️', order: 3 },
  cuenta: { label: 'Cuenta y suscripcion', icon: '👤', order: 4 },
}

async function getArticles(): Promise<HelpArticle[]> {
  const db = getDb()
  const result = await db.execute(
    sql`SELECT slug, title, category, content FROM help_articles WHERE is_published = true ORDER BY category, title`
  )
  return result as unknown as HelpArticle[]
}

export default async function AyudaPage() {
  const articles = await getArticles()

  // Agrupar por categoría
  const grouped: Record<string, HelpArticle[]> = {}
  for (const art of articles) {
    if (!grouped[art.category]) grouped[art.category] = []
    grouped[art.category].push(art)
  }

  // Ordenar categorías
  const sortedCategories = Object.entries(grouped).sort(
    ([a], [b]) => (CATEGORY_LABELS[a]?.order || 99) - (CATEGORY_LABELS[b]?.order || 99)
  )

  // Schema.org FAQPage
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: articles.map(art => ({
      '@type': 'Question',
      name: art.title,
      acceptedAnswer: {
        '@type': 'Answer',
        text: art.content.substring(0, 500),
      },
    })),
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Centro de Ayuda
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Todo lo que necesitas saber para aprovechar Vence al maximo
          </p>
        </div>

        {sortedCategories.map(([category, arts]) => {
          const cat = CATEGORY_LABELS[category] || { label: category, icon: '📄', order: 99 }
          return (
            <div key={category} className="mb-10">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </h2>
              <div className="grid gap-3">
                {arts.map(art => (
                  <Link
                    key={art.slug}
                    href={`/ayuda/${art.slug}`}
                    className="block bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all"
                  >
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {art.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {art.content.substring(0, 150)}...
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}

        <div className="mt-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            ¿No encuentras lo que buscas? Usa el <strong>chat IA</strong> dentro de la app o contacta con{' '}
            <Link href="/soporte" className="text-blue-600 hover:underline">soporte</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
