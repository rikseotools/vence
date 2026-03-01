// app/auxiliar-administrativo-valencia/temario/[slug]/TopicContentView.tsx
// Reuses the CyL TopicContentView with Valencia-specific block ranges
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { TopicContent, LawWithArticles, Article } from '@/lib/api/temario/schemas'
import { useAuth } from '@/contexts/AuthContext'
import { getCanonicalSlug } from '@/lib/lawMappingUtils'

interface TopicContentViewProps {
  content: TopicContent
  oposicion?: string
}

// Determinar el bloque segun el numero de tema (Auxiliar Administrativo Generalitat Valenciana)
function getBlockInfo(topicNumber: number): { block: string; displayNum: number } {
  if (topicNumber >= 1 && topicNumber <= 10) {
    return { block: 'Materias Comunes', displayNum: topicNumber }
  } else if (topicNumber >= 11 && topicNumber <= 24) {
    return { block: 'Materias Especificas', displayNum: topicNumber }
  }
  return { block: '', displayNum: topicNumber }
}

export default function TopicContentView({ content, oposicion = 'auxiliar-administrativo-valencia' }: TopicContentViewProps) {
  const [expandedLaws, setExpandedLaws] = useState<Set<string>>(
    new Set(content.laws.map((l) => l.law.id))
  )
  const [showPrintModal, setShowPrintModal] = useState(false)
  const { user, userProfile } = useAuth() as { user: any; userProfile: any }

  const blockInfo = getBlockInfo(content.topicNumber)

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

  const handlePrint = () => {
    if (!user) {
      setShowPrintModal(true)
      return
    }
    window.print()
  }

  // Contar articulos con preguntas oficiales
  const articlesWithOfficialQuestions = content.laws.reduce((acc, law) => {
    return acc + law.articles.filter(a => a.officialQuestionCount > 0).length
  }, 0)

  const basePath = `/${oposicion}`

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-break-before { page-break-before: always; }
          .print-avoid-break { page-break-inside: avoid; }
          .article-content { font-size: 11pt; line-height: 1.5; }
          .print-header { border-bottom: 2px solid #000; padding-bottom: 1rem; margin-bottom: 1.5rem; }
          .law-section { margin-bottom: 2rem; }
          @page { margin: 2cm; }
        }
      `}</style>

      {/* Control bar */}
      <div className="no-print sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={`${basePath}/temario`}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Volver al indice</span>
          </Link>

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
              {content.laws.length} {content.laws.length === 1 ? 'ley' : 'leyes'}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full">
              {content.totalArticles} articulos
            </span>
            {articlesWithOfficialQuestions > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full">
                {articlesWithOfficialQuestions} con preguntas de examen
              </span>
            )}
          </div>

          {/* Mensaje personalizado para usuarios logueados */}
          {user && (() => {
            const userName = userProfile?.user_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Opositor/a'
            const avatarUrl = userProfile?.avatar_url || user?.user_metadata?.avatar_url
            return (
              <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-purple-600 dark:text-purple-300">
                        {userName[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-purple-900 dark:text-purple-100">
                      <span className="font-semibold">{userName}</span>, este temario esta{' '}
                      <span className="font-semibold text-purple-700 dark:text-purple-300">personalizado para ti</span>.{' '}
                      Entre mas tests de repaso hagas, Vence mas aprende de ti, para que seas mas productivo y te enfoques en lo importante.
                    </p>
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Actualizado a{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              .{' '}
              <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                Registrate
              </Link>
              {' '}para recibir actualizaciones cuando la legislacion cambie.
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
            />
          ))}
        </div>

        {/* Empty state */}
        {content.laws.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Contenido no disponible
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Este tema aun no tiene contenido asignado.
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="no-print mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex gap-3">
              {content.topicNumber > 1 && (
                <Link
                  href={`${basePath}/temario/tema-${content.topicNumber - 1}`}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
                >
                  Tema {content.topicNumber - 1}
                </Link>
              )}
              <Link
                href={`${basePath}/temario/tema-${content.topicNumber + 1}`}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
              >
                Tema {content.topicNumber + 1}
              </Link>
            </div>

            <Link
              href={`${basePath}/test/tema/${content.topicNumber}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Practicar este tema
            </Link>
          </div>
        </footer>
      </main>

      {/* Modal de registro para imprimir */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowPrintModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Descarga el temario en PDF
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Registrate gratis para descargar el PDF y recibir actualizaciones cuando cambie la legislacion.
              </p>
              <div className="space-y-3">
                <Link
                  href="/login?oposicion=auxiliar_administrativo_valencia&return_to=/auxiliar-administrativo-valencia/temario"
                  className="block w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Registrarse gratis
                </Link>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="block w-full py-3 px-4 text-gray-600 dark:text-gray-400 font-medium hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Quizas mas tarde
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Law section component
function LawSection({ lawData, isExpanded, onToggle, isFirst }: { lawData: LawWithArticles; isExpanded: boolean; onToggle: () => void; isFirst: boolean }) {
  const { law, articles } = lawData
  const officialCount = articles.filter(a => a.officialQuestionCount > 0).length

  return (
    <section className={`law-section ${!isFirst ? 'print-break-before' : ''}`}>
      <button
        onClick={onToggle}
        className="no-print w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <div className="text-left">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{law.shortName}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{law.name} {law.year && `(${law.year})`}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-sm text-gray-500 dark:text-gray-400">{articles.length} articulos</span>
            {officialCount > 0 && <span className="block text-xs text-amber-600 dark:text-amber-400">{officialCount} con examen</span>}
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <div className="no-print flex justify-end mt-1 -mb-1">
        <Link href={`/leyes/${getCanonicalSlug(law.shortName)}`} className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline">
          Hacer test de {law.shortName} →
        </Link>
      </div>

      <div className="hidden print:block mb-4">
        <h2 className="text-xl font-bold text-black border-b-2 border-gray-300 pb-2">{law.shortName}</h2>
        <p className="text-sm text-gray-600 mt-1">{law.name} {law.year && `(${law.year})`}</p>
      </div>

      {(isExpanded || true) && (
        <div className={`mt-2 space-y-4 ${!isExpanded ? 'hidden print:block' : ''}`}>
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} lawShortName={law.shortName} />
          ))}
        </div>
      )}
    </section>
  )
}

function ArticleCard({ article, lawShortName }: { article: Article; lawShortName: string }) {
  const hasOfficialQuestions = article.officialQuestionCount > 0

  const formatContent = (content: string | null) => {
    if (!content) return null
    const lines = content.split(/(?=\d+\.\s)|(?=[a-z]\)\s)/g)
    return lines.map((line, index) => <p key={index} className="mb-2 last:mb-0">{line.trim()}</p>)
  }

  return (
    <article className={`print-avoid-break bg-white dark:bg-gray-800 border rounded-lg overflow-hidden ${
      hasOfficialQuestions ? 'border-amber-300 dark:border-amber-600 ring-1 ring-amber-200 dark:ring-amber-700' : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className={`px-4 py-3 border-b ${hasOfficialQuestions ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' : 'bg-gray-50 dark:bg-gray-750 border-gray-200 dark:border-gray-700'}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 flex-1 min-w-0">
            <span className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400 flex-shrink-0">Art. {article.articleNumber}</span>
            {article.title && <h3 className="font-medium text-gray-900 dark:text-white truncate">{article.title}</h3>}
          </div>
          {hasOfficialQuestions && (
            <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 text-xs font-medium rounded-full">
              <span className="hidden sm:inline">Examen</span>
              <span className="font-semibold">{article.officialQuestionCount}</span>
            </div>
          )}
        </div>
        {(article.titleNumber || article.chapterNumber || article.section) && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-2">
            {article.titleNumber && <span>Titulo {article.titleNumber}</span>}
            {article.chapterNumber && <span>Capitulo {article.chapterNumber}</span>}
            {article.section && <span>{article.section}</span>}
          </div>
        )}
      </div>

      <div className="px-4 py-4 article-content text-gray-700 dark:text-gray-300 leading-relaxed">
        {article.content ? formatContent(article.content) : <p className="text-gray-400 dark:text-gray-500 italic">Contenido no disponible</p>}
      </div>

      <div className="no-print px-4 pb-4 flex justify-end">
        <Link
          href={`/leyes/${getCanonicalSlug(lawShortName)}?selected_articles=${article.articleNumber}&source=temario`}
          onClick={() => { if (typeof window !== 'undefined') sessionStorage.setItem('temario_return_url', window.location.href) }}
          className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
        >
          Hacer test Art. {article.articleNumber}
        </Link>
      </div>
    </article>
  )
}
