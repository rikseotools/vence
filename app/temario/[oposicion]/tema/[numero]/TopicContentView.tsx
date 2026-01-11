// app/temario/[oposicion]/tema/[numero]/TopicContentView.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { TopicContent, LawWithArticles, Article } from '@/lib/api/temario/schemas'

interface TopicContentViewProps {
  content: TopicContent
}

export default function TopicContentView({ content }: TopicContentViewProps) {
  const [expandedLaws, setExpandedLaws] = useState<Set<string>>(
    new Set(content.laws.map((l) => l.law.id))
  )

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

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          /* Hide navigation and controls when printing */
          .no-print {
            display: none !important;
          }

          /* Reset colors for print */
          body {
            background: white !important;
            color: black !important;
          }

          /* Ensure good page breaks */
          .print-break-before {
            page-break-before: always;
          }

          .print-avoid-break {
            page-break-inside: avoid;
          }

          /* Article styling for print */
          .article-content {
            font-size: 11pt;
            line-height: 1.5;
          }

          /* Header styling for print */
          .print-header {
            border-bottom: 2px solid #000;
            padding-bottom: 1rem;
            margin-bottom: 1.5rem;
          }

          /* Law section styling */
          .law-section {
            margin-bottom: 2rem;
          }

          /* Page margins */
          @page {
            margin: 2cm;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Navigation bar - hidden when printing */}
        <nav className="no-print sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link
              href={`/temario/${content.oposicion}`}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
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
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Imprimir PDF
              </button>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <header className="print-header mb-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-1">
                  {content.oposicionName}
                </p>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Tema {content.topicNumber}: {content.title}
                </h1>
              </div>

              {/* Progress badge - hidden when printing */}
              {content.userProgress && (
                <div className="no-print flex-shrink-0">
                  <div
                    className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                      content.userProgress.masteryLevel === 'expert'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : content.userProgress.masteryLevel === 'good'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {content.userProgress.accuracy.toFixed(0)}% dominio
                  </div>
                </div>
              )}
            </div>

            {content.description && (
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                {content.description}
              </p>
            )}

            {/* Stats */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                {content.laws.length} {content.laws.length === 1 ? 'ley' : 'leyes'}
              </span>
              <span className="flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                {content.totalArticles} artículos
              </span>
              {content.lastUpdated && (
                <span className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Actualizado:{' '}
                  {new Date(content.lastUpdated).toLocaleDateString('es-ES')}
                </span>
              )}
            </div>
          </header>

          {/* Locked state */}
          {!content.isUnlocked && content.unlockRequirements && (
            <div className="no-print mb-8 p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <svg
                    className="w-8 h-8 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                    Tema bloqueado
                  </h3>
                  <p className="text-amber-700 dark:text-amber-300 mb-3">
                    Para desbloquear este tema, necesitas completar el Tema{' '}
                    {content.unlockRequirements.previousTopicNumber} con al menos{' '}
                    {content.unlockRequirements.requiredAccuracy}% de aciertos y{' '}
                    {content.unlockRequirements.requiredQuestions} preguntas
                    respondidas.
                  </p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-amber-600 dark:text-amber-400">
                      Tu progreso en Tema{' '}
                      {content.unlockRequirements.previousTopicNumber}:{' '}
                      <strong>
                        {content.unlockRequirements.previousTopicAccuracy?.toFixed(
                          0
                        ) || 0}
                        %
                      </strong>
                    </span>
                  </div>
                  <Link
                    href={`/${content.oposicion}/test/tema/${content.unlockRequirements.previousTopicNumber}`}
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
                  >
                    Practicar Tema {content.unlockRequirements.previousTopicNumber}
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Laws and articles */}
          <div className="space-y-6">
            {content.laws.map((lawData, index) => (
              <LawSection
                key={lawData.law.id}
                lawData={lawData}
                isExpanded={expandedLaws.has(lawData.law.id)}
                onToggle={() => toggleLaw(lawData.law.id)}
                isFirst={index === 0}
              />
            ))}
          </div>

          {/* Empty state */}
          {content.laws.length === 0 && (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Contenido no disponible
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Este tema aún no tiene contenido asignado.
              </p>
            </div>
          )}

          {/* Footer - hidden when printing */}
          <footer className="no-print mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-end">
              <Link
                href={`/${content.oposicion}/test/tema/${content.topicNumber}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Practicar este tema
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </footer>
        </main>
      </div>
    </>
  )
}

// Law section component
interface LawSectionProps {
  lawData: LawWithArticles
  isExpanded: boolean
  onToggle: () => void
  isFirst: boolean
}

function LawSection({ lawData, isExpanded, onToggle, isFirst }: LawSectionProps) {
  const { law, articles } = lawData

  return (
    <section className={`law-section ${!isFirst ? 'print-break-before' : ''}`}>
      {/* Law header */}
      <button
        onClick={onToggle}
        className="no-print w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <div className="text-left">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {law.shortName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {law.name} {law.year && `(${law.year})`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {articles.length} artículos
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
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
        <div
          className={`mt-2 space-y-4 ${!isExpanded ? 'hidden print:block' : ''}`}
        >
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} lawShortName={law.shortName} />
          ))}
        </div>
      )}
    </section>
  )
}

// Article card component
interface ArticleCardProps {
  article: Article
  lawShortName: string
}

function ArticleCard({ article, lawShortName }: ArticleCardProps) {
  // Format article content with proper line breaks
  const formatContent = (content: string | null) => {
    if (!content) return null

    // Split by numbered points (1., 2., etc.) and lettered points (a), b), etc.)
    const lines = content.split(/(?=\d+\.\s)|(?=[a-z]\)\s)/g)

    return lines.map((line, index) => (
      <p key={index} className="mb-2 last:mb-0">
        {line.trim()}
      </p>
    ))
  }

  const hasOfficialQuestions = article.officialQuestionCount > 0

  return (
    <article className={`print-avoid-break bg-white dark:bg-gray-800 border rounded-lg overflow-hidden ${
      hasOfficialQuestions
        ? 'border-amber-300 dark:border-amber-600 ring-1 ring-amber-200 dark:ring-amber-700'
        : 'border-gray-200 dark:border-gray-700'
    }`}>
      {/* Article header */}
      <div className={`px-4 py-3 border-b ${
        hasOfficialQuestions
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
          : 'bg-gray-50 dark:bg-gray-750 border-gray-200 dark:border-gray-700'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 flex-1 min-w-0">
            <span className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
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
              <svg
                className="w-3.5 h-3.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
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
            {article.chapterNumber && (
              <span>Capítulo {article.chapterNumber}</span>
            )}
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
