// app/teoria/[law]/[articleNumber]/page.js - SOLUCIÓN SIMPLE PARA NEXT.JS 15 CON METADATA SEO

import { fetchArticleContent, fetchRelatedArticles, fetchLawArticles } from '@/lib/teoriaFetchers'
import { getLawInfo, mapLawSlugToShortName } from '@/lib/lawMappingUtils'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Suspense } from 'react'

// Generar metadata dinámica para artículos individuales
export async function generateMetadata({ params }) {
  try {
    const resolvedParams = await params
    const lawSlug = resolvedParams.law
    const articleParam = resolvedParams.articleNumber
    
    // Extraer número de artículo
    let articleNumber = null
    if (articleParam) {
      if (articleParam.startsWith('articulo-')) {
        articleNumber = articleParam.replace('articulo-', '')
      } else {
        articleNumber = articleParam
      }
    }
    
    // Obtener información de la ley
    const shortName = mapLawSlugToShortName(lawSlug)
    const lawInfo = getLawInfo(shortName)
    
    // Intentar obtener título del artículo
    let articleTitle = `Artículo ${articleNumber}`
    try {
      const article = await fetchArticleContent(lawSlug, parseInt(articleNumber))
      if (article?.title) {
        articleTitle = article.title
      }
    } catch (err) {
      console.log('No se pudo cargar título del artículo para metadata')
    }
    
    const title = lawInfo 
      ? `Art. ${articleNumber} ${lawInfo.name} - ${articleTitle}`
      : `Artículo ${articleNumber} - Teoría Legal`
    
    const description = lawInfo
      ? `Estudia el artículo ${articleNumber} de ${lawInfo.name}: ${articleTitle}. ${lawInfo.description}`
      : `Contenido completo del artículo ${articleNumber}. Teoría legal para oposiciones.`
    
    return {
      title,
      description,
      keywords: `artículo ${articleNumber}, ${shortName}, ${lawInfo?.name || 'legislación'}, teoría, oposiciones`,
      openGraph: {
        title,
        description,
        url: `https://vence.es/teoria/${lawSlug}/${articleParam}`,
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
        canonical: `${process.env.SITE_URL || 'https://www.vence.es'}/teoria/${lawSlug}/${articleParam}`
      }
    }
  } catch (error) {
    return {
      title: 'Artículo - Teoría Legal',
      description: 'Estudio de artículos de legislación española para oposiciones'
    }
  }
}

// 🔥 SOLUCIÓN SIMPLE: NO precompilar rutas automáticamente
export async function generateStaticParams() {
  console.log('🎯 Teoría: Todas las páginas se generan bajo demanda (user-driven)')
  return []
}

// 🚨 FIX: Hacer el componente totalmente async y usar force-dynamic
export const dynamic = 'force-dynamic'

export default async function ArticleIndividualPage({ params }) {
  // 🔧 SOLUCIÓN: await params está bien en async components
  const resolvedParams = await params
  const lawSlug = resolvedParams.law
  const articleParam = resolvedParams.articleNumber
  
  // Extraer número de artículo
  let articleNumber = null
  if (articleParam) {
    if (articleParam.startsWith('articulo-')) {
      articleNumber = articleParam.replace('articulo-', '')
    } else {
      articleNumber = articleParam
    }
  }
  
  if (!articleNumber) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Artículo no encontrado</h1>
          <p className="text-gray-600 mb-6">No se pudo identificar el número de artículo</p>
          <Link 
            href={`/leyes/${lawSlug}`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Volver a la lista
          </Link>
        </div>
      </div>
    )
  }
  
  let article = null
  let relatedArticles = []
  let error = null
  let lawArticles = []
  
  try {
    // Cargar contenido del artículo
    article = await fetchArticleContent(lawSlug, parseInt(articleNumber))
    
    // Cargar lista completa de artículos para navegación inteligente
    const lawData = await fetchLawArticles(lawSlug)
    lawArticles = lawData.articles
      .map(a => parseInt(a.article_number))
      .filter(num => !isNaN(num))
      .sort((a, b) => a - b)
    
    // Cargar artículos relacionados
    relatedArticles = await fetchRelatedArticles(lawSlug, parseInt(articleNumber), 3)
    
  } catch (err) {
    console.error('❌ Error cargando artículo:', err)
    error = err.message
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error cargando artículo</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link 
            href={`/leyes/${lawSlug}`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Volver a la lista
          </Link>
        </div>
      </div>
    )
  }

  // Calcular navegación inteligente
  const currentNum = parseInt(articleNumber)
  const currentIndex = lawArticles.indexOf(currentNum)
  const previousArticle = currentIndex > 0 ? lawArticles[currentIndex - 1] : null
  const nextArticle = currentIndex < lawArticles.length - 1 ? lawArticles[currentIndex + 1] : null

  return (
    <div className="min-h-screen bg-white">
      {/* Header minimalista */}
      <div className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-3">
            <Link 
              href={`/leyes/${lawSlug}`}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Volver a la página de la ley"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Artículo {article.article_number}
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm">
                {article.law.short_name}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido del artículo */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Título del artículo con mejor tipografía */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 leading-tight tracking-tight antialiased">
            {article.title}
          </h2>
          
          {/* Breadcrumb corregido */}
          <nav className="text-sm text-gray-500">
            <Link href="/leyes" className="hover:text-gray-700">
              Leyes
            </Link>
            <span className="mx-2">→</span>
            <Link href={`/leyes/${lawSlug}`} className="hover:text-gray-700">
              {article.law.short_name}
            </Link>
            <span className="mx-2">→</span>
            <span className="text-gray-900">
              Artículo {article.article_number}
            </span>
          </nav>
        </div>

        {/* Contenido principal - Diseño limpio */}
        <div className="prose prose-lg max-w-none mb-12">
          <div className="bg-gray-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
            {article.hasRichContent ? (
              <div 
                className="text-gray-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: article.cleanContent }}
              />
            ) : (
              <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                {article.content}
              </div>
            )}
          </div>
        </div>

        {/* Navegación anterior/siguiente - versión inteligente */}
        <div className="flex items-center justify-between gap-2 py-4 mb-6">
          {/* Botón Anterior - Solo si existe */}
          {previousArticle ? (
            <Link 
              href={`/teoria/${lawSlug}/articulo-${previousArticle}`}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Art. {previousArticle}</span>
            </Link>
          ) : (
            <div className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-400">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Primero</span>
            </div>
          )}

          {/* Indicador central - Compacto */}
          <div className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg">
            Artículo {articleNumber}
            {lawArticles.length > 0 && (
              <span className="text-blue-600 ml-1">
                ({currentIndex + 1}/{lawArticles.length})
              </span>
            )}
          </div>

          {/* Botón Siguiente - Solo si existe */}
          {nextArticle ? (
            <Link 
              href={`/teoria/${lawSlug}/articulo-${nextArticle}`}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <span className="font-medium">Art. {nextArticle}</span>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </Link>
          ) : (
            <div className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-400">
              <span className="font-medium">Último</span>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        {/* Artículos relacionados - Solo si existen */}
        {relatedArticles.length > 0 && (
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Otros artículos de {article.law.short_name}
            </h3>
            
            <div className="space-y-3">
              {relatedArticles.map((related) => (
                <Link 
                  key={related.article_number}
                  href={`/teoria/${related.lawSlug}/articulo-${related.article_number}`}
                  className="group block"
                >
                  <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="flex-shrink-0 w-16 text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            Art. {related.article_number}
                          </span>
                          <h4 className="text-gray-900 font-medium group-hover:text-blue-600 transition-colors">
                            {related.title}
                          </h4>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition-colors">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Footer de navegación corregido */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex items-center justify-between">
          <Link 
            href={`/leyes/${lawSlug}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors text-sm"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Volver a {article.law.short_name}
          </Link>
          
          <Link 
            href="/leyes"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors text-sm"
          >
            Ver todas las leyes
          </Link>
        </div>

      </div>
    </div>
  )
}