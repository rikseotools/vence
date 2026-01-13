// app/teoria/[law]/page.js - VERSIÓN CON METADATA DINÁMICA PARA SEO
import { getLawInfo, mapLawSlugToShortName } from '../../../lib/lawMappingUtils'
import LawArticlesClient from './LawArticlesClient'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

// Generar metadata dinámica para SEO
export async function generateMetadata({ params }) {
  const resolvedParams = await params
  const lawSlug = resolvedParams.law
  
  // Obtener información de la ley
  const shortName = mapLawSlugToShortName(lawSlug)
  const lawInfo = getLawInfo(shortName)
  
  if (!lawInfo) {
    return {
      title: 'Teoría Legal',
      description: 'Estudio de legislación española para oposiciones'
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

export default function LawArticlesPage({ params, searchParams }) {
  return (
    <>
      <ClientBreadcrumbsWrapper />
      <LawArticlesClient params={params} searchParams={searchParams} />
    </>
  )
}