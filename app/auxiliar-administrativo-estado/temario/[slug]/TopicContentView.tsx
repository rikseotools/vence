// app/auxiliar-administrativo-estado/temario/[slug]/TopicContentView.tsx
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { TopicContent, LawWithArticles, Article } from '@/lib/api/temario/schemas'
import { useTopicUnlock } from '@/hooks/useTopicUnlock'
import { useAuth } from '@/contexts/AuthContext'

interface TopicContentViewProps {
  content: TopicContent
}

// Tipo para artículos débiles
interface WeakArticleInfo {
  lawName: string
  articleNumber: string
  failedCount: number
  totalAttempts: number
  correctCount: number
  avgSuccessRate: number
}

// Determinar el bloque según el número de tema (auxiliar administrativo)
function getBlockInfo(topicNumber: number): { block: string; displayNum: number } {
  if (topicNumber >= 1 && topicNumber <= 16) {
    return { block: 'Bloque I', displayNum: topicNumber }
  } else if (topicNumber >= 101 && topicNumber <= 112) {
    return { block: 'Bloque II', displayNum: topicNumber - 100 }
  }
  return { block: '', displayNum: topicNumber }
}

export default function TopicContentView({ content }: TopicContentViewProps) {
  // Por defecto colapsado para mejor orden visual
  const [expandedLaws, setExpandedLaws] = useState<Set<string>>(new Set())
  const { user } = useAuth() as { user: any }
  const { getWeakArticles } = useTopicUnlock({ positionType: 'auxiliar_administrativo' }) as {
    getWeakArticles: (topicNumber: number) => WeakArticleInfo[]
  }

  const blockInfo = getBlockInfo(content.topicNumber)

  // Obtener artículos débiles para este tema
  const weakArticles = useMemo(() => {
    if (!user) return []
    return getWeakArticles(content.topicNumber)
  }, [user, content.topicNumber, getWeakArticles])

  // Crear un mapa para búsqueda rápida: "lawShortName_articleNumber" -> WeakArticleInfo
  const weakArticlesMap = useMemo(() => {
    const map = new Map<string, WeakArticleInfo>()
    weakArticles.forEach(wa => {
      const key = `${wa.lawName}_${wa.articleNumber}`
      map.set(key, wa)
    })
    return map
  }, [weakArticles])

  const toggleLaw = (lawId: string) => {
    setExpandedLaws((prev) => {
      const next = new Set(prev)
      if (next.has(lawId)) {
        next.delete(lawId)
      } else {
        next.add(lawId)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedLaws(new Set(content.laws.map((l) => l.law.id)))
  }

  const collapseAll = () => {
    setExpandedLaws(new Set())
  }

  const handlePrint = () => {
    window.print()
  }

  // Contar artículos con preguntas oficiales
  const articlesWithOfficialQuestions = content.laws.reduce((acc, law) => {
    return acc + law.articles.filter(a => a.officialQuestionCount > 0).length
  }, 0)

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-break-before {
            page-break-before: always;
          }
          .print-avoid-break {
            page-break-inside: avoid;
          }
          .article-content {
            font-size: 11pt;
            line-height: 1.5;
          }
          .print-header {
            border-bottom: 2px solid #000;
            padding-bottom: 1rem;
            margin-bottom: 1.5rem;
          }
          .law-section {
            margin-bottom: 2rem;
          }
          @page {
            margin: 2cm;
          }
        }
      `}</style>

      {/* Control bar */}
      <div className="no-print sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/auxiliar-administrativo-estado/temario"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Volver al temario</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Expandir todo
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Colapsar todo
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="print-header mb-8">
          {blockInfo.block && (
            <span className="inline-block px-3 py-1 mb-3 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              {blockInfo.block}
            </span>
          )}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Tema {blockInfo.displayNum}: {content.title.replace(/^Tema \d+:\s*/, '')}
          </h1>

          {content.description && (
            <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
              {content.description}
            </p>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {content.laws.length} {content.laws.length === 1 ? 'ley' : 'leyes'}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {content.totalArticles} artículos
            </span>
            {articlesWithOfficialQuestions > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                {articlesWithOfficialQuestions} con preguntas de examen
              </span>
            )}
          </div>

          {/* Fecha de actualización y registro */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Actualizado a{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              .{' '}
              <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                Regístrate
              </Link>
              {' '}para recibir actualizaciones cuando la legislación cambie.
            </p>
          </div>
        </header>

        {/* Laws and articles */}
        <div className="space-y-6">
          {content.laws.map((lawData, index) => (
            <LawSection
              key={lawData.law.id}
              lawData={lawData}
              isExpanded={expandedLaws.has(lawData.law.id)}
              onToggle={() => toggleLaw(lawData.law.id)}
              isFirst={index === 0}
              weakArticlesMap={weakArticlesMap}
            />
          ))}
        </div>

        {/* Empty state */}
        {content.laws.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Contenido no disponible
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Este tema aún no tiene contenido asignado.
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="no-print mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Navigation */}
            <div className="flex gap-3">
              {content.topicNumber > 1 && (
                <Link
                  href={`/auxiliar-administrativo-estado/temario/tema-${content.topicNumber - 1}`}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Tema {content.topicNumber - 1}
                </Link>
              )}
              <Link
                href={`/auxiliar-administrativo-estado/temario/tema-${content.topicNumber + 1}`}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
              >
                Tema {content.topicNumber + 1}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <Link
              href={`/auxiliar-administrativo-estado/test/tema/${content.topicNumber}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Practicar este tema
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </footer>
      </main>
    </>
  )
}

// Law section component
interface LawSectionProps {
  lawData: LawWithArticles
  isExpanded: boolean
  onToggle: () => void
  isFirst: boolean
  weakArticlesMap: Map<string, WeakArticleInfo>
}

function LawSection({ lawData, isExpanded, onToggle, isFirst, weakArticlesMap }: LawSectionProps) {
  const { law, articles } = lawData
  const officialCount = articles.filter(a => a.officialQuestionCount > 0).length

  // Contar artículos débiles de esta ley
  const weakCount = articles.filter(a =>
    weakArticlesMap.has(`${law.shortName}_${a.articleNumber}`)
  ).length

  return (
    <section className={`law-section ${!isFirst ? 'print-break-before' : ''}`}>
      {/* Law header - clickable - fondo azul distintivo */}
      <button
        onClick={onToggle}
        className="no-print w-full flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl hover:from-indigo-100 hover:to-blue-100 dark:hover:from-indigo-900/50 dark:hover:to-blue-900/50 transition-all shadow-sm"
      >
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg text-xs font-bold">
              LEY
            </span>
            <h2 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
              {law.shortName}
            </h2>
          </div>
          <p className="text-sm text-indigo-600 dark:text-indigo-300 mt-1 ml-10">
            {law.name} {law.year && `(${law.year})`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right space-y-1">
            <span className="block text-sm font-medium text-indigo-700 dark:text-indigo-300">
              {articles.length} artículos
            </span>
            {officialCount > 0 && (
              <span className="flex items-center justify-end gap-1 text-xs text-amber-700 dark:text-amber-400" title="Artículos que han aparecido en exámenes oficiales anteriores">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                {officialCount} {officialCount === 1 ? 'artículo preguntado' : 'artículos preguntados'} en examen oficial
              </span>
            )}
            {weakCount > 0 && (
              <span className="flex items-center justify-end gap-1 text-xs text-red-600 dark:text-red-400 font-medium" title="Artículos donde tu porcentaje de aciertos es menor al 80%">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                {weakCount} {weakCount === 1 ? 'artículo' : 'artículos'} a repasar
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-indigo-500 dark:text-indigo-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Print-only law header */}
      <div className="hidden print:block mb-4">
        <h2 className="text-xl font-bold text-black border-b-2 border-gray-300 pb-2">
          {law.shortName}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {law.name} {law.year && `(${law.year})`}
        </p>
      </div>

      {/* Articles list */}
      {(isExpanded || true) && (
        <div className={`mt-2 space-y-4 ${!isExpanded ? 'hidden print:block' : ''}`}>
          {articles.map((article) => {
            const weakInfo = weakArticlesMap.get(`${law.shortName}_${article.articleNumber}`)
            return (
              <ArticleCard
                key={article.id}
                article={article}
                weakInfo={weakInfo}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

// Article card component
interface ArticleCardProps {
  article: Article
  weakInfo?: WeakArticleInfo
}

function ArticleCard({ article, weakInfo }: ArticleCardProps) {
  const hasOfficialQuestions = article.officialQuestionCount > 0
  const needsReview = !!weakInfo

  const formatContent = (content: string | null) => {
    if (!content) return null
    const lines = content.split(/(?=\d+\.\s)|(?=[a-z]\)\s)/g)
    return lines.map((line, index) => (
      <p key={index} className="mb-2 last:mb-0">
        {line.trim()}
      </p>
    ))
  }

  // Determinar nivel de urgencia según porcentaje de aciertos
  // 0-40% = crítico (rojo), 40-60% = malo (naranja), 60-80% = mejorable (amarillo)
  const getReviewLevel = (): 'critical' | 'bad' | 'improvable' | null => {
    if (!weakInfo) return null
    if (weakInfo.avgSuccessRate < 40) return 'critical'
    if (weakInfo.avgSuccessRate < 60) return 'bad'
    return 'improvable' // 60-80%
  }

  const reviewLevel = getReviewLevel()

  // Determinar estilos según prioridad: repasar > examen > normal
  const getBorderClass = () => {
    if (reviewLevel === 'critical') return 'border-red-400 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-800'
    if (reviewLevel === 'bad') return 'border-orange-400 dark:border-orange-500 ring-2 ring-orange-200 dark:ring-orange-800'
    if (reviewLevel === 'improvable') return 'border-yellow-400 dark:border-yellow-500 ring-1 ring-yellow-200 dark:ring-yellow-700'
    if (hasOfficialQuestions) return 'border-amber-300 dark:border-amber-600 ring-1 ring-amber-200 dark:ring-amber-700'
    return 'border-gray-200 dark:border-gray-700'
  }

  const getHeaderClass = () => {
    if (reviewLevel === 'critical') return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700'
    if (reviewLevel === 'bad') return 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700'
    if (reviewLevel === 'improvable') return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700'
    if (hasOfficialQuestions) return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
    return 'bg-gray-50 dark:bg-gray-750 border-gray-200 dark:border-gray-700'
  }

  return (
    <article className={`print-avoid-break bg-white dark:bg-gray-800 border rounded-lg overflow-hidden ${getBorderClass()}`}>
      {/* Badge de repasar - arriba del todo */}
      {needsReview && weakInfo && (
        <div className={`px-4 py-2 border-b ${
          reviewLevel === 'critical'
            ? 'bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-700'
            : reviewLevel === 'bad'
            ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-700'
            : 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-700'
        }`}>
          <div className={`flex items-center gap-2 ${
            reviewLevel === 'critical'
              ? 'text-red-700 dark:text-red-300'
              : reviewLevel === 'bad'
              ? 'text-orange-700 dark:text-orange-300'
              : 'text-yellow-700 dark:text-yellow-300'
          }`}>
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">
              {reviewLevel === 'critical' ? 'Repasar urgente' : reviewLevel === 'bad' ? 'Repasar' : 'Practicar más'} - {weakInfo.totalAttempts} {weakInfo.totalAttempts === 1 ? 'intento' : 'intentos'}, {weakInfo.totalAttempts - weakInfo.correctCount} {weakInfo.totalAttempts - weakInfo.correctCount === 1 ? 'fallo' : 'fallos'} ({weakInfo.avgSuccessRate}%)
            </span>
          </div>
        </div>
      )}

      {/* Article header */}
      <div className={`px-4 py-3 border-b ${getHeaderClass()}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 flex-1 min-w-0">
            <span className={`font-mono text-sm font-semibold flex-shrink-0 ${
              reviewLevel === 'critical' ? 'text-red-600 dark:text-red-400'
              : reviewLevel === 'bad' ? 'text-orange-600 dark:text-orange-400'
              : reviewLevel === 'improvable' ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-indigo-600 dark:text-indigo-400'
            }`}>
              Art. {article.articleNumber}
            </span>
            {article.title && (
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {article.title}
              </h3>
            )}
          </div>
          {/* Badge de pregunta de examen */}
          {hasOfficialQuestions && (
            <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 text-xs font-medium rounded-full">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">Examen</span>
              <span className="font-semibold">{article.officialQuestionCount}</span>
            </div>
          )}
        </div>
        {/* Location info */}
        {(article.titleNumber || article.chapterNumber || article.section) && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-2">
            {article.titleNumber && <span>Título {article.titleNumber}</span>}
            {article.chapterNumber && <span>Capítulo {article.chapterNumber}</span>}
            {article.section && <span>{article.section}</span>}
          </div>
        )}
      </div>

      {/* Article content */}
      <div className="px-4 py-4 article-content text-gray-700 dark:text-gray-300 leading-relaxed">
        {article.content ? (
          formatContent(article.content)
        ) : (
          <p className="text-gray-400 dark:text-gray-500 italic">
            Contenido no disponible
          </p>
        )}
      </div>
    </article>
  )
}
