// app/administrativo-madrid/temario/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getTopicContent } from '@/lib/api/temario/queries'
import TopicContentView from './TopicContentView'
import { formatUpdatedAt } from '@/lib/temario/updatedAt'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'

export const revalidate = 3600 // Edge caching SWR (2026-05-17): HTML cacheado 1h en CDN, stale-while-revalidate elimina cold starts visibles

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

  const content = await getTopicContent('administrativo-madrid', topicNumber)

  if (!content) {
    return { title: 'Tema no encontrado' }
  }

  return {
    title: `${content.title} | Auxiliar Administrativo de la Comunidad de Madrid`,
    description: content.description || `Contenido teórico del Tema ${topicNumber} para Auxiliar Administrativo de la Comunidad de Madrid`,
    openGraph: {
      title: `${content.title} | Auxiliar Administrativo de la Comunidad de Madrid`,
      description: content.description || `Contenido teórico del Tema ${topicNumber}`,
      url: `https://www.vence.es/administrativo-madrid/temario/${slug}`,
      siteName: 'Vence.es',
      locale: 'es_ES',
      type: 'article',
    },
    alternates: {
      canonical: `https://www.vence.es/administrativo-madrid/temario/${slug}`,
    },
  }
}

export default async function TemarioTemaPage({ params }: PageProps) {
  const { slug } = await params
  const topicNumber = parseTopicNumber(slug)

  if (!topicNumber) {
    notFound()
  }

  const content = await getTopicContent('administrativo-madrid', topicNumber)

  if (!content) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={<div className="h-12 bg-gray-50 border-b border-gray-200" />}>
        <InteractiveBreadcrumbs />
      </Suspense>
      <TopicContentView content={content} oposicion="administrativo-madrid" updatedAt={formatUpdatedAt()} />
    </div>
  )
}
