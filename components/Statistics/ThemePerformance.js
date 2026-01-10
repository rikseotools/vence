// components/Statistics/ThemePerformance.js
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { generateLawSlug } from '../../lib/lawMappingUtils'
import ArticleModal from './ArticleModal'

const getScoreColor = (percentage) => {
  if (percentage >= 85) return 'text-green-600'
  if (percentage >= 70) return 'text-blue-600'
  if (percentage >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

const getScoreBg = (percentage) => {
  if (percentage >= 85) return 'bg-green-50 border-green-200'
  if (percentage >= 70) return 'bg-blue-50 border-blue-200'
  if (percentage >= 50) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

// Formatear número de tema para mostrar al usuario
const formatThemeName = (num, oposicionSlug = 'auxiliar-administrativo-estado') => {
  // Administrativo del Estado (C1) - Estructura según /administrativo-estado/test
  if (oposicionSlug === 'administrativo-estado') {
    if (num >= 1 && num <= 11) return `Bloque I - Tema ${num}`
    if (num >= 201 && num <= 204) return `Bloque II - Tema ${num - 200}`
    if (num >= 301 && num <= 307) return `Bloque III - Tema ${num - 300}`
    if (num >= 401 && num <= 409) return `Bloque IV - Tema ${num - 400}`
    if (num >= 501 && num <= 506) return `Bloque V - Tema ${num - 500}`
    if (num >= 601 && num <= 608) return `Bloque VI - Tema ${num - 600}`
    return `Tema ${num}`
  }

  // Auxiliar Administrativo del Estado (C2) - Estructura por defecto
  if (num >= 1 && num <= 16) return `Bloque I - Tema ${num}`
  if (num >= 101 && num <= 112) return `Bloque II - Tema ${num - 100}`

  return `Tema ${num}`
}

export default function ThemePerformance({ themePerformance, articlePerformance, userOposicion }) {
  const [selectedTheme, setSelectedTheme] = useState(null)
  const [modalState, setModalState] = useState({
    isOpen: false,
    lawSlug: null,
    articleNumber: null
  })
  
  // Detectar si debe abrir un tema específico al cargar
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const openTheme = urlParams.get('openTheme')
    if (openTheme && themePerformance) {
      const themeExists = themePerformance.find(t => t.theme.toString() === openTheme)
      if (themeExists) {
        setSelectedTheme(parseInt(openTheme))
        // Limpiar el parámetro de la URL sin recargar la página
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
    }
  }, []) // Solo ejecutar una vez al montar

  const openArticleModal = (lawName, articleNumber) => {
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

  // Filtrar artículos del tema seleccionado
  const getArticlesForTheme = (themeNumber) => {
    return articlePerformance?.filter(article => 
      article.theme === themeNumber || article.tema_number === themeNumber
    ) || []
  }

  // Contenido principal
  let mainContent

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

    mainContent = (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              📖 {themeData.title || formatThemeName(selectedTheme, userOposicion?.slug)} - Artículos
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

        {/* Resumen del tema */}
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

        {/* Lista de artículos */}
        {themeArticles.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-bold text-gray-800 mb-3">📋 Artículos del {formatThemeName(selectedTheme, userOposicion?.slug)}</h4>
            {themeArticles.map((article, index) => {
              // Preparar datos para el modal del artículo
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
                  
                  {/* Botón para abrir artículo en modal - FUERA del contenedor */}
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
    )
  }

  else {
    mainContent = (
      <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">📚 Rendimiento por Tema</h3>

      {/* Indicador de oposición seleccionada */}
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
          const themeUrl = `/auxiliar-administrativo-estado/temario/tema-${theme.theme}`
          
          return (
            <div
              key={index}
              className={`p-4 rounded-lg border hover:shadow-md transition-all cursor-pointer ${getScoreBg(theme.accuracy)}`}
              onClick={(e) => {
                // Solo actuar si no se hizo clic en los botones
                if (!e.target.closest('.action-buttons')) {
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
                    <div className="text-sm text-gray-600">
                      {theme.correct}/{theme.total} preguntas • {theme.avgTime}s promedio
                    </div>
                    <div className="text-xs text-gray-500">
                      {theme.articlesCount} artículos analizados
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
                  
                  {/* Botón de acción */}
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

  // Renderizar el modal al nivel más alto, fuera de toda la lógica condicional
  return (
    <>
      {mainContent}
      
      {/* Modal de artículo - SIEMPRE renderizado */}
      <ArticleModal 
        isOpen={modalState.isOpen}
        onClose={closeArticleModal}
        lawSlug={modalState.lawSlug}
        articleNumber={modalState.articleNumber}
      />
    </>
  )
}
