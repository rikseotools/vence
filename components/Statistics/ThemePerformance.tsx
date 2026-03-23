// components/Statistics/ThemePerformance.tsx
'use client'
import { useState, useEffect } from 'react'
import { generateLawSlug } from '../../lib/lawMappingUtils'
import ArticleModal from './ArticleModal'
import CcaaFlag from '@/components/CcaaFlag'

interface ThemeData {
  theme: number
  title: string
  accuracy: number
  correct: number
  total: number
  avgTime: number
  status: string
  trend?: 'improving' | 'declining' | 'stable'
  articlesCount: number
  oposicionLabel?: string
  oposicionPositionType?: string
  lastPracticed?: string | null
}

interface ArticleData {
  theme?: number
  tema_number?: number
  article: string
  article_number?: string
  law: string
  accuracy: number
  correct: number
  total: number
  avgTime: number
  avgRetention: number
  status: string
  trend?: 'improving' | 'declining' | 'stable'
}

interface UserOposicion {
  slug: string
  nombre: string
  bloquesCount?: number
  temasCount?: number
}

interface ModalState {
  isOpen: boolean
  lawSlug: string | null
  articleNumber: string | null
}

interface ThemePerformanceProps {
  themePerformance: ThemeData[] | null
  articlePerformance: ArticleData[] | null
  userOposicion?: UserOposicion | null
}

const getScoreColor = (percentage: number): string => {
  if (percentage >= 85) return 'text-green-600'
  if (percentage >= 70) return 'text-blue-600'
  if (percentage >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

const getScoreBg = (percentage: number): string => {
  if (percentage >= 85) return 'bg-green-50 border-green-200'
  if (percentage >= 70) return 'bg-blue-50 border-blue-200'
  if (percentage >= 50) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

// Título del tema — usa el title que viene del page (ya formateado por oposición)
const formatThemeFallback = (num: number): string => `Tema ${num}`

export default function ThemePerformance({ themePerformance, articlePerformance, userOposicion }: ThemePerformanceProps) {
  const [selectedTheme, setSelectedTheme] = useState<number | null>(null)
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    lawSlug: null,
    articleNumber: null
  })

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const openTheme = urlParams.get('openTheme')
    if (openTheme && themePerformance) {
      const themeExists = themePerformance.find(t => t.theme.toString() === openTheme)
      if (themeExists) {
        setSelectedTheme(parseInt(openTheme))
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openArticleModal = (lawName: string, articleNumber: string) => {
    const lawSlug = generateLawSlug(lawName)
    setModalState({
      isOpen: true,
      lawSlug: lawSlug,
      articleNumber: articleNumber
    })
  }

  const closeArticleModal = () => {
    setModalState({
      isOpen: false,
      lawSlug: null,
      articleNumber: null
    })
  }

  const getArticlesForTheme = (themeNumber: number): ArticleData[] => {
    return articlePerformance?.filter(article =>
      article.theme === themeNumber || article.tema_number === themeNumber
    ) || []
  }

  const oposicionSlug = userOposicion?.slug || 'auxiliar-administrativo-estado'

  let mainContent: React.ReactNode

  if (!themePerformance || themePerformance.length === 0) {
    mainContent = (
      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        <div className="text-4xl mb-4">📚</div>
        <h3 className="text-xl font-bold text-gray-700 mb-2">Análisis por Tema no disponible</h3>
        <p className="text-gray-600">Completa más tests para ver el rendimiento por tema</p>
      </div>
    )
  } else if (selectedTheme) {
    const themeData = themePerformance.find(t => t.theme === selectedTheme)
    const themeArticles = getArticlesForTheme(selectedTheme)

    mainContent = themeData ? (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              📖 {themeData.title || formatThemeFallback(selectedTheme)} - Artículos
            </h3>
            <p className="text-gray-600">Rendimiento detallado por artículo</p>
          </div>
          <button
            onClick={() => setSelectedTheme(null)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
          >
            ← Volver a Temas
          </button>
        </div>

        <div className={`p-4 rounded-lg border mb-6 ${getScoreBg(themeData.accuracy)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-3xl">
                {themeData.accuracy >= 85 ? '🏆' :
                 themeData.accuracy >= 70 ? '👍' :
                 themeData.accuracy >= 50 ? '⚠️' : '📚'}
              </div>
              <div>
                <div className="font-bold text-gray-800 text-lg">{themeData.title}</div>
                <div className="text-sm text-gray-600">
                  {themeData.correct}/{themeData.total} preguntas • {themeData.avgTime}s promedio
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${getScoreColor(themeData.accuracy)}`}>
                {themeData.accuracy}%
              </div>
              <div className="text-xs text-gray-600 capitalize">
                {themeData.status}
              </div>
            </div>
          </div>
        </div>

        {themeArticles.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-bold text-gray-800 mb-3">📋 Artículos del {formatThemeFallback(selectedTheme)}</h4>
            {themeArticles.map((article, index) => {
              const lawName = article.law || 'Ley desconocida'
              const articleNumber = article.article_number || article.article?.match(/\d+/)?.[0] || '1'

              return (
                <div key={index} className={`p-4 rounded-lg border ${getScoreBg(article.accuracy)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="text-2xl">
                        {article.status === 'dominado' ? '🏆' :
                         article.status === 'bien' ? '👍' :
                         article.status === 'regular' ? '⚠️' : '📚'}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-800">{article.article}</div>
                        <div className="text-sm text-gray-600">{article.law}</div>
                        <div className="text-xs text-gray-500">
                          {article.correct}/{article.total} aciertos • {article.avgTime}s promedio
                          {article.avgRetention > 0 && (
                            <span> • Retención: {article.avgRetention} pts</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className={`text-xl font-bold ${getScoreColor(article.accuracy)}`}>
                          {article.accuracy}%
                        </div>
                        <div className="text-xs text-gray-600 capitalize">
                          {article.status}
                        </div>
                        {article.trend && (
                          <div className={`text-xs mt-1 ${
                            article.trend === 'improving' ? 'text-green-600' :
                            article.trend === 'declining' ? 'text-red-600' :
                            'text-gray-600'
                          }`}>
                            {article.trend === 'improving' ? '📈' :
                             article.trend === 'declining' ? '📉' : '➡️'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pl-4">
                    <button
                      onClick={() => openArticleModal(lawName, articleNumber)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                      <span>📖</span>
                      <span>Ver Artículo</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <div className="text-4xl mb-2">📄</div>
            <div className="font-bold text-gray-700">Sin artículos analizados</div>
            <div className="text-sm text-gray-600">
              Completa más preguntas de este tema para ver análisis por artículo
            </div>
          </div>
        )}
      </div>
    ) : null
  }

  else {
    mainContent = (
      <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">📚 Rendimiento por Tema</h3>

      {userOposicion && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-medium">📋 Temario:</span> {userOposicion.nombre}
            <span className="text-blue-600 ml-2">({userOposicion.bloquesCount || 2} bloques, {userOposicion.temasCount || 28} temas)</span>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Mostrando temas según tu oposición seleccionada en el perfil
          </p>
        </div>
      )}

      <p className="text-gray-600 mb-6">Haz clic en un tema para ver el detalle por artículos</p>



      <div className="space-y-3">
        {themePerformance.map((theme, index) => {
          const themeUrl = `/${oposicionSlug}/temario/tema-${theme.theme}`

          return (
            <div
              key={index}
              className={`p-4 rounded-lg border hover:shadow-md transition-all cursor-pointer ${getScoreBg(theme.accuracy)}`}
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('.action-buttons')) {
                  setSelectedTheme(theme.theme)
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <div className="text-2xl">
                    {theme.accuracy >= 85 ? '🏆' :
                     theme.accuracy >= 70 ? '👍' :
                     theme.accuracy >= 50 ? '⚠️' : '📚'}
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-gray-800">{theme.title}</div>
                    {theme.oposicionLabel && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mt-0.5">
                        {theme.oposicionPositionType && (() => {
                          const isNational = theme.oposicionPositionType.includes('estado') || theme.oposicionPositionType.includes('tramitacion')
                          if (isNational) return <span>🇪🇸</span>
                          return <CcaaFlag oposicionId={theme.oposicionPositionType} size="sm" />
                        })()}
                        {theme.oposicionLabel}
                      </span>
                    )}
                    <div className="text-sm text-gray-600">
                      {theme.correct}/{theme.total} preguntas • {theme.avgTime}s promedio
                      {theme.lastPracticed && (
                        <span className="ml-1">• {new Date(theme.lastPracticed).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' })}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className={`text-xl font-bold ${getScoreColor(theme.accuracy)}`}>
                      {theme.accuracy}%
                    </div>
                    <div className="text-xs text-gray-600 capitalize">
                      {theme.status}
                    </div>
                    {theme.trend && (
                      <div className={`text-xs mt-1 ${
                        theme.trend === 'improving' ? 'text-green-600' :
                        theme.trend === 'declining' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {theme.trend === 'improving' ? '📈' :
                         theme.trend === 'declining' ? '📉' : '➡️'}
                      </div>
                    )}
                  </div>

                  <div className="action-buttons">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedTheme(theme.theme)
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                      <span>📊</span>
                      <span>Artículos</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>


      </div>
    )
  }

  return (
    <>
      {mainContent}

      <ArticleModal
        isOpen={modalState.isOpen}
        onClose={closeArticleModal}
        lawSlug={modalState.lawSlug}
        articleNumber={modalState.articleNumber}
      />
    </>
  )
}
