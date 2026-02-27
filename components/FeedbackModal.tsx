// components/FeedbackModal.tsx - Modal para solicitudes de soporte
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

// ============================================
// TIPOS
// ============================================

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  questionId?: string | null
  currentTheme?: { number: number; name: string } | null
  onFeedbackSent?: (() => void) | null
}

interface FormData {
  type: string
  message: string
  email: string
  wantsResponse: boolean
  disputeType: string
}

interface DetectedContext {
  questionId: string | null
  themeNumber: number | null
  themeName: string | null
  url: string | null
}

interface UploadedImage {
  id: number
  url: string
  name: string
  path: string
}

// ============================================
// CONSTANTES
// ============================================

const FEEDBACK_TYPES = [
  { id: 'suggestion', label: '💡 Sugerencia de Mejora', description: 'Ideas para mejorar la app' },
  { id: 'bug', label: '🐛 Error', description: 'Algo no funciona correctamente' },
  { id: 'question_dispute', label: '⚖️ Impugnación', description: 'Reportar error en pregunta' },
  { id: 'other', label: '❓ Otro', description: 'Cualquier otro tipo de solicitud' }
]

const EMOJIS = [
  '😀', '😂', '😊', '😍', '🤔', '😅', '😢', '😡', '😴', '🤗',
  '👍', '👎', '👏', '🙏', '💪', '👌', '✌️', '🤞', '🤝', '💯',
  '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '❓', '❗',
  '🎉', '🎊', '🔥', '💰', '📚', '✅', '❌', '⭐', '💡', '🚀'
]

// ============================================
// COMPONENTE
// ============================================

export default function FeedbackModal({
  isOpen,
  onClose,
  questionId = null,
  currentTheme = null,
  onFeedbackSent = null,
}: FeedbackModalProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { user, supabase } = useAuth() as { user: any; supabase: any }
  const [formData, setFormData] = useState<FormData>({
    type: '',
    message: '',
    email: '',
    wantsResponse: false,
    disputeType: ''
  })
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [detectedContext, setDetectedContext] = useState<DetectedContext>({
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
      setFormData(prev => ({ ...prev, email: user.email! }))
    }
  }, [user])

  // Detectar contexto automáticamente al abrir modal
  useEffect(() => {
    if (isOpen) {
      const context: DetectedContext = {
        questionId: questionId ?? null,
        themeNumber: null,
        themeName: null,
        url: window.location.href
      }

      // Detectar question_id automáticamente si no se pasó como prop
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
          } catch {
            // Ignorar errores de localStorage
          }
        }
      }

      // Detectar tema desde URL o parámetro
      if (currentTheme) {
        context.themeNumber = currentTheme.number
        context.themeName = currentTheme.name
      } else {
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
      setFormData({
        type: '',
        message: '',
        email: user?.email || '',
        wantsResponse: false,
        disputeType: ''
      })
      setUploadedImages([])
      setShowEmojiPicker(false)
      setError('')
    }
  }, [isOpen, success, user])

  // Función para insertar emoji en el mensaje
  const insertEmoji = (emoji: string) => {
    const currentMessage = formData.message
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null
    const cursorPosition = textarea?.selectionStart ?? currentMessage.length
    const newMessage = currentMessage.slice(0, cursorPosition) + emoji + currentMessage.slice(cursorPosition)
    setFormData(prev => ({ ...prev, message: newMessage }))
    setShowEmojiPicker(false)

    // Mantener focus en el textarea
    setTimeout(() => {
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(cursorPosition + emoji.length, cursorPosition + emoji.length)
      }
    }, 10)
  }

  // Función para subir imagen
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log('📸 [USER] Iniciando subida de imagen:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`)

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      console.error('❌ [USER] Tipo de archivo no válido:', file.type)
      setError('Solo se permiten archivos de imagen (JPG, PNG, GIF, etc.)')
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.error('❌ [USER] Archivo demasiado grande:', file.size, 'bytes')
      setError('La imagen no puede ser mayor a 5MB')
      return
    }

    setUploadingImage(true)
    setError('')

    try {
      console.log('📤 [USER] Subiendo archivo vía API...')

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('userPath', 'user-feedback-images')

      const response = await fetch('/api/upload-feedback-image', {
        method: 'POST',
        body: uploadFormData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error desconocido en la subida')
      }

      console.log('✅ [USER] Respuesta exitosa de API:', result)

      setUploadedImages(prev => [...prev, {
        id: Date.now(),
        url: result.url,
        name: result.fileName,
        path: result.path
      }])

      console.log('✅ [USER] Imagen añadida a la lista correctamente')

      // Mostrar notificación de éxito
      const notification = document.createElement('div')
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        font-size: 14px;
        max-width: 300px;
      `
      notification.textContent = `✅ Imagen "${file.name}" subida correctamente`
      document.body.appendChild(notification)

      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 3000)

    } catch (err) {
      console.error('❌ [USER] Error completo subiendo imagen:', err)

      let userMessage = 'Error al subir la imagen.'
      if (err instanceof Error) {
        if (err.message?.includes('Bucket not found')) {
          userMessage = 'Error de configuración del almacenamiento. Contacta al administrador.'
        } else if (err.message?.includes('permissions') || err.message?.includes('policy')) {
          userMessage = 'Error de permisos al subir la imagen. Intenta iniciar sesión o contacta al soporte.'
        } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
          userMessage = 'Error de conexión. Verifica tu internet e inténtalo de nuevo.'
        } else {
          userMessage = `Error: ${err.message}`
        }
      }

      setError(userMessage)
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  // Función para eliminar imagen subida
  const removeImage = async (imageId: number, imagePath: string) => {
    try {
      console.log('🗑️ [USER] Eliminando imagen:', imagePath)

      const response = await fetch(`/api/upload-feedback-image?path=${encodeURIComponent(imagePath)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const result = await response.json()
        console.error('❌ [USER] Error eliminando de API:', result.error)
      } else {
        console.log('✅ [USER] Imagen eliminada del storage vía API')
      }

      setUploadedImages(prev => prev.filter(img => img.id !== imageId))
      console.log('✅ [USER] Imagen removida de la lista local')
    } catch (err) {
      console.error('❌ [USER] Error eliminando imagen:', err)
      setUploadedImages(prev => prev.filter(img => img.id !== imageId))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const feedbackType = formData.type || 'other'
    const detectedQuestionId = questionId || detectedContext.questionId

    // Validación específica para impugnaciones
    if (feedbackType === 'question_dispute') {
      if (!formData.disputeType) {
        setError('Por favor, selecciona un motivo de impugnación')
        return
      }
      if (formData.disputeType === 'otro' && !formData.message.trim()) {
        setError('Por favor, describe el problema')
        return
      }
      if (!user) {
        setError('Debes estar registrado para impugnar preguntas')
        return
      }
    } else {
      if (!formData.message.trim()) {
        setError('Por favor, escribe tu mensaje')
        return
      }
    }

    setLoading(true)
    setError('')

    try {
      // ===== MANEJO ESPECIAL PARA IMPUGNACIONES =====
      if (feedbackType === 'question_dispute' && detectedQuestionId) {
        console.log('⚖️ Enviando impugnación via API...', { questionId: detectedQuestionId, disputeType: formData.disputeType })

        const description = formData.disputeType === 'otro'
          ? formData.message.trim()
          : `Motivo: ${formData.disputeType}${formData.message.trim() ? ` - Detalles: ${formData.message.trim()}` : ''}`

        // Obtener token de sesión para autenticación
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setError('Error de autenticación. Intenta iniciar sesión de nuevo.')
          setLoading(false)
          return
        }

        const response = await fetch('/api/dispute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            questionId: detectedQuestionId,
            disputeType: formData.disputeType,
            description,
          }),
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          if (response.status === 409) {
            setError('Ya has impugnado esta pregunta anteriormente. Solo se permite una impugnación por pregunta.')
          } else {
            setError(result.error || 'Error al enviar la impugnación')
          }
          setLoading(false)
          return
        }

        // Enviar email de notificación al admin
        if (result.data) {
          try {
            const { sendAdminDisputeNotification } = await import('../lib/notifications/adminEmailNotifications')
            await sendAdminDisputeNotification({
              id: result.data.id,
              question_id: detectedQuestionId,
              user_id: user!.id,
              user_email: user!.email || 'Usuario anónimo',
              user_name: user!.user_metadata?.full_name || 'Sin nombre',
              dispute_type: formData.disputeType,
              description: description,
              created_at: result.data.createdAt
            })
          } catch (emailError) {
            console.error('Error enviando email admin:', emailError)
          }
        }

        // Éxito
        setSuccess(true)
        setFormData(prev => ({ ...prev, type: '', message: '', disputeType: '' }))
        if (onFeedbackSent) onFeedbackSent()
        setLoading(false)

        setTimeout(() => {
          setSuccess(false)
          onClose()
        }, 4000)
        return
      }

      // ===== MANEJO NORMAL DE FEEDBACK =====
      console.log('📝 Iniciando envío de feedback...', { user: user?.id, type: feedbackType })

      let messageWithImages = formData.message.trim()
      if (uploadedImages.length > 0) {
        messageWithImages += '\n\n📸 Imágenes adjuntas:\n'
        uploadedImages.forEach((img, index) => {
          messageWithImages += `${index + 1}. ${img.name}: ${img.url}\n`
        })
      }

      const feedbackData = {
        userId: user?.id || null,
        email: formData.email || null,
        type: feedbackType,
        message: messageWithImages,
        url: detectedContext.url,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        referrer: document.referrer || null,
        wantsResponse: false,
        status: 'pending',
        priority: 'medium',
        questionId: detectedContext.questionId || questionId || null
      }

      console.log('💾 Insertando feedback via API tipada...', {
        userId: feedbackData.userId,
        type: feedbackData.type,
        messageLength: feedbackData.message?.length,
        questionId: feedbackData.questionId
      })

      const apiResponse = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData)
      })

      const feedbackApiResult = await apiResponse.json()

      if (!apiResponse.ok || !feedbackApiResult.success) {
        console.error('❌ Error insertando feedback:', feedbackApiResult.error)
        throw new Error(feedbackApiResult.error || 'Error creando feedback')
      }

      const feedbackResult = feedbackApiResult.data
      console.log('✅ Feedback insertado correctamente:', feedbackResult?.id)

      // Enviar email de notificación al admin
      if (feedbackResult) {
        try {
          const { sendAdminFeedbackNotification } = await import('../lib/notifications/adminEmailNotifications')
          await sendAdminFeedbackNotification({
            id: feedbackResult.id,
            user_id: user?.id || null,
            user_email: formData.email || 'Usuario anónimo',
            user_name: user?.user_metadata?.full_name || 'Sin nombre',
            feedback_type: feedbackType,
            message: formData.message,
            rating: null,
            created_at: feedbackResult.createdAt
          })
        } catch (emailError) {
          console.error('Error enviando email admin:', emailError)
        }
      }

      setSuccess(true)

      if (onFeedbackSent) {
        onFeedbackSent()
      }

      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 2000)

    } catch (err) {
      console.error('Error enviando feedback:', err)
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(`Error enviando feedback: ${message}. Inténtalo de nuevo.`)
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

  const detectedQuestionId = questionId || detectedContext.questionId
  const isDispute = formData.type === 'question_dispute'
  const isDisputeWithoutQuestion = isDispute && !detectedQuestionId

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-1 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-2xl w-full max-w-md max-h-[98vh] sm:max-h-[90vh] overflow-hidden">

        {success ? (
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
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
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
            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[calc(98vh-80px)] sm:max-h-[calc(90vh-80px)]">
              {/* Selección de tipo */}
              {!formData.type && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                    🎯 ¿Qué tipo de solicitud?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {FEEDBACK_TYPES.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: type.id }))}
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

              {/* Confirmación del tipo seleccionado */}
              {formData.type && (
                <>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{FEEDBACK_TYPES.find(t => t.id === formData.type)?.label.split(' ')[0]}</span>
                        <span className="font-medium text-blue-800 dark:text-blue-200">
                          {FEEDBACK_TYPES.find(t => t.id === formData.type)?.label.substring(FEEDBACK_TYPES.find(t => t.id === formData.type)!.label.indexOf(' ') + 1)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: '', disputeType: '' }))}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
                      >
                        ✕ Cambiar
                      </button>
                    </div>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      {FEEDBACK_TYPES.find(t => t.id === formData.type)?.description}
                    </p>
                  </div>

                  {/* Advertencia para impugnación sin pregunta */}
                  {isDisputeWithoutQuestion && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-center">
                      <div className="text-3xl mb-2">⚠️</div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                        No se detectó ninguna pregunta
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        Para impugnar una pregunta, usa el botón "Impugnar pregunta" que aparece debajo de cada pregunta después de responderla.
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                        Si quieres reportar un problema general, selecciona otro tipo de solicitud.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Formulario: visible si hay tipo seleccionado y no es dispute sin pregunta */}
              {formData.type && !isDisputeWithoutQuestion && (
              <>
                {/* Formulario de impugnación con pregunta detectada */}
                {isDispute && detectedQuestionId && (
                  <>
                    {/* Confirmación de pregunta detectada */}
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg flex items-center gap-2">
                      <span className="text-xl">✅</span>
                      <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                          Pregunta detectada
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          ID: {detectedQuestionId.substring(0, 8)}...
                        </p>
                      </div>
                    </div>

                    {/* Motivo de impugnación */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        ⚖️ Motivo de la impugnación *
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                          <input
                            type="radio"
                            name="disputeType"
                            value="no_literal"
                            checked={formData.disputeType === 'no_literal'}
                            onChange={(e) => setFormData(prev => ({ ...prev, disputeType: e.target.value }))}
                            className="text-orange-600 focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            📝 Pregunta no literal (no se ajusta exactamente al artículo)
                          </span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                          <input
                            type="radio"
                            name="disputeType"
                            value="respuesta_incorrecta"
                            checked={formData.disputeType === 'respuesta_incorrecta'}
                            onChange={(e) => setFormData(prev => ({ ...prev, disputeType: e.target.value }))}
                            className="text-orange-600 focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            ❌ La respuesta marcada como correcta es errónea
                          </span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                          <input
                            type="radio"
                            name="disputeType"
                            value="otro"
                            checked={formData.disputeType === 'otro'}
                            onChange={(e) => setFormData(prev => ({ ...prev, disputeType: e.target.value }))}
                            className="text-orange-600 focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            💭 Otro motivo
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Descripción para impugnación */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        📝 {formData.disputeType === 'otro' ? 'Descripción *' : 'Descripción adicional (opcional)'}
                      </label>
                      <textarea
                        value={formData.message}
                        onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                        placeholder={formData.disputeType === 'otro' ? "Describe el problema que has encontrado..." : "Información adicional (opcional)..."}
                        rows={3}
                        className="w-full p-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 resize-none"
                        required={formData.disputeType === 'otro'}
                      />
                    </div>

                    {error && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                      </div>
                    )}

                    {/* Botones impugnación */}
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={loading || !formData.disputeType || (formData.disputeType === 'otro' && !formData.message.trim())}
                        className="flex-1 px-3 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
                      >
                        {loading ? 'Enviando...' : '⚖️ Enviar Impugnación'}
                      </button>
                    </div>
                  </>
                )}

                {/* Formulario genérico (feedback, bug, otro, etc.) */}
                {!isDispute && (
                  <>
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
                  </>
                )}
              </>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  )
}
