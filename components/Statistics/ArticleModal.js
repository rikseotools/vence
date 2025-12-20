// components/Statistics/ArticleModal.js
'use client'
import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

export default function ArticleModal({ isOpen, onClose, lawSlug, articleNumber }) {
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && lawSlug && articleNumber) {
      loadArticleContent()
    }
  }, [isOpen, lawSlug, articleNumber])

  const loadArticleContent = async () => {
    setLoading(true)
    setError(null)
    setArticle(null)

    try {
      const response = await fetch(`/api/teoria/${lawSlug}/articulo-${articleNumber}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar el artículo')
      }

      const data = await response.json()
      setArticle(data)
    } catch (err) {
      console.error('Error cargando artículo:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setArticle(null)
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {loading ? 'Cargando artículo...' : 
                 article ? `Artículo ${article.article_number}` : 
                 `Artículo ${articleNumber}`}
              </h2>
              {article && (
                <p className="text-sm text-gray-600">
                  {article.law?.short_name || article.law?.name}
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Cerrar"
            >
              <XMarkIcon className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] px-6 py-4">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Cargando artículo...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-red-600">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error al cargar</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {article && !loading && (
              <div>
                {/* Título del artículo */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {article.title}
                  </h3>
                  <div className="text-sm text-gray-500">
                    <span>{article.law?.short_name || article.law?.name}</span>
                    <span className="mx-2">•</span>
                    <span>Artículo {article.article_number}</span>
                  </div>
                </div>

                {/* Contenido del artículo */}
                <div className="prose prose-lg max-w-none">
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

                {/* Footer info */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      📖 {article.law?.short_name} - Artículo {article.article_number}
                    </span>
                    <button
                      onClick={handleClose}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Cerrar y volver a estadísticas
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}