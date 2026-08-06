// app/auxiliar-clinica-diputacion-sevilla/temario/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getTopicContent } from '@/lib/api/temario/queries'
import TopicContentView from '@/components/temario/TopicContentView'
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

  const content = await getTopicContent('auxiliar-clinica-diputacion-sevilla', topicNumber)

  if (!content) {
    return { title: 'Tema no encontrado' }
  }

  return {
    title: `${content.title} | Cuerpo Auxiliar de Clínica de la Diputación Provincial de Sevilla`,
    description: content.description || `Contenido teórico del Tema ${topicNumber} para Cuerpo Auxiliar de Clínica de la Diputación Provincial de Sevilla`,
    openGraph: {
      title: `${content.title} | Cuerpo Auxiliar de Clínica de la Diputación Provincial de Sevilla`,
      description: content.description || `Contenido teórico del Tema ${topicNumber}`,
      url: `https://www.vence.es/auxiliar-clinica-diputacion-sevilla/temario/${slug}`,
      siteName: 'Vence.es',
      locale: 'es_ES',
      type: 'article',
    },
    alternates: {
      canonical: `https://www.vence.es/auxiliar-clinica-diputacion-sevilla/temario/${slug}`,
    },
  }
}

export default async function TemarioTemaPage({ params }: PageProps) {
  const { slug } = await params
  const topicNumber = parseTopicNumber(slug)

  if (!topicNumber) {
    notFound()
  }

  const content = await getTopicContent('auxiliar-clinica-diputacion-sevilla', topicNumber)

  if (!content) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={<div className="h-12 bg-gray-50 border-b border-gray-200" />}>
        <InteractiveBreadcrumbs />
      </Suspense>
      <TopicContentView content={content} oposicion="auxiliar-clinica-diputacion-sevilla" updatedAt={formatUpdatedAt()} />
    </div>
  )
}
