// components/ArticleModal.js - Modal para mostrar contenido de artículos
'use client'
import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../contexts/AuthContext'

export default function ArticleModal({
  isOpen,
  onClose,
  articleNumber,
  lawSlug,
  // 🎨 Parámetros opcionales para resaltado inteligente
  questionText = null,
  correctAnswer = null,
  options = null
}) {
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
        
        const apiUrl = `/api/teoria/${lawSlug}/${articleNumber}?${params}`
        console.log('🌐 API Call:', apiUrl)
        
        const response = await fetch(apiUrl)
        
        if (!response.ok) {
          // Capturar más detalles del error
          let errorDetails = `${response.status} ${response.statusText}`
          try {
            const errorBody = await response.text()
            if (errorBody) {
              errorDetails += ` - ${errorBody}`
            }
          } catch (e) {
            // Si no se puede leer el cuerpo, ignorar
          }
          
          throw new Error(`API Error: ${errorDetails} | URL: ${apiUrl}`)
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

  // 🎨 FUNCIÓN: Extraer palabras clave de la pregunta y respuesta correcta
  const extractKeywords = (question, correctAnswerIndex, opts) => {
    const keywords = new Set()

    // Extraer palabras clave de la pregunta (filtrar palabras comunes)
    const questionWords = question
      ?.toLowerCase()
      .replace(/[¿?¡!,.:;]/g, ' ')
      .split(/\s+/)
      .filter(word =>
        word.length > 3 &&
        !['tienen', 'como', 'para', 'sobre', 'entre', 'según', 'donde', 'cuando', 'cual', 'esta', 'este', 'estos', 'estas', 'pero', 'sino', 'aunque'].includes(word)
      ) || []

    questionWords.forEach(word => keywords.add(word))

    // Extraer palabras clave de la respuesta correcta
    const correctAnswerText = opts?.[correctAnswerIndex]
    if (correctAnswerText) {
      const answerWords = correctAnswerText
        .toLowerCase()
        .replace(/[,.:;]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)

      answerWords.forEach(word => keywords.add(word))
    }

    return Array.from(keywords).filter(word => word.length > 2)
  }

  // 🎨 FUNCIÓN: Formatear contenido con resaltado inteligente
  const formatTextContent = (content, question, correctAnswerIndex, opts) => {
    if (!content) return content

    let formattedContent = content
      // Convertir saltos de línea a <br>
      .replace(/\n/g, '<br>')
      // Convertir números de punto (1., 2., etc.) en párrafos numerados
      .replace(/(\d+\.\s)/g, '<br><strong>$1</strong>')
      // Convertir letras de punto (a), b), etc.) en sub-párrafos
      .replace(/([a-z]\)\s)/g, '<br>&nbsp;&nbsp;<strong>$1</strong>')
      // Agregar espaciado después de puntos finales seguidos de mayúscula
      .replace(/\.\s+(?=[A-Z])/g, '.<br><br>')
      // Limpiar múltiples <br> consecutivos
      .replace(/(<br>\s*){3,}/g, '<br><br>')
      // Limpiar <br> al inicio
      .replace(/^(<br>\s*)+/, '')

    // Resaltar específicamente partes clave según el tipo de pregunta

    // Para preguntas sobre alto cargo
    if (question?.toLowerCase().includes('alto cargo') || question?.toLowerCase().includes('condición')) {
      const specificHighlights = [
        {
          pattern: /(Los órganos superiores y directivos tienen además la condición de alto cargo, excepto los Subdirectores generales y asimilados[^.]*\.)/gi,
          replacement: '<mark style="background-color: #fef3c7; padding: 3px 6px; border-radius: 4px; font-weight: bold; color: #92400e; border-left: 4px solid #f59e0b;">🎯 $1</mark>'
        },
        {
          pattern: /(excepto los Subdirectores generales y asimilados)/gi,
          replacement: '<mark style="background-color: #fee2e2; padding: 2px 4px; border-radius: 3px; font-weight: bold; color: #dc2626;">⚠️ $1</mark>'
        }
      ]

      specificHighlights.forEach(({ pattern, replacement }) => {
        formattedContent = formattedContent.replace(pattern, replacement)
      })
    }

    // Para preguntas sobre organización/estructura
    if (question?.toLowerCase().includes('órganos') || question?.toLowerCase().includes('organización')) {
      const organizationHighlights = [
        {
          pattern: /(Órganos superiores:[^b]*)/gi,
          replacement: '<mark style="background-color: #ddd6fe; padding: 2px 4px; border-radius: 3px; color: #5b21b6;">$1</mark>'
        },
        {
          pattern: /(Órganos directivos:[^\.]*\.)/gi,
          replacement: '<mark style="background-color: #dcfce7; padding: 2px 4px; border-radius: 3px; color: #166534;">$1</mark>'
        }
      ]

      organizationHighlights.forEach(({ pattern, replacement }) => {
        formattedContent = formattedContent.replace(pattern, replacement)
      })
    }

    // Resaltar términos específicos de la pregunta de forma más sutil
    const keywords = extractKeywords(question, correctAnswerIndex, opts)
    keywords.forEach(keyword => {
      if (keyword.length > 4 && !formattedContent.includes(`<mark`) && !formattedContent.includes(`style="background-color: #fef3c7`)) {
        const regex = new RegExp(`\\b(${keyword})\\b`, 'gi')
        formattedContent = formattedContent.replace(regex, (match) => {
          return `<span style="background-color: #e0f2fe; padding: 1px 2px; border-radius: 2px; color: #0277bd;">${match}</span>`
        })
      }
    })

    // Resaltar referencias a leyes y normativas
    formattedContent = formattedContent
      .replace(/(Ley\s+\d+\/\d+)/gi, '<strong style="color: #2563eb; background-color: #eff6ff; padding: 1px 3px; border-radius: 2px;">📋 $1</strong>')
      .replace(/(Real Decreto\s+\d+\/\d+)/gi, '<strong style="color: #16a34a; background-color: #f0fdf4; padding: 1px 3px; border-radius: 2px;">📜 $1</strong>')
      .replace(/(artículo\s+\d+)/gi, '<strong style="color: #9333ea; background-color: #faf5ff; padding: 1px 3px; border-radius: 2px;">📄 $1</strong>')

    return formattedContent
  }

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
              <div className="text-center py-12 px-6">
                <div className="text-red-600 text-6xl mb-4">❌</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Error cargando el artículo
                </h3>
                
                {/* Información específica del error - MUY DETALLADA */}
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4 text-left">
                  <div className="text-sm space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="font-semibold text-red-800 dark:text-red-300">📄 Artículo:</span>
                        <span className="ml-2 text-red-700 dark:text-red-400">Art. {articleNumber}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-red-800 dark:text-red-300">⚖️ Ley slug:</span>
                        <span className="ml-2 text-red-700 dark:text-red-400 font-mono text-xs">{lawSlug}</span>
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-semibold text-red-800 dark:text-red-300">🌐 Página actual:</span>
                      <span className="ml-2 text-red-700 dark:text-red-400 break-all text-xs">{window.location.href}</span>
                    </div>
                    
                    <div>
                      <span className="font-semibold text-red-800 dark:text-red-300">🔗 API que falló:</span>
                      <span className="ml-2 text-red-700 dark:text-red-400 break-all text-xs font-mono">
                        /api/teoria/{lawSlug}/{articleNumber}?includeOfficialExams=true{userOposicion ? `&userOposicion=${userOposicion}` : ''}
                      </span>
                    </div>
                    
                    <div>
                      <span className="font-semibold text-red-800 dark:text-red-300">❌ Error técnico:</span>
                      <span className="ml-2 text-red-700 dark:text-red-400">{error}</span>
                    </div>
                    
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded">
                      <div className="font-semibold text-blue-800 dark:text-blue-300 mb-2">📋 Para reproducir el error:</div>
                      <ol className="text-blue-700 dark:text-blue-400 text-xs space-y-1 list-decimal list-inside">
                        <li>Ir a: <span className="font-mono break-all">{window.location.href}</span></li>
                        <li>Buscar pregunta que mencione "Artículo {articleNumber}"</li>
                        <li>Hacer clic en enlace "Ver artículo"</li>
                        <li>Modal se abre pero falla con error: <span className="font-mono">{error.split('|')[0]}</span></li>
                      </ol>
                    </div>
                    
                    {lawSlug.includes('/') && (
                      <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded">
                        <span className="font-semibold text-yellow-800 dark:text-yellow-300">⚠️ Problema detectado:</span>
                        <span className="ml-2 text-yellow-700 dark:text-yellow-400 text-xs">
                          El slug contiene "/" - esto puede causar errores 404. Verificar openArticleModal() en tema/[numero]/page.js línea 723
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Botón de acción - Solo notificar error */}
                <div className="flex justify-center">
                  <button
                    onClick={async () => {
                      try {
                        // Crear mensaje de feedback automático MUY DETALLADO
                        const currentUrl = window.location.href
                        const apiUrl = `/api/teoria/${lawSlug}/${articleNumber}?${new URLSearchParams({
                          includeOfficialExams: 'true',
                          ...(userOposicion ? { userOposicion } : {})
                        })}`
                        
                        const feedbackMessage = `🚨 ERROR CARGA ARTÍCULO - REPORTE TÉCNICO DETALLADO

📋 **DATOS DEL ERROR:**
• **Artículo:** ${articleNumber}
• **Ley (original):** ${lawSlug}
• **Error técnico:** ${error}

🌐 **URLs Y NAVEGACIÓN:**
• **Página actual:** ${currentUrl}
• **API que falló:** ${apiUrl}
• **Referrer:** ${document.referrer || 'Ninguno'}

🔍 **CONTEXTO Y FLUJO DE REPRODUCCIÓN:**
• **Página origen:** ${currentUrl.includes('/tema/') ? 'Página de Tema' : 'Otra página'}
• **Tema número:** ${currentUrl.match(/tema\/(\d+)/)?.[1] || 'No detectado'}
• **Acción exacta:** Usuario hizo clic en "Ver artículo" desde una pregunta o enlace
• **Modal:** ArticleModal.js activado con props articleNumber=${articleNumber}, lawSlug=${lawSlug}
• **User ID:** ${user?.id || 'No autenticado'}
• **Email:** ${user?.email || 'No disponible'}
• **Oposición:** ${userOposicion || 'No establecida'}

📋 **PASOS PARA REPRODUCIR:**
1. Ir a: ${currentUrl}
2. Buscar pregunta de "Artículo ${articleNumber}" de "${lawSlug}"
3. Hacer clic en enlace "Ver artículo" 
4. Modal se abre pero falla al cargar contenido
5. Error aparece: ${error.substring(0, 100)}...

🎯 **COMPONENTES INVOLUCRADOS:**
• **Origen:** /app/auxiliar-administrativo-estado/test/tema/[numero]/page.js función openArticleModal()
• **Modal:** /components/ArticleModal.js useEffect loadArticleData()
• **API:** /app/api/teoria/[law]/[articleNumber]/route.js
• **Fetchers:** /lib/teoriaFetchers.js fetchArticleContent()

⚙️ **INFORMACIÓN DEL NAVEGADOR:**
• **User Agent:** ${navigator.userAgent}
• **Viewport:** ${window.innerWidth}x${window.innerHeight}
• **Fecha/hora:** ${new Date().toISOString()}
• **Timezone:** ${Intl.DateTimeFormat().resolvedOptions().timeZone}

🐛 **DEBUGGING INFO:**
• **Law Slug generado:** "${lawSlug}"
• **Contiene '/':** ${lawSlug.includes('/') ? 'SÍ (PROBLEMA POTENCIAL)' : 'No'}
• **Params API:** includeOfficialExams=true${userOposicion ? `, userOposicion=${userOposicion}` : ''}

**DESCRIPCIÓN:**
Error al cargar artículo desde modal. Verificar si el slug de la ley es correcto y si la API responde adecuadamente.`

                        // Enviar feedback automáticamente usando el sistema existente
                        const { data: feedbackResult, error: submitError } = await supabase
                          .from('user_feedback')
                          .insert({
                            user_id: user?.id || null,
                            email: user?.email || null,
                            type: 'bug',
                            message: feedbackMessage,
                            url: window.location.href,
                            user_agent: navigator.userAgent,
                            viewport: `${window.innerWidth}x${window.innerHeight}`,
                            referrer: document.referrer || null,
                            wants_response: false,
                            status: 'pending',
                            priority: 'high' // Alta prioridad para errores de carga
                          })
                          .select()

                        if (submitError) {
                          console.error('Error enviando feedback:', submitError)
                          alert('Error enviando el reporte. Por favor, inténtalo manualmente.')
                          return
                        }

                        // Crear conversación de chat automáticamente
                        if (feedbackResult && feedbackResult[0]) {
                          await supabase
                            .from('feedback_conversations')
                            .insert({
                              feedback_id: feedbackResult[0].id,
                              user_id: user?.id || null,
                              status: 'waiting_admin'
                            })
                        }

                        // Mostrar confirmación
                        alert('✅ Error reportado automáticamente. Nos pondremos en contacto contigo pronto.')
                        onClose()
                      } catch (err) {
                        console.error('Error reportando:', err)
                        alert('Error enviando el reporte. Por favor, contacta al soporte manualmente.')
                      }
                    }}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                  >
                    🚨 Notificar Error
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                  Al hacer clic en "Notificar Error" se enviará automáticamente un reporte con toda la información técnica necesaria.
                </p>
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

                  {/* 🎨 Contenido con resaltado inteligente si se proporcionan datos de pregunta */}
                  {questionText && correctAnswer !== null && options ? (
                    <div
                      className="text-gray-800 dark:text-gray-200 leading-loose text-base"
                      dangerouslySetInnerHTML={{
                        __html: formatTextContent(
                          articleData.cleanContent || articleData.content,
                          questionText,
                          correctAnswer,
                          options
                        )
                      }}
                    />
                  ) : (
                    <div className="text-gray-800 dark:text-gray-200 leading-relaxed text-base space-y-3">
                      {(articleData.cleanContent || articleData.content)?.split('\n').map((paragraph, index) => (
                        paragraph.trim() && (
                          <p key={index} className="text-justify">
                            {paragraph.trim()}
                          </p>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

        </div>
      </div>
    </div>
  )
}