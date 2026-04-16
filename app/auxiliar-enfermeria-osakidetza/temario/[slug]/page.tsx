// app/auxiliar-enfermeria-osakidetza/temario/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getTopicContent } from '@/lib/api/temario/queries'
import TopicContentView from './TopicContentView'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'

export const revalidate = false

// Pre-generar todos los temas en build time
// TCAE Osakidetza: 19 temas comunes (1-19) + 30 temas específicos (101-130)
export async function generateStaticParams() {
  const common = Array.from({ length: 19 }, (_, i) => ({ slug: `tema-${i + 1}` }))
  const specific = Array.from({ length: 30 }, (_, i) => ({ slug: `tema-${101 + i}` }))
  return [...common, ...specific]
}

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

function parseTopicNumber(slug: string): number | null {
  const match = slug.match(/^tema-(\d+)$/)
  if (!match) return null
  return parseInt(match[1], 10)
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const topicNumber = parseTopicNumber(slug)

  if (!topicNumber) {
    return { title: 'Tema no encontrado' }
  }

  const content = await getTopicContent('auxiliar-enfermeria-osakidetza', topicNumber)

  if (!content) {
    return { title: 'Tema no encontrado' }
  }

  return {
    title: `${content.title} | TCAE Osakidetza`,
    description: content.description || `Contenido teórico del Tema ${topicNumber} para TCAE Osakidetza`,
    openGraph: {
      title: `${content.title} | TCAE Osakidetza`,
      description: content.description || `Contenido teórico del Tema ${topicNumber}`,
      url: `https://www.vence.es/auxiliar-enfermeria-osakidetza/temario/${slug}`,
      siteName: 'Vence.es',
      locale: 'es_ES',
      type: 'article',
    },
    alternates: {
      canonical: `https://www.vence.es/auxiliar-enfermeria-osakidetza/temario/${slug}`,
    },
  }
}

export default async function TemarioTemaPage({ params }: PageProps) {
  const { slug } = await params
  const topicNumber = parseTopicNumber(slug)

  if (!topicNumber) {
    notFound()
  }

  const content = await getTopicContent('auxiliar-enfermeria-osakidetza', topicNumber)

  if (!content) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={<div className="h-12 bg-gray-50 border-b border-gray-200" />}>
        <InteractiveBreadcrumbs />
      </Suspense>
      <TopicContentView content={content} oposicion="auxiliar-enfermeria-osakidetza" />
    </div>
  )
}
