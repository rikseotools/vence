// app/teoria/[law]/[articleNumber]/page.tsx - OPTIMIZADO con Drizzle + Cache
import {
  getArticleContent,
  getArticleNavigation,
  getRelatedArticles,
  getLawBasicInfo,
} from '@/lib/api/teoria'
import { getLawInfo, mapLawSlugToShortName } from '@/lib/lawMappingUtils'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import type { Metadata } from 'next'

type PageProps = {
  params: Promise<{ law: string; articleNumber: string }>
}

// ============================================
// METADATA DINÁMICA (CACHEADA)
// ============================================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const { law: lawSlug, articleNumber: articleParam } = resolvedParams

  // Extraer número de artículo
  const articleNumber = articleParam.startsWith('articulo-')
    ? parseInt(articleParam.replace('articulo-', ''))
    : parseInt(articleParam)

  if (isNaN(articleNumber)) {
    return {
      title: 'Artículo - Teoría Legal',
      description: 'Estudio de artículos de legislación española para oposiciones',
    }
  }

  // Obtener info de ley (cacheado)
  const shortName = mapLawSlugToShortName(lawSlug)
  const lawInfo = getLawInfo(shortName)

  // Intentar obtener título del artículo (cacheado)
  let articleTitle = `Artículo ${articleNumber}`
  try {
    const article = await getArticleContent(lawSlug, articleNumber)
    if (article?.title) {
      articleTitle = article.title
    }
  } catch {
    // Usar título por defecto
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
      siteName: 'Vence - Preparación de Oposiciones',
    },
    twitter: {
      card: 'summary',
      title,
      description,
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
      canonical: `${process.env.SITE_URL || 'https://www.vence.es'}/teoria/${lawSlug}/${articleParam}`,
    },
  }
}

// No pre-generar páginas estáticas
export async function generateStaticParams() {
  return []
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default async function ArticleIndividualPage({ params }: PageProps) {
  const resolvedParams = await params
  const { law: lawSlug, articleNumber: articleParam } = resolvedParams

  // Extraer número de artículo
  const articleNumber = articleParam.startsWith('articulo-')
    ? parseInt(articleParam.replace('articulo-', ''))
    : parseInt(articleParam)

  if (isNaN(articleNumber)) {
    return <ErrorState message="No se pudo identificar el número de artículo" lawSlug={lawSlug} />
  }

  // 🚀 QUERIES PARALELAS Y CACHEADAS
  const [article, navigation, relatedArticles] = await Promise.all([
    getArticleContent(lawSlug, articleNumber),
    getArticleNavigation(lawSlug),
    getRelatedArticles(lawSlug, articleNumber, 3),
  ])

  if (!article) {
    return <ErrorState message={`Artículo ${articleNumber} no encontrado`} lawSlug={lawSlug} />
  }

  // Calcular navegación prev/next
  const { articleNumbers } = navigation
  const currentIndex = articleNumbers.indexOf(articleNumber)
  const previousArticle = currentIndex > 0 ? articleNumbers[currentIndex - 1] : null
  const nextArticle = currentIndex < articleNumbers.length - 1 ? articleNumbers[currentIndex + 1] : null

  return (
    <div className="min-h-screen bg-white">
      {/* Header minimalista */}
      <div className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-3">
            <Link
              href={`/teoria/${lawSlug}`}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Volver a la página de la ley"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Artículo {article.articleNumber}
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm">{article.law.shortName}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido del artículo */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Título del artículo */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 leading-tight tracking-tight antialiased">
            {article.title}
          </h2>

          {/* Breadcrumb */}
          <nav className="text-sm text-gray-500">
            <Link href="/leyes" className="hover:text-gray-700">
              Leyes
            </Link>
            <span className="mx-2">→</span>
            <Link href={`/teoria/${lawSlug}`} className="hover:text-gray-700">
              {article.law.shortName}
            </Link>
            <span className="mx-2">→</span>
            <span className="text-gray-900">Artículo {article.articleNumber}</span>
          </nav>
        </div>

        {/* Contenido principal */}
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

        {/* Navegación anterior/siguiente */}
        <div className="flex items-center justify-between gap-2 py-4 mb-6">
          {previousArticle ? (
            <Link
              href={`/teoria/${lawSlug}/articulo-${previousArticle}`}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium">Art. {previousArticle}</span>
            </Link>
          ) : (
            <div className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-400">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium">Primero</span>
            </div>
          )}

          {/* Indicador central */}
          <div className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg">
            Artículo {articleNumber}
            {articleNumbers.length > 0 && (
              <span className="text-blue-600 ml-1">
                ({currentIndex + 1}/{articleNumbers.length})
              </span>
            )}
          </div>

          {nextArticle ? (
            <Link
              href={`/teoria/${lawSlug}/articulo-${nextArticle}`}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <span className="font-medium">Art. {nextArticle}</span>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          ) : (
            <div className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-400">
              <span className="font-medium">Último</span>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Artículos relacionados */}
        {relatedArticles.length > 0 && (
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Otros artículos de {article.law.shortName}
            </h3>

            <div className="space-y-3">
              {relatedArticles.map((related) => (
                <Link
                  key={related.articleNumber}
                  href={`/teoria/${related.lawSlug}/articulo-${related.articleNumber}`}
                  className="group block"
                >
                  <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="flex-shrink-0 w-16 text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            Art. {related.articleNumber}
                          </span>
                          <h4 className="text-gray-900 font-medium group-hover:text-blue-600 transition-colors">
                            {related.title}
                          </h4>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition-colors">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Footer de navegación */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex items-center justify-between">
          <Link
            href={`/teoria/${lawSlug}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors text-sm"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Volver a {article.law.shortName}
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

// ============================================
// COMPONENTE DE ERROR
// ============================================

function ErrorState({ message, lawSlug }: { message: string; lawSlug: string }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <Link
          href={`/teoria/${lawSlug}`}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Volver a la lista
        </Link>
      </div>
    </div>
  )
}
