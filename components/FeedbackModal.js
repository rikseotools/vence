// components/FeedbackModal.js - Modal profesional para solicitudes de soporte
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'

const FEEDBACK_TYPES = [
  { id: 'suggestion', label: '💡 Sugerencia de Mejora', description: 'Ideas para mejorar la app' },
  { id: 'bug', label: '🐛 Error', description: 'Algo no funciona correctamente' },
  { id: 'question_dispute', label: '⚖️ Impugnación', description: 'Reportar error en pregunta' },
  { id: 'other', label: '❓ Otro', description: 'Cualquier otro tipo de solicitud' }
]

// Emoticonos populares para el chat
const EMOJIS = [
  '😀', '😂', '😊', '😍', '🤔', '😅', '😢', '😡', '😴', '🤗',
  '👍', '👎', '👏', '🙏', '💪', '👌', '✌️', '🤞', '🤝', '💯',
  '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '❓', '❗',
  '🎉', '🎊', '🔥', '💰', '📚', '✅', '❌', '⭐', '💡', '🚀'
]

// Función para convertir URLs en enlaces clickeables
const linkifyText = (text, isAdminMessage) => {
  if (!text) return null

  // Regex para detectar URLs (http://, https://, www.)
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g

  const parts = []
  let lastIndex = 0
  let match

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0]
    const matchIndex = match.index

    // Añadir texto antes de la URL
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex))
    }

    // Añadir la URL como enlace
    const href = url.startsWith('www.') ? `https://${url}` : url
    parts.push(
      <a
        key={matchIndex}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline hover:opacity-80 ${isAdminMessage ? 'text-blue-600 dark:text-blue-400' : 'text-blue-200'}`}
      >
        {url}
      </a>
    )

    lastIndex = matchIndex + url.length
  }

  // Añadir texto restante
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  // Si no hay URLs, devolver el texto tal cual
  return parts.length > 0 ? parts : text
}

export default function FeedbackModal({ isOpen, onClose, questionId = null, autoSelectQuestionDispute = false, currentTheme = null, onOpenQuestionDispute = null, onFeedbackSent = null, initialConversationId = null }) {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const [formData, setFormData] = useState({
    type: '',
    message: '',
    email: '',
    wantsResponse: false,
    disputeType: '' // Para impugnaciones: no_literal, respuesta_incorrecta, otro
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

  // Estados para conversaciones existentes
  const [existingConversations, setExistingConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [activeTab, setActiveTab] = useState('new') // 'new' o 'existing'
  const [selectedConversationId, setSelectedConversationId] = useState(null) // Para layout 2 columnas

  // Estados para el chat inline
  const [chatMessages, setChatMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [showChatEmojiPicker, setShowChatEmojiPicker] = useState(false)
  const [chatUploadedImages, setChatUploadedImages] = useState([])
  const [uploadingChatImage, setUploadingChatImage] = useState(false)
  const [lightboxImage, setLightboxImage] = useState(null) // Para ver imágenes en grande

  // Pre-rellenar email si usuario está logueado
  useEffect(() => {
    if (user?.email) {
      setFormData(prev => ({ ...prev, email: user.email }))
    }
  }, [user])

  // Cargar conversaciones existentes cuando se abre el modal
  useEffect(() => {
    const loadExistingConversations = async () => {
      if (!isOpen || !user || !supabase) return

      setLoadingConversations(true)
      try {
        const { data, error } = await supabase
          .from('feedback_conversations')
          .select(`
            *,
            feedback:user_feedback(id, message, type, created_at, status)
          `)
          .eq('user_id', user.id)
          .order('last_message_at', { ascending: false })
          .limit(10)

        if (error) throw error

        setExistingConversations(data || [])
        console.log('📂 [FEEDBACK] Conversaciones cargadas:', data?.length || 0)
      } catch (err) {
        console.error('❌ [FEEDBACK] Error cargando conversaciones:', err)
      } finally {
        setLoadingConversations(false)
      }
    }

    loadExistingConversations()
  }, [isOpen, user, supabase])

  // Pre-seleccionar conversación si se pasa initialConversationId
  useEffect(() => {
    if (isOpen && initialConversationId && existingConversations.length > 0 && !selectedConversationId) {
      const conversation = existingConversations.find(c => c.id === initialConversationId)
      if (conversation) {
        console.log('📂 [FEEDBACK] Pre-seleccionando conversación:', initialConversationId)
        // Cargar conversación usando la lógica inline (igual que handleOpenExistingConversation)
        setSelectedConversationId(conversation.id)
        setSelectedConversation(conversation)
        setActiveTab('chat')
        setChatInput('')
        setChatUploadedImages([])
        setShowChatEmojiPicker(false)

        // Cargar mensajes
        const loadMessages = async () => {
          setLoadingMessages(true)
          try {
            const { data: messages, error } = await supabase
              .from('feedback_messages')
              .select('*')
              .eq('conversation_id', conversation.id)
              .order('created_at', { ascending: true })
            if (error) throw error
            setChatMessages(messages || [])
          } catch (err) {
            console.error('Error cargando mensajes:', err)
            setChatMessages([])
          } finally {
            setLoadingMessages(false)
          }
        }
        loadMessages()
      }
    }
  }, [isOpen, initialConversationId, existingConversations, selectedConversationId, supabase])

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
      setActiveTab('new') // Siempre empezar en "Nueva solicitud"
    }
  }, [isOpen, success, user, autoSelectQuestionDispute])

  // Función para abrir una conversación existente en el panel derecho
  const handleOpenExistingConversation = async (conversation) => {
    setSelectedConversationId(conversation.id)
    setSelectedConversation(conversation)
    setActiveTab('chat')
    setChatInput('')
    setChatUploadedImages([])
    setShowChatEmojiPicker(false)

    // Cargar mensajes de la conversación
    setLoadingMessages(true)
    try {
      const { data: messages, error } = await supabase
        .from('feedback_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setChatMessages(messages || [])
    } catch (err) {
      console.error('Error cargando mensajes:', err)
      setChatMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }

  // Función para enviar mensaje en el chat
  const handleSendChatMessage = async (e) => {
    e.preventDefault()
    if ((!chatInput.trim() && chatUploadedImages.length === 0) || sendingMessage || !selectedConversationId) return

    setSendingMessage(true)
    try {
      // Preparar mensaje con imágenes si las hay
      let messageToSend = chatInput.trim()
      if (chatUploadedImages.length > 0) {
        if (messageToSend) messageToSend += '\n\n'
        messageToSend += '📸 Imágenes adjuntas:\n'
        chatUploadedImages.forEach((img, index) => {
          messageToSend += `${index + 1}. ${img.url}\n`
        })
      }

      // Usar API para enviar mensaje (bypass RLS)
      const response = await fetch('/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          message: messageToSend,
          userId: user?.id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar mensaje')
      }

      // Añadir mensaje al chat local
      setChatMessages(prev => [...prev, result.message])
      setChatInput('')
      setChatUploadedImages([])
      setShowChatEmojiPicker(false)

      // Actualizar lista de conversaciones
      setExistingConversations(prev =>
        prev.map(c =>
          c.id === selectedConversationId
            ? { ...c, status: 'waiting_admin', last_message_at: new Date().toISOString() }
            : c
        )
      )
    } catch (err) {
      console.error('Error enviando mensaje:', err)
      setError('Error al enviar el mensaje')
    } finally {
      setSendingMessage(false)
    }
  }

  // Función para parsear mensaje y extraer imágenes
  const parseMessageWithImages = (message) => {
    if (!message) return { text: '', images: [] }

    // Detectar URLs de imágenes (Supabase storage y otras)
    const imageRegex = /(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp))/gi
    const supabaseImageRegex = /(https?:\/\/[^\s]*supabase[^\s]*\/storage\/[^\s]+)/gi

    let text = message
    const images = []

    // Buscar URLs de Supabase storage
    const supabaseMatches = message.match(supabaseImageRegex) || []
    supabaseMatches.forEach(url => {
      images.push(url)
      text = text.replace(url, '')
    })

    // Buscar otras URLs de imágenes
    const imageMatches = message.match(imageRegex) || []
    imageMatches.forEach(url => {
      if (!images.includes(url)) {
        images.push(url)
        text = text.replace(url, '')
      }
    })

    // Limpiar texto: quitar "📸 Imágenes adjuntas:" y números de lista
    text = text.replace(/📸\s*Imágenes adjuntas:\s*/gi, '')
    text = text.replace(/^\d+\.\s*$/gm, '') // Quitar líneas tipo "1. "
    text = text.replace(/\n{3,}/g, '\n\n') // Reducir múltiples saltos de línea
    text = text.trim()

    return { text, images }
  }

  // Función para insertar emoji en el chat
  const insertChatEmoji = (emoji) => {
    setChatInput(prev => prev + emoji)
    setShowChatEmojiPicker(false)
  }

  // Función para subir imagen en el chat
  const handleChatImageUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede ser mayor a 5MB')
      return
    }

    setUploadingChatImage(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userPath', 'user-feedback-images')

      const response = await fetch('/api/upload-feedback-image', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error subiendo imagen')
      }

      setChatUploadedImages(prev => [...prev, {
        id: Date.now(),
        url: result.url,
        name: result.fileName,
        path: result.path
      }])

    } catch (error) {
      console.error('Error subiendo imagen:', error)
      setError(`Error: ${error.message}`)
    } finally {
      setUploadingChatImage(false)
      event.target.value = ''
    }
  }

  // Función para eliminar imagen del chat
  const removeChatImage = async (imageId, imagePath) => {
    try {
      await fetch(`/api/upload-feedback-image?path=${encodeURIComponent(imagePath)}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('Error eliminando imagen:', error)
    }
    setChatUploadedImages(prev => prev.filter(img => img.id !== imageId))
  }

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

      // Crear FormData para la API
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userPath', 'user-feedback-images')

      // Llamar a la API de subida
      const response = await fetch('/api/upload-feedback-image', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error desconocido en la subida')
      }

      console.log('✅ [USER] Respuesta exitosa de API:', result)

      // Añadir imagen a la lista
      setUploadedImages(prev => [...prev, {
        id: Date.now(),
        url: result.url,
        name: result.fileName,
        path: result.path
      }])

      console.log('✅ [USER] Imagen añadida a la lista correctamente')

      // Mostrar notificación de éxito
      const successMessage = `✅ Imagen "${file.name}" subida correctamente`
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
      notification.textContent = successMessage
      document.body.appendChild(notification)
      
      // Remover después de 3 segundos
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 3000)

    } catch (error) {
      console.error('❌ [USER] Error completo subiendo imagen:', error)
      
      // Mostrar error más específico al usuario
      let userMessage = 'Error al subir la imagen.'
      
      if (error.message?.includes('Bucket not found')) {
        userMessage = 'Error de configuración del almacenamiento. Contacta al administrador.'
      } else if (error.message?.includes('permissions') || error.message?.includes('policy')) {
        userMessage = 'Error de permisos al subir la imagen. Intenta iniciar sesión o contacta al soporte.'
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        userMessage = 'Error de conexión. Verifica tu internet e inténtalo de nuevo.'
      } else if (error.message) {
        userMessage = `Error: ${error.message}`
      }
      
      setError(userMessage)
    } finally {
      setUploadingImage(false)
      // Limpiar input
      event.target.value = ''
    }
  }

  // Función para eliminar imagen subida
  const removeImage = async (imageId, imagePath) => {
    try {
      console.log('🗑️ [USER] Eliminando imagen:', imagePath)
      
      // Llamar a la API para eliminar
      const response = await fetch(`/api/upload-feedback-image?path=${encodeURIComponent(imagePath)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const result = await response.json()
        console.error('❌ [USER] Error eliminando de API:', result.error)
        // No lanzar error, solo loggear
      } else {
        console.log('✅ [USER] Imagen eliminada del storage vía API')
      }

      // Eliminar de la lista local (siempre, incluso si falla la API)
      setUploadedImages(prev => prev.filter(img => img.id !== imageId))
      console.log('✅ [USER] Imagen removida de la lista local')
    } catch (error) {
      console.error('❌ [USER] Error eliminando imagen:', error)
      // Remover de la lista local de todas formas
      setUploadedImages(prev => prev.filter(img => img.id !== imageId))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Si no hay tipo seleccionado, usar 'other' por defecto
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
      // Validación para otros tipos de feedback
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
        console.log('⚖️ Enviando impugnación...', { questionId: detectedQuestionId, disputeType: formData.disputeType })

        // Construir descripción
        const description = formData.disputeType === 'otro'
          ? formData.message.trim()
          : `Motivo: ${formData.disputeType}${formData.message.trim() ? ` - Detalles: ${formData.message.trim()}` : ''}`

        const { data: disputeResult, error: disputeError } = await supabase
          .from('question_disputes')
          .insert({
            question_id: detectedQuestionId,
            user_id: user.id,
            dispute_type: formData.disputeType,
            description: description,
            status: 'pending'
          })
          .select()

        if (disputeError) {
          if (disputeError.message?.includes('duplicate key') || disputeError.message?.includes('question_disputes_question_id_user_id_key')) {
            setError('Ya has impugnado esta pregunta anteriormente. Solo se permite una impugnación por pregunta.')
          } else {
            setError(`Error al enviar la impugnación: ${disputeError.message}`)
          }
          setLoading(false)
          return
        }

        // Enviar email de notificación al admin
        if (disputeResult && disputeResult[0]) {
          try {
            const { sendAdminDisputeNotification } = await import('../lib/notifications/adminEmailNotifications')
            await sendAdminDisputeNotification({
              id: disputeResult[0].id,
              question_id: detectedQuestionId,
              user_id: user.id,
              user_email: user.email || 'Usuario anónimo',
              user_name: user.user_metadata?.full_name || 'Sin nombre',
              dispute_type: formData.disputeType,
              description: description,
              created_at: disputeResult[0].created_at
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

        // Auto-cerrar después de 4 segundos
        setTimeout(() => {
          setSuccess(false)
          onClose()
        }, 4000)
        return
      }

      // ===== MANEJO NORMAL DE FEEDBACK =====
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
        priority: 'medium',
        question_id: detectedContext.questionId || questionId || null // 🔍 Guardar ID de pregunta para debugging
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

      console.log('💾 Insertando feedback via API tipada...', {
        userId: feedbackData.user_id,
        type: feedbackData.type,
        messageLength: feedbackData.message?.length,
        questionId: feedbackData.question_id
      })

      // Usar API tipada con Drizzle + Zod (evita errores de schema)
      const apiResponse = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: feedbackData.user_id,
          email: feedbackData.email,
          type: feedbackData.type,
          message: feedbackData.message,
          url: feedbackData.url,
          userAgent: feedbackData.user_agent,
          viewport: feedbackData.viewport,
          referrer: feedbackData.referrer,
          wantsResponse: feedbackData.wants_response,
          status: feedbackData.status,
          priority: feedbackData.priority,
          questionId: feedbackData.question_id
        })
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
          // No fallar el feedback por esto
        }
      }

      // La conversación ya se crea automáticamente en la API

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

  // Layout de 2 columnas si hay conversaciones
  const hasConversations = existingConversations.length > 0

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-1 sm:p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-2xl w-full max-h-[98vh] sm:max-h-[90vh] overflow-hidden ${
        hasConversations ? 'max-w-3xl' : 'max-w-md'
      }`}>

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
          // 📝 CONTENIDO
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

            {/* Layout condicional: 2 columnas si hay conversaciones, 1 columna si no */}
            {hasConversations ? (
              // LAYOUT 2 COLUMNAS - siempre lado a lado
              <div className="flex flex-row" style={{ height: 'calc(90vh - 80px)', maxHeight: '600px' }}>
                {/* Panel izquierdo: Lista de conversaciones - SIEMPRE visible */}
                <div className="flex w-1/3 min-w-[140px] max-w-[200px] sm:w-64 sm:max-w-none md:w-72 border-r dark:border-gray-700 flex-col bg-gray-50 dark:bg-gray-900">
                  {/* Botón nueva solicitud */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(null)
                      setSelectedConversation(null)
                      setChatMessages([])
                      setChatInput('')
                      setFormData(prev => ({ ...prev, type: '', message: '', disputeType: '' }))
                      setActiveTab('new')
                    }}
                    className="m-2 p-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Nueva</span>
                  </button>

                  {/* Lista de conversaciones */}
                  <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                    {loadingConversations ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                      </div>
                    ) : (
                      existingConversations.map((conv) => {
                        const feedback = conv.feedback
                        const isSelected = selectedConversationId === conv.id
                        // Solo mostrar badge si hay respuesta o está cerrada
                        const showBadge = conv.status === 'waiting_user' || conv.status === 'closed'
                        const statusColors = {
                          'waiting_user': 'bg-blue-100 text-blue-700',
                          'closed': 'bg-gray-100 text-gray-600'
                        }
                        const statusLabels = {
                          'waiting_user': '💬 Respuesta',
                          'closed': '✅ Cerrada'
                        }
                        return (
                          <button
                            key={conv.id}
                            type="button"
                            onClick={() => handleOpenExistingConversation(conv)}
                            className={`w-full text-left p-3 rounded-lg transition-all ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500'
                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                            }`}
                          >
                            <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 mb-2">
                              {feedback?.message?.substring(0, 60)}{feedback?.message?.length > 60 ? '...' : ''}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">
                                {new Date(conv.last_message_at || conv.created_at).toLocaleDateString('es-ES', {
                                  day: 'numeric',
                                  month: 'short'
                                })}, {new Date(conv.last_message_at || conv.created_at).toLocaleTimeString('es-ES', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {showBadge && (
                                <span className={`text-xs px-2 py-0.5 rounded ${statusColors[conv.status]}`}>
                                  {statusLabels[conv.status]}
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Panel derecho: Formulario o Chat - SIEMPRE visible */}
                <div className="flex flex-1 flex-col bg-white dark:bg-gray-800 min-w-0">
                  {activeTab === 'chat' && selectedConversation ? (
                    // VISTA DE CHAT
                    <div className="flex flex-col h-full">
                      {/* Header del chat */}
                      <div className="p-2 sm:p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                        <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 line-clamp-2">
                          {selectedConversation.feedback?.message?.substring(0, 100)}
                          {selectedConversation.feedback?.message?.length > 100 ? '...' : ''}
                        </p>
                        <span className="text-xs text-gray-500">
                          {new Date(selectedConversation.created_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>

                      {/* Mensajes del chat */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {loadingMessages ? (
                          <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          </div>
                        ) : chatMessages.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <p className="text-sm">No hay mensajes aún.</p>
                            <p className="text-xs mt-1">Escribe para continuar la conversación.</p>
                          </div>
                        ) : (
                          chatMessages.map((msg) => {
                            const { text, images } = parseMessageWithImages(msg.message)
                            return (
                              <div
                                key={msg.id}
                                className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
                              >
                                <div
                                  className={`max-w-[80%] p-3 rounded-lg text-sm ${
                                    msg.is_admin
                                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                                      : 'bg-blue-600 text-white'
                                  }`}
                                >
                                  {/* Nombre del remitente */}
                                  <p className={`text-xs font-medium mb-1 ${msg.is_admin ? 'text-gray-500' : 'text-blue-200'}`}>
                                    {msg.is_admin ? 'Equipo de Vence' : (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Tú')}
                                  </p>

                                  {/* Texto del mensaje */}
                                  {text && <p className="whitespace-pre-wrap">{linkifyText(text, msg.is_admin)}</p>}

                                  {/* Imágenes como miniaturas estilo WhatsApp */}
                                  {images.length > 0 && (
                                    <div className={`flex flex-wrap gap-2 ${text ? 'mt-2' : ''}`}>
                                      {images.map((imgUrl, idx) => (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => setLightboxImage(imgUrl)}
                                          className="relative group rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                                        >
                                          <img
                                            src={imgUrl}
                                            alt={`Imagen ${idx + 1}`}
                                            className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg"
                                            onError={(e) => {
                                              e.target.style.display = 'none'
                                            }}
                                          />
                                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                            </svg>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  <span className={`text-xs mt-1 block ${msg.is_admin ? 'text-gray-500' : 'text-blue-200'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString('es-ES', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>

                      {/* Input de mensaje con emojis y fotos */}
                      <form onSubmit={handleSendChatMessage} className="p-3 border-t dark:border-gray-700">
                        {/* Vista previa de imágenes */}
                        {chatUploadedImages.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {chatUploadedImages.map((image) => (
                              <div key={image.id} className="relative group">
                                <img
                                  src={image.url}
                                  alt={image.name}
                                  className="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeChatImage(image.id, image.path)}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="relative">
                          <textarea
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Escribe un mensaje..."
                            rows={2}
                            className="w-full p-2 pr-24 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                            disabled={sendingMessage}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSendChatMessage(e)
                              }
                            }}
                          />

                          {/* Botones de acción */}
                          <div className="absolute bottom-2 right-2 flex items-center gap-1">
                            {/* Subir imagen */}
                            <label className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-gray-600">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleChatImageUpload}
                                className="hidden"
                                disabled={uploadingChatImage}
                              />
                              {uploadingChatImage ? (
                                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              )}
                            </label>

                            {/* Emojis */}
                            <button
                              type="button"
                              onClick={() => setShowChatEmojiPicker(!showChatEmojiPicker)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                            >
                              😊
                            </button>

                            {/* Enviar */}
                            <button
                              type="submit"
                              disabled={sendingMessage || (!chatInput.trim() && chatUploadedImages.length === 0)}
                              className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {sendingMessage ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                              )}
                            </button>
                          </div>

                          {/* Selector de Emojis */}
                          {showChatEmojiPicker && (
                            <div className="absolute bottom-14 right-0 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-2 z-50 w-56 max-h-32 overflow-y-auto">
                              <div className="grid grid-cols-8 gap-1">
                                {EMOJIS.map((emoji, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => insertChatEmoji(emoji)}
                                    className="p-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </form>
                    </div>
                  ) : (
                    // FORMULARIO DE NUEVA SOLICITUD
                    <div className="flex-1 overflow-y-auto">
                      <form onSubmit={handleSubmit} className="p-2 sm:p-4 space-y-3 sm:space-y-4">
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
                                  className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-center"
                                >
                                  <div className="text-lg mb-1">{type.label.split(' ')[0]}</div>
                                  <div className="font-medium text-sm text-gray-800 dark:text-gray-200">
                                    {type.label.substring(type.label.indexOf(' ') + 1)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tipo seleccionado + Descripción */}
                        {formData.type && (
                          <>
                            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <span className="text-sm text-blue-700 dark:text-blue-300">
                                {FEEDBACK_TYPES.find(t => t.id === formData.type)?.label}
                              </span>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, type: '' }))}
                                className="ml-auto text-xs text-blue-600 hover:text-blue-800"
                              >
                                Cambiar
                              </button>
                            </div>

                            {/* Advertencia para impugnación sin pregunta */}
                            {formData.type === 'question_dispute' && !questionId && !detectedContext.questionId ? (
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
                            ) : formData.type === 'question_dispute' ? (
                              // Formulario de impugnación con pregunta detectada
                              <>
                              {/* Confirmación de pregunta detectada */}
                              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg flex items-center gap-2 mb-3">
                                <span className="text-xl">✅</span>
                                <div>
                                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                    Pregunta detectada
                                  </p>
                                  <p className="text-xs text-green-600 dark:text-green-400">
                                    ID: {(questionId || detectedContext.questionId)?.substring(0, 8)}...
                                  </p>
                                </div>
                              </div>

                              {/* Motivo de impugnación */}
                              <div className="mb-3">
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

                              {/* Descripción */}
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
                            ) : (
                            <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                📝 Descripción *
                              </label>
                              <textarea
                                value={formData.message}
                                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                                placeholder="Describe tu solicitud..."
                                rows={4}
                                className="w-full p-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                📧 Email
                              </label>
                              <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="tu@email.com"
                                disabled={!!user}
                                className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-600"
                              />
                            </div>

                            {error && (
                              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                              </div>
                            )}

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
                                disabled={loading || !formData.message.trim()}
                                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                              >
                                {loading ? 'Enviando...' : '📤 Enviar'}
                              </button>
                            </div>
                            </>
                            )}
                          </>
                        )}
                      </form>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Sin conversaciones - mostrar formulario simple
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
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

              {/* Confirmación del tipo seleccionado - Solo si hay tipo */}
              {formData.type && (
                <>
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

                  {/* Advertencia para impugnación sin pregunta */}
                  {formData.type === 'question_dispute' && !questionId && !detectedContext.questionId && (
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

              {/* Ocultar formulario si es impugnación sin pregunta */}
              {!(formData.type === 'question_dispute' && !questionId && !detectedContext.questionId) && (
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
              </>
              )}
            </form>
            )}
          </>
        )}

        {/* Lightbox para ver imágenes en grande */}
        {lightboxImage && (
          <div
            className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={lightboxImage}
              alt="Imagen ampliada"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  )
}