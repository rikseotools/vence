// app/administrativo-estado/temario/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getTopicContent } from '@/lib/api/temario/queries'
import TopicContentView from './TopicContentView'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'

// Contenido estático - cachear para siempre (el temario casi nunca cambia)
// Para forzar actualización: revalidateTag('temario')
export const revalidate = false

// Pre-generar todos los temas en build time
export async function generateStaticParams() {
  // Administrativo del Estado: 6 bloques con numeración específica
  const bloqueI = Array.from({ length: 11 }, (_, i) => ({ slug: `tema-${i + 1}` }))       // 1-11
  const bloqueII = Array.from({ length: 4 }, (_, i) => ({ slug: `tema-${201 + i}` }))     // 201-204
  const bloqueIII = Array.from({ length: 7 }, (_, i) => ({ slug: `tema-${301 + i}` }))    // 301-307
  const bloqueIV = Array.from({ length: 9 }, (_, i) => ({ slug: `tema-${401 + i}` }))     // 401-409
  const bloqueV = Array.from({ length: 6 }, (_, i) => ({ slug: `tema-${501 + i}` }))      // 501-506
  const bloqueVI = Array.from({ length: 8 }, (_, i) => ({ slug: `tema-${601 + i}` }))     // 601-608
  return [...bloqueI, ...bloqueII, ...bloqueIII, ...bloqueIV, ...bloqueV, ...bloqueVI]
}

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

// Parsear el número del tema desde el slug (tema-1 -> 1)
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

  const content = await getTopicContent('administrativo-estado', topicNumber)

  if (!content) {
    return { title: 'Tema no encontrado' }
  }

  return {
    title: `${content.title} | Administrativo del Estado`,
    description: content.description || `Contenido teórico del Tema ${topicNumber} para Administrativo del Estado`,
    openGraph: {
      title: `${content.title} | Administrativo del Estado`,
      description: content.description || `Contenido teórico del Tema ${topicNumber}`,
      url: `https://www.vence.es/administrativo-estado/temario/${slug}`,
      siteName: 'Vence.es',
      locale: 'es_ES',
      type: 'article',
    },
    alternates: {
      canonical: `https://www.vence.es/administrativo-estado/temario/${slug}`,
    },
  }
}

export default async function TemarioTemaPage({ params }: PageProps) {
  const { slug } = await params
  const topicNumber = parseTopicNumber(slug)

  if (!topicNumber) {
    notFound()
  }

  const content = await getTopicContent('administrativo-estado', topicNumber)

  if (!content) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={<div className="h-12 bg-gray-50 border-b border-gray-200" />}>
        <InteractiveBreadcrumbs />
      </Suspense>
      <TopicContentView content={content} oposicion="administrativo-estado" />
    </div>
  )
}
