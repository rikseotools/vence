// app/teoria/[law]/page.js - VERSIÓN CON METADATA DINÁMICA PARA SEO
import { getShortNameBySlug, getLawInfoBySlug } from '@/lib/api/laws'
import { notFound } from 'next/navigation'
import LawArticlesClient from './LawArticlesClient'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

// Generar metadata dinámica para SEO
export async function generateMetadata({ params }) {
  const resolvedParams = await params
  const lawSlug = resolvedParams.law

  // Obtener información de la ley
  const shortName = await getShortNameBySlug(lawSlug)

  // Si el slug no es válido, devolver metadata para 404
  if (!shortName) {
    return {
      title: 'Ley no encontrada | Vence',
      robots: { index: false, follow: false }
    }
  }

  const lawInfo = await getLawInfoBySlug(lawSlug)

  if (!lawInfo) {
    return {
      title: 'Ley no encontrada | Vence',
      robots: { index: false, follow: false }
    }
  }
  
  const title = `${lawInfo.name} - Teoría y Artículos`
  const description = `Estudia todos los artículos de ${lawInfo.name}. ${lawInfo.description}. Teoría completa para oposiciones.`
  
  return {
    title,
    description,
    keywords: `${shortName}, ${lawInfo.name}, teoría, artículos, legislación, oposiciones, estudio`,
    openGraph: {
      title,
      description,
      url: `https://www.vence.es/teoria/${lawSlug}`,
      type: 'article',
      siteName: 'Vence - Preparación de Oposiciones'
    },
    twitter: {
      card: 'summary',
      title,
      description
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: `${process.env.SITE_URL || 'https://www.vence.es'}/teoria/${lawSlug}`
    }
  }
}

export default async function LawArticlesPage({ params, searchParams }) {
  const resolvedParams = await params
  const lawSlug = resolvedParams.law

  // Validar que la ley existe
  const shortName = await getShortNameBySlug(lawSlug)
  if (!shortName) {
    notFound()
  }

  return (
    <>
      <ClientBreadcrumbsWrapper />
      <LawArticlesClient params={params} searchParams={searchParams} />
    </>
  )
}