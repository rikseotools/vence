// components/ArticleModal.js - Modal para mostrar contenido de artículos
'use client'
import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../contexts/AuthContext'

export default function ArticleModal({ isOpen, onClose, articleNumber, lawSlug }) {
  const { user, supabase } = useAuth()
  const [articleData, setArticleData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userOposicion, setUserOposicion] = useState(null)

  // Cargar oposición del usuario
  useEffect(() => {
    async function loadUserOposicion() {
      if (!user || !supabase) return
      
      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('target_oposicion')
          .eq('id', user.id)
          .single()
        
        if (!error && profile?.target_oposicion) {
          setUserOposicion(profile.target_oposicion)
        }
      } catch (err) {
        console.error('Error cargando oposición del usuario:', err)
      }
    }
    
    loadUserOposicion()
  }, [user, supabase])

  // Cargar datos del artículo desde la base de datos
  useEffect(() => {
    async function loadArticleData() {
      console.log('🔍 Modal useEffect:', { isOpen, articleNumber, lawSlug })
      if (!isOpen || !articleNumber || !lawSlug) {
        console.log('❌ Modal: Condiciones no cumplidas')
        return
      }
      
      try {
        setLoading(true)
        setError(null)
        
        // Buscar el artículo usando el endpoint existente con datos de examen oficial
        const params = new URLSearchParams({
          includeOfficialExams: 'true'
        })
        
        if (userOposicion) {
          params.append('userOposicion', userOposicion)
        }
        
        const response = await fetch(`/api/teoria/${lawSlug}/${articleNumber}?${params}`)
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: No se pudo cargar el artículo`)
        }
        
        const articleData = await response.json()
        setArticleData(articleData)
        
      } catch (err) {
        console.error('Error cargando artículo:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadArticleData()
  }, [isOpen, articleNumber, lawSlug, userOposicion])

  // Cerrar modal al presionar Escape
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden' // Prevenir scroll del body
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    console.log('🚫 Modal cerrado, no renderizar')
    return null
  }

  console.log('✅ Modal abierto, renderizando...', { articleNumber, lawSlug })

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto" style={{ zIndex: 9999 }}>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <span className="flex-shrink-0 text-sm font-bold text-white bg-red-500 px-3 py-1 rounded">
                Art. {articleNumber}
              </span>
              
              {/* Badges de examen oficial */}
              {articleData?.officialExamData?.hasOfficialExams && (
                <div className="flex items-center space-x-2">
                  <span className="flex-shrink-0 text-xs font-bold text-white bg-blue-600 px-2 py-1 rounded">
                    🏛️ OFICIAL
                  </span>
                  <span className="flex-shrink-0 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
                    {articleData.officialExamData.totalOfficialQuestions} pregunta{articleData.officialExamData.totalOfficialQuestions !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                  {articleData?.title || `Artículo ${articleNumber}`}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {articleData?.law?.name || articleData?.law_name || articleData?.lawName || 'Cargando...'}
                </p>
                
                {/* Información adicional de examen oficial */}
                {articleData?.officialExamData?.hasOfficialExams && (
                  <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    Último examen: {articleData.officialExamData.latestExamDate ? 
                      new Date(articleData.officialExamData.latestExamDate).getFullYear() : 'N/A'}
                    {articleData.officialExamData.examEntities?.length > 0 && (
                      <span> • {articleData.officialExamData.examEntities.join(', ')}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Cerrar modal"
            >
              <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-gray-600 dark:text-gray-400">Cargando artículo...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="text-red-600 text-lg mb-3">❌</div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Error cargando el artículo
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            ) : articleData ? (
              <div className="max-w-none">
                {/* Alerta de artículo problemático */}
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-red-600 dark:text-red-400">⚠️</span>
                    <span className="font-medium text-red-800 dark:text-red-300">Artículo problemático</span>
                  </div>
                  <p className="text-red-700 dark:text-red-400 text-sm">
                    Este artículo ha mostrado dificultades en tus respuestas recientes. Te recomendamos estudiarlo cuidadosamente.
                  </p>
                </div>

                {/* Alerta de examen oficial */}
                {articleData?.officialExamData?.hasOfficialExams && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-blue-600 dark:text-blue-400">🏛️</span>
                      <span className="font-medium text-blue-800 dark:text-blue-300">Artículo de examen oficial</span>
                    </div>
                    <p className="text-blue-700 dark:text-blue-400 text-sm mb-3">
                      Este artículo ha aparecido en {articleData.officialExamData.totalOfficialQuestions} pregunta{articleData.officialExamData.totalOfficialQuestions !== 1 ? 's' : ''} de examen oficial
                      {userOposicion && ` para ${userOposicion}`}.
                    </p>
                    
                    {/* Detalles adicionales */}
                    <div className="space-y-1 text-xs text-blue-600 dark:text-blue-400">
                      {articleData.officialExamData.latestExamDate && (
                        <div>• Último examen: {new Date(articleData.officialExamData.latestExamDate).getFullYear()}</div>
                      )}
                      {articleData.officialExamData.examSources?.length > 0 && (
                        <div>• Fuentes: {articleData.officialExamData.examSources.join(', ')}</div>
                      )}
                      {articleData.officialExamData.difficultyLevels?.length > 0 && (
                        <div>• Dificultad: {articleData.officialExamData.difficultyLevels.join(', ')}</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                    Artículo {articleData.article_number}
                  </h3>
                  
                  <div className="text-gray-800 dark:text-gray-200 leading-relaxed text-base space-y-3">
                    {(articleData.cleanContent || articleData.content)?.split('\n').map((paragraph, index) => (
                      paragraph.trim() && (
                        <p key={index} className="text-justify">
                          {paragraph.trim()}
                        </p>
                      )
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

        </div>
      </div>
    </div>
  )
}