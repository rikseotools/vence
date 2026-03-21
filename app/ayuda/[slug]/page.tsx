// app/ayuda/[slug]/page.tsx - Artículo de ayuda individual (SEO)
import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export const revalidate = 3600

interface HelpArticle {
  slug: string
  title: string
  category: string
  content: string
  related_urls: string[]
  updated_at: string
}

interface Props {
  params: Promise<{ slug: string }>
}

async function getArticle(slug: string): Promise<HelpArticle | null> {
  const db = getDb()
  const result = await db.execute(
    sql`SELECT slug, title, category, content, related_urls, updated_at
        FROM help_articles
        WHERE slug = ${slug} AND is_published = true
        LIMIT 1`
  )
  const rows = result as unknown as HelpArticle[]
  return rows[0] || null
}

async function getAllSlugs(): Promise<string[]> {
  const db = getDb()
  const result = await db.execute(
    sql`SELECT slug FROM help_articles WHERE is_published = true`
  )
  const rows = result as unknown as { slug: string }[]
  return rows.map(r => r.slug)
}

export async function generateStaticParams() {
  const slugs = await getAllSlugs()
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) return { title: 'No encontrado' }

  return {
    title: `${article.title} - Ayuda Vence`,
    description: article.content.substring(0, 160),
    openGraph: {
      title: article.title,
      description: article.content.substring(0, 160),
    },
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  tests: 'Tests y practica',
  contenido: 'Contenido y temario',
  funcionalidades: 'Funcionalidades',
  cuenta: 'Cuenta y suscripcion',
}

function renderMarkdown(content: string): string {
  // Conversión básica de markdown a HTML
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n- /g, '</p><li>')
    .replace(/\n(\d+)\. /g, '</p><li>')
    .replace(/\n/g, '<br/>')
}

export default async function AyudaArticlePage({ params }: Props) {
  const { slug } = await params
  const article = await getArticle(slug)

  if (!article) {
    notFound()
  }

  // Schema.org Article
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.content.substring(0, 160),
    dateModified: article.updated_at,
    publisher: {
      '@type': 'Organization',
      name: 'Vence',
      url: 'https://www.vence.es',
    },
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* Breadcrumbs */}
        <nav className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/ayuda" className="hover:text-blue-600">Centro de Ayuda</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700 dark:text-gray-300">{CATEGORY_LABELS[article.category] || article.category}</span>
        </nav>

        {/* Artículo */}
        <article className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {article.title}
          </h1>

          <div
            className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
          />

          {/* Links relacionados */}
          {article.related_urls && article.related_urls.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Links relacionados
              </h3>
              <div className="flex flex-wrap gap-2">
                {article.related_urls.map(url => (
                  <Link
                    key={url}
                    href={url}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    {url}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Volver */}
        <div className="mt-6 text-center">
          <Link
            href="/ayuda"
            className="text-blue-600 hover:underline text-sm"
          >
            Volver al Centro de Ayuda
          </Link>
        </div>
      </div>
    </div>
  )
}
