// components/FeedbackModal.js - Modal profesional para solicitudes de soporte
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const FEEDBACK_TYPES = [
  { id: 'suggestion', label: '💡 Sugerencia de Mejora', description: 'Ideas para mejorar la app' },
  { id: 'bug', label: '🐛 Error', description: 'Algo no funciona correctamente' },
  { id: 'question_dispute', label: '⚖️ Impugnación de Pregunta', description: 'Reportar error en pregunta específica' },
  { id: 'other', label: '❓ Otro', description: 'Cualquier otro tipo de solicitud' }
]

// Emoticonos populares para el chat
const EMOJIS = [
  '😀', '😂', '😊', '😍', '🤔', '😅', '😢', '😡', '😴', '🤗',
  '👍', '👎', '👏', '🙏', '💪', '👌', '✌️', '🤞', '🤝', '💯',
  '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '❓', '❗',
  '🎉', '🎊', '🔥', '💰', '📚', '✅', '❌', '⭐', '💡', '🚀'
]

export default function FeedbackModal({ isOpen, onClose, questionId = null, autoSelectQuestionDispute = false, currentTheme = null, onOpenQuestionDispute = null, onFeedbackSent = null }) {
  const { user, supabase } = useAuth()
  const [formData, setFormData] = useState({
    type: '',
    message: '',
    email: '',
    wantsResponse: false
  })
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [uploadedImages, setUploadedImages] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
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
      setUploadedImages([])
      setShowEmojiPicker(false)
      setError('')
    }
  }, [isOpen, success, user, autoSelectQuestionDispute])

  // Función para insertar emoji en el mensaje
  const insertEmoji = (emoji) => {
    const currentMessage = formData.message
    const cursorPosition = document.querySelector('textarea')?.selectionStart || currentMessage.length
    const newMessage = currentMessage.slice(0, cursorPosition) + emoji + currentMessage.slice(cursorPosition)
    setFormData(prev => ({ ...prev, message: newMessage }))
    setShowEmojiPicker(false)
    
    // Mantener focus en el textarea
    setTimeout(() => {
      const textarea = document.querySelector('textarea')
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(cursorPosition + emoji.length, cursorPosition + emoji.length)
      }
    }, 10)
  }

  // Función para subir imagen
  const handleImageUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen')
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede ser mayor a 5MB')
      return
    }

    setUploadingImage(true)
    setError('')

    try {
      // Crear nombre único para el archivo
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `feedback-images/${fileName}`

      // Subir a Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('support')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('support')
        .getPublicUrl(filePath)

      // Añadir imagen a la lista
      setUploadedImages(prev => [...prev, {
        id: Date.now(),
        url: publicUrl,
        name: file.name,
        path: filePath
      }])

    } catch (error) {
      console.error('Error subiendo imagen:', error)
      setError('Error al subir la imagen. Inténtalo de nuevo.')
    } finally {
      setUploadingImage(false)
      // Limpiar input
      event.target.value = ''
    }
  }

  // Función para eliminar imagen subida
  const removeImage = async (imageId, imagePath) => {
    try {
      // Eliminar de Supabase Storage
      await supabase.storage
        .from('support')
        .remove([imagePath])

      // Eliminar de la lista local
      setUploadedImages(prev => prev.filter(img => img.id !== imageId))
    } catch (error) {
      console.error('Error eliminando imagen:', error)
    }
  }

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
      console.log('📝 Iniciando envío de feedback...', { user: user?.id, type: feedbackType })
      
      // Preparar mensaje con imágenes
      let messageWithImages = formData.message.trim()
      if (uploadedImages.length > 0) {
        messageWithImages += '\n\n📸 Imágenes adjuntas:\n'
        uploadedImages.forEach((img, index) => {
          messageWithImages += `${index + 1}. ${img.name}: ${img.url}\n`
        })
      }

      // Capturar información del contexto completo
      const feedbackData = {
        user_id: user?.id || null,
        email: formData.email || null,
        type: feedbackType,
        message: messageWithImages,
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

      console.log('💾 Insertando feedback en BD...', {
        user_id: feedbackData.user_id,
        email: feedbackData.email,
        type: feedbackData.type,
        message_length: feedbackData.message?.length,
        url: feedbackData.url,
        has_attachments: !!feedbackData.attachments
      })
      
      const { data: feedbackResult, error: submitError } = await supabase
        .from('user_feedback')
        .insert(feedbackData)
        .select()

      if (submitError) {
        console.error('❌ Error insertando feedback:', {
          message: submitError.message,
          code: submitError.code,
          details: submitError.details,
          hint: submitError.hint
        })
        throw submitError
      }
      
      console.log('✅ Feedback insertado correctamente:', feedbackResult?.[0]?.id)

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
      
      // Notificar al componente padre que se envió feedback
      if (onFeedbackSent) {
        onFeedbackSent()
      }
      
      // Auto-cerrar después de 2 segundos
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 2000)

    } catch (err) {
      console.error('Error enviando feedback:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        error: err
      })
      setError(`Error enviando feedback: ${err?.message || 'Error desconocido'}. Inténtalo de nuevo.`)
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
              ¡Solicitud Enviada!
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Nos pondremos en contacto contigo pronto
            </p>
          </div>
        ) : (
          // 📝 FORMULARIO
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b dark:border-gray-700">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200">
                  🎧 Solicitud de Soporte
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Estamos aquí para ayudarte
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
                    🎯 ¿Qué tipo de solicitud?
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
                <div className="relative">
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Describe tu solicitud... (Usa Enter para saltos de línea)"
                    rows={4}
                    className="w-full p-3 pr-12 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-y"
                    style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}
                    required
                  />
                  
                  {/* Botones de acción */}
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    {/* Botón de Subir Imagen */}
                    <label className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer" title="Subir imagen">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                      {uploadingImage ? (
                        <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </label>
                    
                    {/* Botón de Emojis */}
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                      title="Añadir emoji"
                    >
                      😊
                    </button>
                  </div>
                  
                  {/* Selector de Emojis */}
                  {showEmojiPicker && (
                    <div className="absolute bottom-12 right-0 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 z-50 w-64 max-h-40 overflow-y-auto">
                      <div className="grid grid-cols-8 gap-1">
                        {EMOJIS.map((emoji, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="p-1 text-lg hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                            title={`Insertar ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Vista previa de imágenes subidas */}
                {uploadedImages.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                      📸 Imágenes adjuntas ({uploadedImages.length})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {uploadedImages.map((image) => (
                        <div key={image.id} className="relative group">
                          <img
                            src={image.url}
                            alt={image.name}
                            className="w-20 h-20 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(image.id, image.path)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title={`Eliminar ${image.name}`}
                          >
                            ×
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {image.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                    <span className="text-xs">📤 Enviar Solicitud</span>
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