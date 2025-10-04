// components/FeedbackModal.js - Modal profesional para feedback
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const FEEDBACK_TYPES = [
  { id: 'suggestion', label: '💡 Sugerencia de Mejora', description: 'Ideas para mejorar la app' },
  { id: 'bug', label: '🐛 Error', description: 'Algo no funciona correctamente' },
  { id: 'question_dispute', label: '⚖️ Impugnación de Pregunta', description: 'Reportar error en pregunta específica' },
  { id: 'other', label: '❓ Otro', description: 'Cualquier otro tipo de feedback' }
]

export default function FeedbackModal({ isOpen, onClose, questionId = null, autoSelectQuestionDispute = false, currentTheme = null, onOpenQuestionDispute = null }) {
  const { user, supabase } = useAuth()
  const [formData, setFormData] = useState({
    type: '',
    message: '',
    email: '',
    wantsResponse: false
  })
  const [detectedContext, setDetectedContext] = useState({
    questionId: null,
    themeNumber: null,
    themeName: null,
    url: null
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Pre-rellenar email si usuario está logueado
  useEffect(() => {
    if (user?.email) {
      setFormData(prev => ({ ...prev, email: user.email }))
    }
  }, [user])

  // Detectar contexto automáticamente al abrir modal
  useEffect(() => {
    if (isOpen) {
      const context = {
        questionId: questionId,
        url: window.location.href
      }

      // MEJORAR: Detectar question_id automáticamente si no se pasó como prop
      if (!questionId) {
        // Opción 1: Buscar en URL (pregunta específica)
        const urlPath = window.location.pathname
        const questionUrlMatch = urlPath.match(/pregunta\/([a-f0-9-]{36})/i)
        if (questionUrlMatch) {
          context.questionId = questionUrlMatch[1]
        }
        
        // Opción 2: Buscar en el DOM elementos con data-question-id
        if (!context.questionId) {
          const questionElement = document.querySelector('[data-question-id]')
          if (questionElement) {
            context.questionId = questionElement.getAttribute('data-question-id')
          }
        }

        // Opción 3: Buscar en localStorage si hay pregunta actual
        if (!context.questionId) {
          try {
            const currentQuestion = localStorage.getItem('currentQuestionId')
            if (currentQuestion) {
              context.questionId = currentQuestion
            }
          } catch (e) {
            // Ignorar errores de localStorage
          }
        }
      }

      // Detectar tema desde URL o parámetro
      if (currentTheme) {
        context.themeNumber = currentTheme.number
        context.themeName = currentTheme.name
      } else {
        // Detectar desde URL patterns
        const urlPath = window.location.pathname
        const themeMatch = urlPath.match(/tema-(\d+)/i) || urlPath.match(/tema\/(\d+)/i)
        if (themeMatch) {
          context.themeNumber = parseInt(themeMatch[1])
          context.themeName = `Tema ${context.themeNumber}`
        }
      }

      setDetectedContext(context)
      console.log('🔍 [FEEDBACK] Contexto detectado (mejorado):', context)
    }
  }, [isOpen, questionId, currentTheme])

  // Resetear formulario al abrir
  useEffect(() => {
    if (isOpen && !success) {
      setFormData(prev => ({
        type: '',
        message: '',
        email: user?.email || '',
        wantsResponse: false
      }))
      setError('')
    }
  }, [isOpen, success, user, autoSelectQuestionDispute])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.message.trim()) {
      setError('Por favor, escribe tu mensaje')
      return
    }

    // Si no hay tipo seleccionado, usar 'other' por defecto
    const feedbackType = formData.type || 'other'

    setLoading(true)
    setError('')

    try {
      // Capturar información del contexto completo
      const feedbackData = {
        user_id: user?.id || null,
        email: formData.email || null,
        type: feedbackType,
        message: formData.message.trim(),
        url: detectedContext.url,
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        referrer: document.referrer || null,
        wants_response: false,
        status: 'pending',
        priority: 'medium'
      }

      // Solo agregar question_id para impugnaciones/disputas de preguntas
      if (detectedContext.questionId && feedbackType === 'disputa') {
        feedbackData.question_id = detectedContext.questionId
        feedbackData.dispute_type = 'error_question' // o el tipo específico
      }

      // Solo agregar theme_context si hay información de tema Y la columna existe
      // TODO: Descomentar cuando se añada columna theme_context a user_feedback
      /*
      if (detectedContext.themeNumber) {
        feedbackData.theme_context = {
          theme_number: detectedContext.themeNumber,
          theme_name: detectedContext.themeName
        }
      }
      */

      const { data: feedbackResult, error: submitError } = await supabase
        .from('user_feedback')
        .insert(feedbackData)
        .select()

      if (submitError) throw submitError

      // Enviar email de notificación al admin
      if (feedbackResult && feedbackResult[0]) {
        try {
          const { sendAdminFeedbackNotification } = await import('../lib/notifications/adminEmailNotifications')
          await sendAdminFeedbackNotification({
            id: feedbackResult[0].id,
            user_id: user?.id || null,
            user_email: formData.email || 'Usuario anónimo',
            user_name: user?.user_metadata?.full_name || 'Sin nombre',
            feedback_type: feedbackType,
            message: formData.message,
            rating: null,
            created_at: feedbackResult[0].created_at
          })
        } catch (emailError) {
          console.error('Error enviando email admin:', emailError)
          // No fallar el feedback por esto
        }
      }

      // Crear conversación de chat automáticamente
      if (feedbackResult && feedbackResult[0]) {
        const { error: conversationError } = await supabase
          .from('feedback_conversations')
          .insert({
            feedback_id: feedbackResult[0].id,
            user_id: user?.id || null,
            status: 'waiting_admin'
          })

        if (conversationError) {
          console.error('Error creando conversación:', conversationError)
          // No fallar el feedback por esto
        }
      }

      setSuccess(true)
      
      // Auto-cerrar después de 2 segundos
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 2000)

    } catch (err) {
      console.error('Error enviando feedback:', err)
      setError('Error enviando feedback. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
      setSuccess(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-1 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-2xl w-full max-w-md max-h-[98vh] sm:max-h-[90vh] overflow-y-auto">
        
        {success ? (
          // 🎉 ESTADO DE ÉXITO
          <div className="p-4 sm:p-6 text-center">
            <div className="text-4xl sm:text-5xl mb-3">✅</div>
            <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
              ¡Feedback Enviado!
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Gracias por ayudarnos a mejorar
            </p>
          </div>
        ) : (
          // 📝 FORMULARIO
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b dark:border-gray-700">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200">
                  💬 Enviar Feedback
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Ayúdanos a mejorar
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={loading}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              
              {/* Selección inicial de tipo - Solo si no hay tipo seleccionado */}
              {!formData.type && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                    🎯 ¿Qué tipo de feedback?
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    {FEEDBACK_TYPES.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          if (type.id === 'question_dispute') {
                            // ROUTER: Redirigir al sistema real de impugnaciones
                            console.log('🔄 [FEEDBACK] Redirigiendo a impugnaciones...')
                            onClose() // Cerrar feedback modal
                            if (onOpenQuestionDispute) {
                              console.log('✅ [FEEDBACK] Llamando onOpenQuestionDispute()')
                              onOpenQuestionDispute() // Abrir QuestionDispute real
                            } else {
                              console.error('❌ [FEEDBACK] onOpenQuestionDispute no está definido')
                            }
                          } else {
                            setFormData(prev => ({ ...prev, type: type.id }))
                          }
                        }}
                        className="p-2 sm:p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-center group"
                      >
                        <div className="text-base sm:text-lg mb-1">{type.label.split(' ')[0]}</div>
                        <div className="font-medium text-xs sm:text-sm text-gray-800 dark:text-gray-200 mb-0.5">
                          {type.label.substring(type.label.indexOf(' ') + 1)}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight hidden sm:block">
                          {type.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmación del tipo seleccionado - Solo si hay tipo */}
              {formData.type && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{FEEDBACK_TYPES.find(t => t.id === formData.type)?.label.split(' ')[0]}</span>
                      <span className="font-medium text-blue-800 dark:text-blue-200">
                        {FEEDBACK_TYPES.find(t => t.id === formData.type)?.label.substring(FEEDBACK_TYPES.find(t => t.id === formData.type)?.label.indexOf(' ') + 1)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: '' }))}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
                    >
                      ✕ Cambiar
                    </button>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    {FEEDBACK_TYPES.find(t => t.id === formData.type)?.description}
                  </p>
                </div>
              )}


              {/* Mensaje */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  📝 Descripción *
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Describe tu feedback..."
                  rows={2}
                  className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  📧 Email {!user && '(opcional)'}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="tu@email.com"
                  disabled={!!user}
                  className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                />
              </div>


              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-600 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.message.trim()}
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                      <span className="text-xs">Enviando...</span>
                    </span>
                  ) : (
                    <span className="text-xs">📤 Enviar</span>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}