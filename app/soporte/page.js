// app/soporte/page.js - Centro de soporte unificado para usuarios
'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import FeedbackModal from '@/components/FeedbackModal'

const FEEDBACK_TYPES = {
  'bug': { label: '🐛 Bug', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
  'suggestion': { label: '💡 Sugerencia', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  'content': { label: '📚 Contenido', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
  'design': { label: '🎨 Diseño', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300' },
  'praise': { label: '⭐ Felicitación', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  'other': { label: '❓ Otro', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' }
}

const STATUS_CONFIG = {
  'pending': { label: '⏳ Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
  'in_review': { label: '👀 En Revisión', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  'resolved': { label: '✅ Cerrado', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  'dismissed': { label: '❌ Descartado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' }
}

const DISPUTE_STATUS_CONFIG = {
  'pending': { label: '🟡 Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
  'reviewing': { label: '🔵 En revisión', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  'resolved': { label: '🟢 Resuelta', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  'rejected': { label: '🔴 Rechazada', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' }
}

const DISPUTE_TYPES = {
  'respuesta_incorrecta': '❌ Respuesta Incorrecta',
  'no_literal': '📝 No Literal',
  'otro': '💭 Otro Motivo',
  // Tipos de impugnaciones psicotécnicas
  'ai_detected_error': '📊 Error en datos/gráficos',
  'other': '💭 Otro Motivo'
}

// Traducciones para subtipos de preguntas psicotécnicas
const QUESTION_SUBTYPES = {
  'sequence_numeric': 'Secuencia Numérica',
  'sequence_letters': 'Secuencia de Letras',
  'sequence_alphanumeric': 'Secuencia Alfanumérica',
  'series_numericas': 'Series Numéricas',
  'series_letras': 'Series de Letras',
  'series_alfanumericas': 'Series Alfanuméricas',
  'razonamiento_numerico': 'Razonamiento Numérico',
  'razonamiento_verbal': 'Razonamiento Verbal',
  'capacidad_administrativa': 'Capacidad Administrativa',
  'capacidad_ortografica': 'Capacidad Ortográfica',
  'pruebas_instrucciones': 'Pruebas de Instrucciones'
}

function SoporteContent() {
  const { user, supabase } = useAuth()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('conversations') // Will be updated based on URL params or pending disputes
  const [feedbacks, setFeedbacks] = useState([])
  const [notifications, setNotifications] = useState([])
  const [conversations, setConversations] = useState({})
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [initialConversationId, setInitialConversationId] = useState(null)
  const [disputes, setDisputes] = useState([])
  const [disputesLoading, setDisputesLoading] = useState(false)
  const [disputeFilter, setDisputeFilter] = useState('all') // all, pending, resolved, rejected
  const [selectedQuestionModal, setSelectedQuestionModal] = useState(null) // Para el modal de pregunta completa
  const [expandedImage, setExpandedImage] = useState(null) // Para el modal de imagen expandida
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (user) {
      loadUserData()
    } else {
      setLoading(false)
    }
  }, [user])

  // Scroll automático al final cuando cambian los mensajes
  useEffect(() => {
    scrollToBottom()
  }, [chatMessages])

  // Bloquear scroll del body cuando hay modales abiertos
  useEffect(() => {
    if (selectedConversation || selectedQuestionModal || expandedImage) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [selectedConversation, selectedQuestionModal, expandedImage])

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
        if (showEmojiPicker) {
          setShowEmojiPicker(false)
        } else if (expandedImage) {
          setExpandedImage(null)
        } else if (selectedQuestionModal) {
          setSelectedQuestionModal(null)
        } else if (selectedConversation) {
          setSelectedConversation(null)
        }
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [showEmojiPicker, expandedImage, selectedQuestionModal, selectedConversation])

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmojiPicker && !event.target.closest('.emoji-picker-container')) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmojiPicker])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Handle image upload
  const handleImageUpload = async (file) => {
    if (!file || !selectedConversation) return
    
    try {
      setUploadingImage(true)
      
      // Validation
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        alert('La imagen debe ser menor a 5MB')
        return
      }

      if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido')
        return
      }

      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/upload-feedback-image', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }

      const result = await response.json()
      
      if (result.url) {
        // Add image URL to textarea
        const currentText = newMessage
        const imageText = `${result.url}\n`
        setNewMessage(currentText + imageText)
        
        if (textareaRef.current) {
          textareaRef.current.focus()
        }
      }

    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Error al subir la imagen. Inténtalo de nuevo.')
    } finally {
      setUploadingImage(false)
    }
  }

  // Insert emoji
  const insertEmoji = (emoji) => {
    const currentText = newMessage
    setNewMessage(currentText + emoji)
    setShowEmojiPicker(false)
    
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  // WhatsApp-style image rendering
  const renderMessageWithImages = (messageText) => {
    if (!messageText) return messageText
    
    const imageUrlRegex = /(https?:\/\/[^\s\n]+\.(?:jpg|jpeg|png|gif|webp|JPG|JPEG|PNG|GIF|WEBP)(?:\?[^\s\n]*)?)/gi
    const parts = messageText.split(imageUrlRegex)
    
    return parts.map((part, index) => {
      if (part.match(imageUrlRegex)) {
        return (
          <div key={index} className="mt-2 mb-1">
            <div 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setExpandedImage(part)
              }}
              className="relative cursor-pointer group bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg max-w-[200px] border border-blue-200 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
            >
              <img 
                src={part} 
                alt="Imagen adjunta"
                className="w-full h-auto rounded-md max-h-32 object-cover"
                loading="lazy"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextElementSibling.style.display = 'block'
                }}
              />
              <div style={{display: 'none'}} className="text-xs text-blue-600 dark:text-blue-400">
                🖼️ Error cargando imagen
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all">
                <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">🔍 Ver</span>
              </div>
            </div>
          </div>
        )
      } else {
        return part.trim() && <span key={index}>{part}</span>
      }
    })
  }

  // Auto-abrir conversación si viene del parámetro conversation_id
  useEffect(() => {
    const conversationId = searchParams.get('conversation_id')
    if (conversationId && Object.keys(conversations).length > 0) {
      const conversation = Object.values(conversations).find(c => c.id === conversationId)
      if (conversation) {
        setSelectedConversation(conversation)
        loadChatMessages(conversation.id)
        setActiveTab('conversations')
      }
    }
  }, [searchParams, conversations])

  // Auto-abrir tab de impugnaciones y resaltar disputa específica
  useEffect(() => {
    const disputeId = searchParams.get('dispute_id')
    const tab = searchParams.get('tab')

    if (tab === 'impugnaciones') {
      setActiveTab('disputes')

      if (disputeId && disputes.length > 0) {
        // Buscar la disputa para saber si es psicotécnica
        const dispute = disputes.find(d => d.id === disputeId)

        // Marcar como leída si existe y no está leída
        if (dispute && !dispute.is_read) {
          const tableName = dispute.isPsychometric ? 'psychometric_question_disputes' : 'question_disputes'
          supabase
            .from(tableName)
            .update({ is_read: true })
            .eq('id', disputeId)
            .eq('user_id', user.id)
            .then(({ error }) => {
              if (error) {
                console.error('Error marcando disputa como leída:', error)
              } else {
                console.log('✅ Disputa marcada como leída:', disputeId)
                // Actualizar estado local
                setDisputes(prev => prev.map(d =>
                  d.id === disputeId ? { ...d, is_read: true } : d
                ))
              }
            })
        }

        // Scroll a la disputa específica después de un breve delay
        setTimeout(() => {
          const disputeElement = document.getElementById(`dispute-${disputeId}`)
          if (disputeElement) {
            disputeElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // Resaltar temporalmente
            disputeElement.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-50')
            setTimeout(() => {
              disputeElement.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-50')
            }, 3000)
          }
        }, 500)
      }
    }
  }, [searchParams, disputes, user, supabase])

  // 🆕 AUTO-DETECTAR TAB POR DEFECTO BASADO EN ELEMENTOS PENDIENTES
  useEffect(() => {
    // Solo aplicar lógica automática si no hay parámetros explícitos en URL
    const hasUrlParams = searchParams.get('tab') || searchParams.get('conversation_id') || searchParams.get('dispute_id')
    
    if (!hasUrlParams && (disputes.length > 0 || Object.keys(conversations).length > 0)) {
      // Contar disputas pendientes (no resueltas)
      const pendingDisputes = disputes.filter(d => d.status === 'pending')
      
      // Contar conversaciones esperando respuesta del usuario
      const waitingUserConversations = Object.values(conversations).filter(c => c.status === 'waiting_user')
      
      // Prioridad: 1) Conversaciones esperando usuario, 2) Disputas pendientes
      if (waitingUserConversations.length > 0) {
        console.log(`🔍 Auto-detectado: ${waitingUserConversations.length} conversaciones esperando usuario, cambiando a tab conversations`)
        setActiveTab('conversations')
      } else if (pendingDisputes.length > 0) {
        console.log(`🔍 Auto-detectado: ${pendingDisputes.length} impugnaciones pendientes, cambiando a tab disputes`)
        setActiveTab('disputes')
        setDisputeFilter('pending') // 🆕 Establecer filtro en "pendientes" por defecto
      }
    }
  }, [disputes, conversations, searchParams])

  // 🆕 FUNCIÓN PARA FORMATEAR ARTÍCULO CON RESALTADO INTELIGENTE
  const formatArticleContent = (content, question, correctAnswer) => {
    if (!content) return 'Contenido no disponible'
    
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

    // Resaltar referencias a leyes y normativas
    formattedContent = formattedContent
      .replace(/(Ley\s+\d+\/\d+)/gi, '<strong style="color: #2563eb; background-color: #eff6ff; padding: 1px 3px; border-radius: 2px;">📋 $1</strong>')
      .replace(/(Real Decreto\s+\d+\/\d+)/gi, '<strong style="color: #16a34a; background-color: #f0fdf4; padding: 1px 3px; border-radius: 2px;">📜 $1</strong>')
      .replace(/(artículo\s+\d+)/gi, '<strong style="color: #9333ea; background-color: #faf5ff; padding: 1px 3px; border-radius: 2px;">📄 $1</strong>')

    // Intentar resaltar frases clave que puedan estar relacionadas con la respuesta correcta
    if (correctAnswer && correctAnswer.length > 10) {
      // Extraer palabras clave de la respuesta correcta (eliminando artículos, preposiciones, etc.)
      const stopWords = ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'y', 'o', 'que', 'por', 'para', 'con', 'se', 'es', 'son', 'está', 'están']
      const keywords = correctAnswer.toLowerCase()
        .replace(/[.,;:!?()]/g, ' ')
        .split(' ')
        .filter(word => word.length > 3 && !stopWords.includes(word))
        .slice(0, 3) // Solo primeras 3 palabras clave
      
      // Resaltar cada palabra clave en el contenido
      keywords.forEach(keyword => {
        if (keyword.length > 3) {
          const regex = new RegExp(`(\\b${keyword}\\w*)`, 'gi')
          formattedContent = formattedContent.replace(regex, 
            '<mark style="background-color: #fef3c7; padding: 2px 4px; border-radius: 3px; font-weight: bold; color: #92400e;">🎯 $1</mark>'
          )
        }
      })
    }

    return formattedContent
  }

  // 🆕 FILTRAR DISPUTAS SEGÚN FILTRO SELECCIONADO
  const getFilteredDisputes = () => {
    if (disputeFilter === 'all') return disputes
    
    switch (disputeFilter) {
      case 'pending':
        return disputes.filter(d => d.status === 'pending')
      case 'resolved':
        // "Resueltas" incluye todas las que ya tienen respuesta del admin
        return disputes.filter(d => d.status === 'resolved' || d.status === 'rejected' || d.status === 'appealed')
      default:
        return disputes
    }
  }

  const loadUserData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadUserFeedbacks(),
        loadUserNotifications(),
        loadUserConversations(),
        loadUserDisputes() // Cargar impugnaciones desde el inicio
      ])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Las impugnaciones se cargan automáticamente en loadUserData()

  const loadUserFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .eq('user_id', user.id)
        .neq('type', 'question_dispute') // Excluir impugnaciones de conversaciones
        .order('created_at', { ascending: false })

      if (error) throw error
      setFeedbacks(data || [])
    } catch (error) {
      console.error('Error cargando feedbacks:', error)
    }
  }

  const loadUserNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Error cargando notificaciones:', error)
    }
  }

  const loadUserConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_conversations')
        .select(`
          *,
          feedback:user_feedback(*)
        `)
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })

      if (error) throw error

      // Convertir a objeto indexado por feedback_id
      const conversationsMap = {}
      data?.forEach(conv => {
        conversationsMap[conv.feedback_id] = conv
      })
      setConversations(conversationsMap)
    } catch (error) {
      console.error('Error cargando conversaciones:', error)
    }
  }

  const loadUserDisputes = async () => {
    try {
      setDisputesLoading(true)

      // Cargar impugnaciones normales (de leyes)
      const { data: normalDisputes, error: normalError } = await supabase
        .from('question_disputes')
        .select(`
          id,
          dispute_type,
          description,
          status,
          created_at,
          resolved_at,
          admin_response,
          appeal_text,
          appeal_submitted_at,
          is_read,
          questions!inner (
            question_text,
            correct_option,
            option_a,
            option_b,
            option_c,
            option_d,
            explanation,
            articles!inner (
              article_number,
              title,
              content,
              laws!inner (short_name)
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (normalError) throw normalError

      // Cargar impugnaciones psicotécnicas
      const { data: psychoDisputes, error: psychoError } = await supabase
        .from('psychometric_question_disputes')
        .select(`
          id,
          dispute_type,
          description,
          status,
          created_at,
          resolved_at,
          admin_response,
          question_id,
          is_read,
          psychometric_questions (
            question_text,
            question_subtype,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_option,
            explanation,
            solution_steps,
            content_data
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (psychoError) {
        console.warn('Error cargando impugnaciones psicotécnicas:', psychoError)
      }

      // Marcar y combinar
      const markedNormal = (normalDisputes || []).map(d => ({ ...d, isPsychometric: false }))
      const markedPsycho = (psychoDisputes || []).map(d => ({
        ...d,
        isPsychometric: true,
        // Mapear estructura para compatibilidad con preguntas normales
        questions: d.psychometric_questions ? {
          question_text: d.psychometric_questions.question_text,
          question_subtype: d.psychometric_questions.question_subtype,
          option_a: d.psychometric_questions.option_a,
          option_b: d.psychometric_questions.option_b,
          option_c: d.psychometric_questions.option_c,
          option_d: d.psychometric_questions.option_d,
          correct_option: d.psychometric_questions.correct_option,
          explanation: d.psychometric_questions.explanation,
          solution_steps: d.psychometric_questions.solution_steps,
          content_data: d.psychometric_questions.content_data
        } : null
      }))

      // Combinar y ordenar por fecha
      const allDisputes = [...markedNormal, ...markedPsycho]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      setDisputes(allDisputes)
    } catch (error) {
      console.error('Error cargando impugnaciones:', error)
    } finally {
      setDisputesLoading(false)
    }
  }

  const loadChatMessages = async (conversationId) => {
    try {
      const { data, error } = await supabase
        .from('feedback_messages')
        .select(`
          *,
          sender:sender_id (
            full_name,
            email
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setChatMessages(data || [])
    } catch (error) {
      console.error('Error cargando mensajes:', error)
    }
  }

  const sendUserMessage = async (conversationId, message) => {
    try {
      setSendingMessage(true)
      const { error } = await supabase
        .from('feedback_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          is_admin: false,
          message: message.trim()
        })

      if (error) throw error

      // Actualizar conversación
      await supabase
        .from('feedback_conversations')
        .update({ 
          status: 'waiting_admin',
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId)

      // 🔄 Si el usuario responde a una conversación resuelta, reabrir el feedback asociado
      console.log('🔍 Verificando si feedback asociado necesita reabrirse...')
      
      // Obtener feedback_id desde la conversación
      const { data: conversationData } = await supabase
        .from('feedback_conversations')
        .select('feedback_id')
        .eq('id', conversationId)
        .single()
      
      if (conversationData?.feedback_id) {
        const { data: feedbackStatus } = await supabase
          .from('user_feedback')
          .select('status')
          .eq('id', conversationData.feedback_id)
          .single()
        
        if (feedbackStatus?.status === 'resolved' || feedbackStatus?.status === 'dismissed') {
          console.log('🔄 Usuario respondió a feedback resuelto - reabriendo...')
          const { error: feedbackError } = await supabase
            .from('user_feedback')
            .update({ 
              status: 'pending',
              resolved_at: null
            })
            .eq('id', conversationData.feedback_id)
          
          if (feedbackError) {
            console.error('❌ Error reabriendo feedback:', feedbackError)
          } else {
            console.log('✅ Feedback reabierto por respuesta del usuario')
          }
        }
      }

      // Enviar notificación al admin
      try {
        const { sendAdminChatResponseNotification } = await import('../../lib/notifications/adminEmailNotifications')
        await sendAdminChatResponseNotification({
          conversation_id: conversationId,
          user_id: user.id,
          user_email: user.email,
          user_name: user.user_metadata?.full_name || 'Usuario',
          message: message.trim(),
          feedback_id: selectedConversation?.feedback_id,
          created_at: new Date().toISOString()
        })
        console.log('✅ Notificación admin enviada')
      } catch (notificationError) {
        console.error('❌ Error enviando notificación admin:', notificationError)
        // No fallar el envío del mensaje si falla la notificación
      }

      // Recargar mensajes
      await loadChatMessages(conversationId)
      await loadUserConversations()
      setNewMessage('')
      
      // Scroll automático al final después de enviar
      setTimeout(() => scrollToBottom(), 100)
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      alert('Error enviando mensaje. Inténtalo de nuevo.')
    } finally {
      setSendingMessage(false)
    }
  }

  const createNewComment = async (feedbackId) => {
    const message = prompt('Escribe tu nuevo comentario:')
    if (!message || !message.trim()) return

    try {
      // Buscar conversación existente o crear una nueva
      let conversation = conversations[feedbackId]
      
      if (!conversation) {
        const { data: newConv, error: convError } = await supabase
          .from('feedback_conversations')
          .insert({
            feedback_id: feedbackId,
            user_id: user.id,
            status: 'waiting_admin'
          })
          .select()
          .single()

        if (convError) throw convError
        conversation = newConv
      }

      // Enviar mensaje
      await sendUserMessage(conversation.id, message)
      
      // Recargar datos
      await loadUserConversations()
    } catch (error) {
      console.error('Error creando comentario:', error)
      alert('Error enviando comentario. Inténtalo de nuevo.')
    }
  }

  // Función para manejar satisfacción del usuario con la respuesta
  const handleDisputeSatisfaction = async (dispute, isSatisfied) => {
    try {
      console.log(`🎯 Usuario ${isSatisfied ? 'satisfecho' : 'no satisfecho'} con impugnación:`, dispute.id)

      if (isSatisfied) {
        // Usuario satisfecho - cerrar definitivamente
        const { error: updateError } = await supabase
          .from('question_disputes')
          .update({ 
            status: 'resolved',
            appeal_text: 'Usuario de acuerdo con la respuesta del administrador.',
            appeal_submitted_at: new Date().toISOString()
          })
          .eq('id', dispute.id)

        if (updateError) throw updateError

        alert('✅ Gracias por tu feedback. La impugnación se ha marcado como resuelta.')
        
      } else {
        // Usuario no satisfecho - abrir formulario de apelación
        const appealReason = prompt('Por favor, explica por qué no estás de acuerdo con la respuesta y qué consideras que debería corregirse:')
        
        if (!appealReason || !appealReason.trim()) {
          return // Usuario canceló
        }

        const { error: updateError } = await supabase
          .from('question_disputes')
          .update({ 
            status: 'pending',
            appeal_text: appealReason.trim(),
            appeal_submitted_at: new Date().toISOString()
          })
          .eq('id', dispute.id)

        if (updateError) throw updateError

        alert('✅ Tu apelación ha sido registrada. Vence revisará tu caso nuevamente.')
      }

      // Recargar las disputas
      await loadUserDisputes()

    } catch (error) {
      console.error('❌ Error procesando satisfacción:', error)
      alert('Error al procesar tu respuesta. Inténtalo de nuevo.')
    }
  }

  const pendingFeedbacks = feedbacks.filter(f => f.status === 'pending')
  const waitingUserConversations = Object.values(conversations).filter(c => c.status === 'waiting_user')
  const pendingDisputes = disputes.filter(d => d.status === 'pending')
  const recentNotifications = notifications.filter(n => n.context_data?.type === 'feedback_response')

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Acceso restringido
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Necesitas iniciar sesión para acceder al soporte
          </p>
          <Link 
            href="/auth"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Iniciar Sesión
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando centro de soporte...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-6xl">
        
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            🎧 Centro de Soporte
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestiona tus consultas, feedback y conversaciones con nuestro equipo
          </p>
        </div>

        {/* Stats Cards - Compactas */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 mb-6">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{feedbacks.length}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{pendingFeedbacks.length}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Pendientes</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">{waitingUserConversations.length}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Respuestas</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{Object.keys(conversations).length}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Chats</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            🚀 Acciones Rápidas
          </h3>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => {
                setInitialConversationId(null) // Nueva solicitud, sin conversación pre-seleccionada
                setShowFeedbackModal(true)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              💬 Abrir chat soporte
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          
          {/* Tab Headers */}
          <div className="flex border-b dark:border-gray-700">
            <button
              onClick={() => setActiveTab('conversations')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'conversations'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              💬 Chat de soporte ({feedbacks.length})
            </button>
            <button
              onClick={() => setActiveTab('disputes')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'disputes'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              ⚖️ Impugnaciones ({disputes.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            

            {/* Conversations Tab */}
            {activeTab === 'conversations' && (
              <div className="space-y-4">
                {feedbacks.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">💬</div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      No tienes chats de soporte
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Cuando envíes un mensaje al equipo aparecerá aquí
                    </p>
                    <button
                      onClick={() => {
                        setInitialConversationId(null)
                        setShowFeedbackModal(true)
                      }}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      💬 Abrir chat soporte
                    </button>
                  </div>
                ) : (
                  feedbacks.map((feedback) => (
                    <div 
                      key={feedback.id} 
                      className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      
                      {/* Header del feedback */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${FEEDBACK_TYPES[feedback.type]?.color || 'bg-gray-100 text-gray-800'}`}>
                            {FEEDBACK_TYPES[feedback.type]?.label || feedback.type}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_CONFIG[feedback.status]?.color}`}>
                            {STATUS_CONFIG[feedback.status]?.label}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(feedback.created_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Madrid'
                          })}
                        </div>
                      </div>

                      {/* Mensaje */}
                      <p className="text-gray-800 dark:text-gray-200 mb-3">
                        {feedback.message}
                      </p>

                      {/* Chat conversation indicator */}
                      {conversations[feedback.id] && (
                        <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-green-800 dark:text-green-300">
                              💬 "{feedback.message.substring(0, 50)}{feedback.message.length > 50 ? '...' : ''}"
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                conversations[feedback.id].status === 'waiting_admin' 
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' 
                                  : conversations[feedback.id].status === 'waiting_user'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {conversations[feedback.id].status === 'waiting_admin' ? '⏳ Esperando respuesta' : 
                                 conversations[feedback.id].status === 'waiting_user' ? '💬 Nueva respuesta' : 
                                 conversations[feedback.id].status}
                              </span>
                              <button
                                onClick={() => {
                                  // Usar el nuevo FeedbackModal en lugar del modal viejo
                                  setInitialConversationId(conversations[feedback.id].id)
                                  setShowFeedbackModal(true)
                                }}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                  conversations[feedback.id].status === 'waiting_user'
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                              >
                                {conversations[feedback.id].status === 'waiting_user'
                                  ? 'Ver Respuesta'
                                  : 'Abrir Chat'
                                }
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  ))
                )}
              </div>
            )}

            {/* Disputes Tab */}
            {activeTab === 'disputes' && (
              <div className="space-y-4">
                
                {/* 🆕 FILTROS COMPACTOS PARA DISPUTAS */}
                {disputes.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4 mb-6">
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm sm:text-base">🔍 Filtrar:</h4>
                      {/* Versión móvil: una sola fila con scroll horizontal */}
                      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                        {[
                          { key: 'pending', label: 'Pendientes', emoji: '⏳', count: disputes.filter(d => d.status === 'pending').length },
                          { key: 'resolved', label: 'Resueltas', emoji: '✅', count: disputes.filter(d => d.status === 'resolved' || d.status === 'rejected' || d.status === 'appealed').length },
                          { key: 'all', label: 'Todas', emoji: '📋', count: disputes.length }
                        ].map(filter => (
                          <button
                            key={filter.key}
                            onClick={() => setDisputeFilter(filter.key)}
                            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                              disputeFilter === filter.key
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500 border border-gray-200 dark:border-gray-500'
                            }`}
                          >
                            <span className="sm:hidden">{filter.emoji} {filter.key === 'pending' ? 'Pend.' : filter.key === 'resolved' ? 'Resuel.' : 'Todas'} {filter.count}</span>
                            <span className="hidden sm:inline">{filter.emoji} {filter.label} ({filter.count})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {disputesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando impugnaciones...</p>
                  </div>
                ) : getFilteredDisputes().length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">⚖️</div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {disputes.length === 0 ? 'No tienes impugnaciones' : `No hay impugnaciones ${disputeFilter === 'all' ? '' : disputeFilter}`}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {disputes.length === 0 
                        ? 'Cuando encuentres una pregunta incorrecta, puedes reportarla desde el test.'
                        : 'Cambia el filtro para ver otras impugnaciones.'
                      }
                    </p>
                    <Link 
                      href="/auxiliar-administrativo-estado/test"
                      className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      🎯 Hacer un Test
                    </Link>
                  </div>
                ) : (
                  getFilteredDisputes().map((dispute) => {
                    const statusConfig = DISPUTE_STATUS_CONFIG[dispute.status] || { label: dispute.status, color: 'bg-gray-100 text-gray-800' }
                    return (
                      <div key={dispute.id} id={`dispute-${dispute.id}`} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow">
                        
                        {/* Header de la impugnación */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                            {dispute.isPsychometric ? (
                              <span className="text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">
                                🧠 Psicotécnico
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {dispute.questions?.articles?.laws?.short_name} - Art. {dispute.questions?.articles?.article_number}
                              </span>
                            )}
                            <span className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                              {DISPUTE_TYPES[dispute.dispute_type] || dispute.dispute_type}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            📅 {new Date(dispute.created_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>

                        {/* Pregunta impugnada (versión compacta) */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                              {dispute.isPsychometric ? '🧠 Pregunta psicotécnica:' : '📋 Pregunta impugnada:'}
                            </h4>
                            <button
                              onClick={() => setSelectedQuestionModal(dispute)}
                              className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                            >
                              👁️ Ver pregunta
                            </button>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">{dispute.questions?.question_text}</p>

                            {/* Respuesta correcta - solo para preguntas normales */}
                            {!dispute.isPsychometric && dispute.questions?.correct_option && (
                              <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded border-l-4 border-green-400">
                                <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
                                  Respuesta correcta: {['A', 'B', 'C', 'D'][dispute.questions?.correct_option - 1]}
                                </p>
                                <p className="text-sm text-green-800 dark:text-green-300">
                                  {dispute.questions?.correct_option === 1 ? dispute.questions?.option_a :
                                   dispute.questions?.correct_option === 2 ? dispute.questions?.option_b :
                                   dispute.questions?.correct_option === 3 ? dispute.questions?.option_c :
                                   dispute.questions?.correct_option === 4 ? dispute.questions?.option_d : 'N/A'}
                                </p>
                              </div>
                            )}

                            {/* Info adicional para psicotécnicas */}
                            {dispute.isPsychometric && dispute.questions?.question_subtype && (
                              <div className="bg-purple-50 dark:bg-purple-900/30 p-2 rounded border-l-4 border-purple-400">
                                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                  Tipo: {QUESTION_SUBTYPES[dispute.questions.question_subtype] || dispute.questions.question_subtype.replace(/_/g, ' ')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tu reporte */}
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">💬 Tu reporte:</h4>
                          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border-l-4 border-blue-400">
                            <p className="text-blue-800 dark:text-blue-300 text-sm">{dispute.description}</p>
                          </div>
                        </div>

                        {/* Respuesta del administrador */}
                        {dispute.admin_response && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">💼 Respuesta de Vence:</h4>
                            <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg border-l-4 border-green-400">
                              <p className="text-green-800 dark:text-green-300 text-sm whitespace-pre-wrap leading-relaxed">{dispute.admin_response}</p>
                              {dispute.resolved_at && (
                                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                  ✅ Resuelto el {new Date(dispute.resolved_at).toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'long', 
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              )}
                            </div>
                            
                            {/* Botones de satisfacción discretos - solo para impugnaciones normales que pueden apelar */}
                            {!dispute.isPsychometric && (dispute.status === 'resolved' || dispute.status === 'rejected') &&
                             dispute.appeal_text !== 'Usuario de acuerdo con la respuesta del administrador.' && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                  ¿Estás de acuerdo con esta respuesta?
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleDisputeSatisfaction(dispute, true)}
                                    className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                  >
                                    ✅ Sí, gracias
                                  </button>
                                  <button
                                    onClick={() => handleDisputeSatisfaction(dispute, false)}
                                    className="inline-flex items-center px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                                  >
                                    ❌ No, quiero apelar
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Mensaje de confirmación cuando usuario está de acuerdo */}
                            {!dispute.isPsychometric && (dispute.status === 'resolved' || dispute.status === 'rejected') &&
                             dispute.appeal_text === 'Usuario de acuerdo con la respuesta del administrador.' && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                  ✅ Marcado como resuelto satisfactoriamente
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Alegación si existe */}
                        {dispute.status === 'pending' && dispute.appeal_text && 
                         dispute.appeal_text !== 'Usuario de acuerdo con la respuesta del administrador.' && (
                          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                            <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                              📝 Tu Alegación
                            </h4>
                            <div className="text-sm text-orange-700 dark:text-orange-300">
                              {dispute.appeal_text}
                            </div>
                            <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                              ⏳ En revisión por Vence
                            </div>
                          </div>
                        )}

                        {/* Estado pendiente */}
                        {dispute.status === 'pending' && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg border-l-4 border-yellow-400">
                            <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                              ⏳ Tu impugnación está pendiente de revisión. Te notificaremos cuando sea procesada.
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}

          </div>
        </div>

        {/* Modal de Pregunta Completa */}
        {selectedQuestionModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedQuestionModal(null)
              }
            }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm sm:max-w-lg lg:max-w-3xl max-h-[90vh] overflow-y-auto">
              
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {selectedQuestionModal.isPsychometric ? '🧠 Pregunta Psicotécnica' : '📋 Pregunta Completa'}
                </h3>
                <button
                  onClick={() => setSelectedQuestionModal(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Contenido */}
              <div className="p-4 sm:p-6 space-y-6">

                {/* Badge de tipo de pregunta */}
                {selectedQuestionModal.isPsychometric && (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                      🧠 Pregunta Psicotécnica
                    </span>
                    {selectedQuestionModal.questions?.question_subtype && (
                      <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs">
                        {QUESTION_SUBTYPES[selectedQuestionModal.questions.question_subtype] || selectedQuestionModal.questions.question_subtype.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                )}

                {/* Pregunta */}
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">❓ Pregunta:</h4>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {selectedQuestionModal.questions?.question_text}
                    </p>
                  </div>
                </div>

                {/* Opciones - Para todas las preguntas que tengan opciones */}
                {selectedQuestionModal.questions?.option_a && (
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">📝 Opciones:</h4>
                    <div className="space-y-2">
                      {['A', 'B', 'C', 'D'].map((letter, index) => {
                        const isCorrect = selectedQuestionModal.questions?.correct_option === (index + 1)
                        const optionText = selectedQuestionModal.questions?.[`option_${letter.toLowerCase()}`]

                        if (!optionText) return null

                        return (
                          <div
                            key={letter}
                            className={`p-3 rounded-lg border-2 ${
                              isCorrect
                                ? 'bg-green-50 dark:bg-green-900/30 border-green-400 text-green-800 dark:text-green-200'
                                : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`font-bold text-sm ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                {letter})
                              </span>
                              <span className="flex-1">{optionText}</span>
                              {isCorrect && <span className="text-green-600 dark:text-green-400">✅</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Pasos de solución - Solo para psicotécnicas */}
                {selectedQuestionModal.isPsychometric && selectedQuestionModal.questions?.solution_steps && (
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">📐 Pasos de solución:</h4>
                    <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border-l-4 border-purple-400">
                      <div className="text-purple-800 dark:text-purple-200 leading-relaxed whitespace-pre-wrap text-sm">
                        {selectedQuestionModal.questions.solution_steps}
                      </div>
                    </div>
                  </div>
                )}

                {/* Explicación */}
                {selectedQuestionModal.questions?.explanation && (
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">💡 Explicación:</h4>
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border-l-4 border-blue-400">
                      <div className="text-blue-800 dark:text-blue-200 leading-relaxed whitespace-pre-wrap text-sm">
                        {selectedQuestionModal.questions.explanation}
                      </div>
                    </div>
                  </div>
                )}

                {/* Artículo (si existe) */}
                {selectedQuestionModal.questions?.articles && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200">📜 Artículo:</h4>
                      <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full">
                        🎯 Contiene respuesta
                      </span>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border-l-4 border-purple-400">
                      <p className="text-purple-800 dark:text-purple-200 font-medium mb-3">
                        {selectedQuestionModal.questions.articles.laws?.short_name} - Artículo {selectedQuestionModal.questions.articles.article_number}
                      </p>
                      
                      {selectedQuestionModal.questions.articles.content ? (
                        <div className="text-purple-700 dark:text-purple-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedQuestionModal.questions.articles.content}
                        </div>
                      ) : (
                        <div className="text-purple-600 dark:text-purple-400 text-sm italic">
                          ⚠️ El contenido del artículo no está disponible.
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* Modal de Chat */}
        {selectedConversation && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedConversation(null)
              }
            }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm sm:max-w-lg lg:max-w-2xl h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden">
              
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b dark:border-gray-700 bg-gradient-to-r from-blue-500 to-purple-600">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    💬 Chat de Soporte
                  </h3>
                  <p className="text-xs sm:text-sm text-blue-100 mt-1">
                    {selectedConversation.status === 'waiting_admin' ? '⏳ Esperando respuesta de nuestro equipo' : 
                     selectedConversation.status === 'waiting_user' ? '💬 Continúa la conversación' : 
                     'Chat activo'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Feedback original */}
              <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Original:
                </div>
                <div className="text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                  {renderMessageWithImages(feedbacks.find(f => f.id === selectedConversation.feedback_id)?.message)}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-25">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.is_admin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg ${
                      message.is_admin 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-green-600 text-white'
                    }`}>
                      <div className="text-sm mb-1 font-medium">
                        {message.is_admin ? '👨‍💼 Equipo Vence' : '👤 Tú'}
                      </div>
                      <div className="text-sm">{renderMessageWithImages(message.message)}</div>
                      <div className="text-xs mt-1 opacity-70">
                        {new Date(message.created_at).toLocaleString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          timeZone: 'Europe/Madrid'
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input para Usuario */}
              <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
                <form onSubmit={(e) => {
                  e.preventDefault()
                  if (newMessage.trim()) {
                    sendUserMessage(selectedConversation.id, newMessage)
                  }
                }} className="space-y-3">
                  
                  {/* Textarea con botones */}
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escribe tu mensaje..."
                      disabled={sendingMessage}
                      rows="3"
                      className="w-full p-3 pr-20 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50 resize-none"
                    />
                    
                    {/* Action buttons */}
                    <div className="absolute right-3 top-3 flex gap-2">
                      {/* Image upload button */}
                      <label className="cursor-pointer p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleImageUpload(file)
                            }
                            e.target.value = '' // Reset input
                          }}
                          disabled={uploadingImage}
                        />
                        {uploadingImage ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                        ) : (
                          <span className="text-lg">🖼️</span>
                        )}
                      </label>

                      {/* Emoji button */}
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        <span className="text-lg">😊</span>
                      </button>
                    </div>
                  </div>

                  {/* Emoji picker */}
                  {showEmojiPicker && (
                    <div className="emoji-picker-container bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-8 gap-1 text-xl">
                        {['😊', '😂', '😍', '😢', '😡', '👍', '👎', '❤️', '🎉', '🔥', '💡', '❌', '✅', '⚠️', '🤔', '😴'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Help text and send button */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Usa el botón de imagen para adjuntar imagen si lo deseas
                    </p>
                    <button
                      type="submit"
                      disabled={sendingMessage || !newMessage.trim()}
                      className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 focus:ring-4 focus:ring-blue-300 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                      {sendingMessage ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          <span>Enviar</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modal de Imagen Expandida */}
      {expandedImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setExpandedImage(null)
            }
          }}
        >
          <div className="relative max-w-5xl max-h-[90vh] overflow-auto">
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img 
              src={expandedImage} 
              alt="Imagen expandida"
              className="max-w-full max-h-full object-contain rounded-lg"
              style={{ maxHeight: 'calc(90vh - 2rem)' }}
            />
          </div>
        </div>
      )}

      {/* Modal de Feedback */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false)
          setInitialConversationId(null) // Resetear conversación pre-seleccionada
          // Recargar datos después de enviar feedback
          setTimeout(() => loadUserData(), 1000)
        }}
        initialConversationId={initialConversationId}
      />
    </div>
  )
}

export default function SoportePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando centro de soporte...</p>
        </div>
      </div>
    }>
      <SoporteContent />
    </Suspense>
  )
}