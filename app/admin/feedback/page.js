// app/admin/feedback/page.js - Panel de administración de soporte
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// Emoticonos populares para el chat admin
const EMOJIS = [
  '😀', '😂', '😊', '😍', '🤔', '😅', '😢', '😡', '😴', '🤗',
  '👍', '👎', '👏', '🙏', '💪', '👌', '✌️', '🤞', '🤝', '💯',
  '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '❓', '❗',
  '🎉', '🎊', '🔥', '💰', '📚', '✅', '❌', '⭐', '💡', '🚀'
]

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

export default function AdminFeedbackPage() {
  const { user, supabase } = useAuth()
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    dismissed: 0
  })
  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [adminResponse, setAdminResponse] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [conversations, setConversations] = useState({})
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [newUserMessages, setNewUserMessages] = useState(new Set()) // IDs de conversaciones con mensajes nuevos
  const [activeFilter, setActiveFilter] = useState('pending') // Filtro activo: 'all', 'pending', 'resolved', 'dismissed'
  const [viewedConversationsLoaded, setViewedConversationsLoaded] = useState(false) // Flag para saber si ya se inicializó
  
  // Estados para emojis e imágenes en admin
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [uploadedImages, setUploadedImages] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const messagesEndRef = useRef(null)

  // Función auxiliar para abrir chat y marcar como visto
  const openChatConversation = async (conversation) => {
    console.log('💬 Abriendo chat para conversación:', conversation.id)
    
    setSelectedConversation(conversation)
    setChatMessages([]) // Empezar con mensajes vacíos
    
    // Limpiar notificación si existía
    setNewUserMessages(prev => {
      const newSet = new Set(prev)
      newSet.delete(conversation.id)
      return newSet
    })
    
    // Marcar conversación como vista por admin en BD
    try {
      const response = await fetch('/api/admin/mark-conversation-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversation.id })
      })
      
      if (response.ok) {
        console.log('✅ Conversación marcada como vista en BD')
      } else {
        console.error('❌ Error marcando conversación como vista')
      }
    } catch (error) {
      console.error('❌ Error al marcar conversación como vista:', error)
    }
    
    // Marcar mensajes del usuario como leídos y luego cargar mensajes
    try {
      const response = await fetch('/api/admin/mark-messages-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversation.id })
      })
      
      if (response.ok) {
        console.log('✅ Mensajes marcados como leídos')
        // Cargar mensajes DESPUÉS de que se confirme la actualización
        await loadChatMessages(conversation.id)
      } else {
        console.error('❌ Error marcando mensajes como leídos')
        // Cargar mensajes de todos modos
        await loadChatMessages(conversation.id)
      }
    } catch (error) {
      console.error('❌ Error al marcar mensajes como leídos:', error)
      // Cargar mensajes de todos modos
      await loadChatMessages(conversation.id)
    }
  }

  useEffect(() => {
    if (user) {
      console.log('🔄 Cargando datos iniciales de feedback...')
      
      // Marcar como cargado - ya no usamos localStorage
      setViewedConversationsLoaded(true)
      
      loadFeedbacks()
      loadConversations()

      // 🔄 Suscripción real-time para cambios en feedback
      console.log('🔔 Configurando suscripción real-time para user_feedback...')
      const feedbackSubscription = supabase
        .channel('feedback_changes')
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'user_feedback'
          }, 
          (payload) => {
            console.log('🔄 Feedback actualizado en tiempo real:', payload.new)
            loadFeedbacks() // Recargar feedbacks cuando hay cambios
          }
        )
        .subscribe()

      return () => {
        console.log('🧹 Limpiando suscripción real-time...')
        feedbackSubscription.unsubscribe()
      }
    }
  }, [user, supabase])

  // Scroll automático al final cuando cambian los mensajes
  useEffect(() => {
    scrollToBottom()
  }, [chatMessages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const checkForNewUserMessages = useCallback(async () => {
    if (!viewedConversationsLoaded) {
      console.log('⏸️ Esperando inicialización antes de verificar notificaciones...')
      return
    }

    try {
      // Obtener conversaciones que tienen status 'waiting_admin' Y NO han sido vistas por admin
      const { data: waitingConversations, error: convError } = await supabase
        .from('feedback_conversations')
        .select('id, feedback_id, status, last_message_at')
        .eq('status', 'waiting_admin')
        .is('admin_viewed_at', null) // Solo las que NO han sido vistas

      if (convError) {
        // Si el campo admin_viewed_at no existe, usar fallback temporal
        if (convError.message && convError.message.includes('admin_viewed_at')) {
          console.log('⚠️ Campo admin_viewed_at no existe, usando conteo básico como fallback en admin panel')
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('feedback_conversations')
            .select('id, feedback_id, status, last_message_at')
            .eq('status', 'waiting_admin')
          
          if (fallbackError) {
            console.error('Error en fallback admin panel:', fallbackError)
            setNewUserMessages(new Set())
          } else {
            const unviewedIds = fallbackData?.map(conv => conv.id) || []
            console.log(`🔔 Conversaciones esperando admin (fallback): ${unviewedIds.length}`)
            setNewUserMessages(new Set(unviewedIds))
          }
        } else {
          console.error('Error verificando nuevos mensajes:', convError)
          setNewUserMessages(new Set())
        }
      } else {
        if (waitingConversations && waitingConversations.length > 0) {
          const unviewedIds = waitingConversations.map(conv => conv.id)
          console.log(`🔔 Conversaciones no vistas esperando admin: ${unviewedIds.length}`)
          
          const newSet = new Set(unviewedIds)
          setNewUserMessages(newSet)
        } else {
          // No hay conversaciones esperando, limpiar notificaciones
          console.log(`🧹 No hay conversaciones no vistas esperando admin`)
          setNewUserMessages(new Set())
        }
      }
    } catch (error) {
      console.error('Error verificando nuevos mensajes:', error)
      setNewUserMessages(new Set())
    }
  }, [supabase, viewedConversationsLoaded])

  // Polling para detectar nuevas respuestas de usuarios
  useEffect(() => {
    if (!user || !viewedConversationsLoaded) return

    // Ejecutar primera verificación inmediatamente
    checkForNewUserMessages()

    const interval = setInterval(async () => {
      checkForNewUserMessages()
      // 🔄 También recargar feedbacks para detectar cambios de estado (más frecuente)
      try {
        const { data, error } = await supabase
          .from('user_feedback')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        // Cargar perfiles de usuario para los feedbacks que tienen user_id
        const feedbacksWithProfiles = await loadUserProfiles(data || [])
        setFeedbacks(feedbacksWithProfiles)
        
        // Calcular estadísticas
        const stats = {
          total: data?.length || 0,
          pending: data?.filter(f => f.status === 'pending').length || 0,
          resolved: data?.filter(f => f.status === 'resolved').length || 0,
          dismissed: data?.filter(f => f.status === 'dismissed').length || 0
        }
        setStats(stats)
      } catch (error) {
        console.error('Error recargando feedbacks:', error)
      }
    }, 5000) // Verificar cada 5 segundos para detectar cambios más rápido

    return () => clearInterval(interval)
  }, [user, viewedConversationsLoaded, checkForNewUserMessages])

  // Función para cargar perfiles de usuario por separado
  const loadUserProfiles = async (feedbacks) => {
    if (!feedbacks || feedbacks.length === 0) return feedbacks

    try {
      // Obtener todos los user_ids únicos que no sean null
      const userIds = [...new Set(feedbacks.filter(f => f.user_id).map(f => f.user_id))]
      
      if (userIds.length === 0) return feedbacks

      // Cargar perfiles en lotes
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      if (error) {
        console.warn('⚠️ Error cargando perfiles de usuario:', error)
        return feedbacks
      }

      // Crear un mapa de profiles por user_id
      const profilesMap = new Map()
      if (profiles) {
        profiles.forEach(profile => {
          profilesMap.set(profile.id, profile)
        })
      }

      // Agregar los perfiles a los feedbacks
      return feedbacks.map(feedback => ({
        ...feedback,
        user_profiles: feedback.user_id ? profilesMap.get(feedback.user_id) || null : null
      }))

    } catch (error) {
      console.error('❌ Error en loadUserProfiles:', error)
      return feedbacks
    }
  }

  const loadFeedbacks = useCallback(async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Cargar perfiles de usuario para los feedbacks que tienen user_id
      const feedbacksWithProfiles = await loadUserProfiles(data || [])
      setFeedbacks(feedbacksWithProfiles)
      
      // Calcular estadísticas
      const stats = {
        total: data?.length || 0,
        pending: data?.filter(f => f.status === 'pending').length || 0,
        resolved: data?.filter(f => f.status === 'resolved').length || 0,
        dismissed: data?.filter(f => f.status === 'dismissed').length || 0
      }
      setStats(stats)

    } catch (error) {
      console.error('Error cargando feedbacks:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_conversations')
        .select(`
          *,
          feedback:user_feedback(*)
        `)
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
    
    // Verificar notificaciones después de cargar conversaciones
    await checkForNewUserMessages()
  }

  const loadChatMessages = async (conversationId) => {
    try {
      const { data, error } = await supabase
        .from('feedback_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          is_admin,
          message,
          created_at,
          read_at,
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

  const sendAdminMessage = async (conversationId, message) => {
    try {
      // Primero verificar el estado actual de la conversación Y el feedback asociado
      const { data: currentConv } = await supabase
        .from('feedback_conversations')
        .select('status, feedback_id')
        .eq('id', conversationId)
        .single()

      // Verificar estado del feedback asociado (más importante que el estado de la conversación)
      let feedbackNeedsReopening = false
      if (currentConv?.feedback_id) {
        const { data: feedbackData } = await supabase
          .from('user_feedback')
          .select('status')
          .eq('id', currentConv.feedback_id)
          .single()
        
        feedbackNeedsReopening = feedbackData?.status === 'resolved' || feedbackData?.status === 'dismissed'
        console.log(`🔍 Estado del feedback: ${feedbackData?.status}`)
      }
      
      // Verificar si necesita reabrir (conversación cerrada O feedback resuelto)
      const conversationNeedsReopening = currentConv?.status === 'closed' || 
                                        currentConv?.status === 'resolved' ||
                                        currentConv?.status === 'dismissed'
      
      const needsReopening = conversationNeedsReopening || feedbackNeedsReopening
      
      console.log(`🔍 Estado actual de conversación: ${currentConv?.status}`)
      console.log(`🔍 Conversación necesita reabrirse: ${conversationNeedsReopening}`)
      console.log(`🔍 Feedback necesita reabrirse: ${feedbackNeedsReopening}`)
      console.log(`🔍 Acción final - Necesita reabrirse: ${needsReopening}`)
      
      const { error } = await supabase
        .from('feedback_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          is_admin: true,
          message: message.trim()
        })

      if (error) throw error

      // Actualizar conversación - siempre reabrir si estaba cerrada o resuelta
      await supabase
        .from('feedback_conversations')
        .update({ 
          status: 'waiting_user',
          last_message_at: new Date().toISOString(),
          admin_user_id: user.id
        })
        .eq('id', conversationId)

      // Si la conversación estaba cerrada/resuelta, también reabrir el feedback
      if (needsReopening && currentConv?.feedback_id) {
        console.log('🔄 Reabriendo feedback asociado...')
        const { error: feedbackError } = await supabase
          .from('user_feedback')
          .update({ 
            status: 'pending', // Volver a pendiente para que aparezca en la lista
            resolved_at: null  // Limpiar fecha de resolución
          })
          .eq('id', currentConv.feedback_id)
        
        if (feedbackError) {
          console.error('❌ Error reabriendo feedback:', feedbackError)
        } else {
          console.log('✅ Feedback reabierto y marcado como pendiente')
        }
      }

      // Mostrar mensaje si se reabrió la conversación
      if (needsReopening) {
        console.log('🔄 Conversación reabierta automáticamente')
      }

      // Crear notificación para el usuario
      const conversation = await supabase
        .from('feedback_conversations')
        .select('user_id, feedback_id')
        .eq('id', conversationId)
        .single()

      if (conversation.data?.user_id) {
        console.log('💬 Creando notificación de feedback response para user:', conversation.data.user_id)
        
        // Crear preview del mensaje (primeras 100 caracteres)
        const messagePreview = message.length > 100 
          ? message.substring(0, 100) + '...' 
          : message
        
        const { data: notifResult, error: notifError } = await supabase
          .from('notification_logs')
          .insert({
            user_id: conversation.data.user_id,
            message_sent: `El equipo de Vence: "${messagePreview}"`,
            delivery_status: 'sent',
            context_data: { 
              type: 'feedback_response',
              title: 'Nueva respuesta de Vence',
              conversation_id: conversationId,
              feedback_id: conversation.data.feedback_id
            }
          })
          .select()

        if (notifError) {
          console.error('❌ Error creando notificación:', notifError)
          console.error('❌ Detalles del error:', {
            code: notifError.code,
            message: notifError.message,
            details: notifError.details,
            hint: notifError.hint
          })
        } else {
          console.log('✅ Notificación creada exitosamente:', notifResult)
        }
      }

      // Enviar email si el usuario no está online
      try {
        const emailResponse = await fetch('/api/send-support-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: conversation.data.user_id,
            adminMessage: message.trim(),
            conversationId: conversationId
          })
        })
        
        const emailResult = await emailResponse.json()
        
        
        if (!emailResult.sent) {
          console.log(`📧 Email no enviado:`, emailResult)
        }
      } catch (emailError) {
        console.error('❌ Error enviando email de soporte:', emailError)
        // No fallar toda la operación por un error de email
      }

      // Recargar mensajes, conversaciones Y feedbacks para reflejar cambios
      await loadChatMessages(conversationId)
      await loadConversations()
      await loadFeedbacks() // 🔄 IMPORTANTE: Recargar feedbacks para ver estado actualizado
    } catch (error) {
      console.error('Error enviando mensaje:', error)
    }
  }

  const updateFeedbackStatus = async (feedbackId, newStatus, response = null) => {
    try {
      setUpdatingStatus(true)
      
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }
      
      if (response) {
        // Preparar respuesta con imágenes
        let responseWithImages = response
        if (uploadedImages.length > 0) {
          responseWithImages += '\n\n📸 Imágenes adjuntas:\n'
          uploadedImages.forEach((img, index) => {
            responseWithImages += `${index + 1}. ${img.name}: ${img.url}\n`
          })
        }
        updateData.admin_response = responseWithImages
        // Nota: attachments se incluyen en el texto de la respuesta, no como columna separada
        updateData.admin_user_id = user.id
      }
      
      if (newStatus === 'resolved' || newStatus === 'dismissed') {
        updateData.resolved_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('user_feedback')
        .update(updateData)
        .eq('id', feedbackId)

      if (error) throw error

      // Recargar feedbacks
      await loadFeedbacks()
      setSelectedFeedback(null)
      setAdminResponse('')
      setUploadedImages([])
      setShowEmojiPicker(false)

    } catch (error) {
      console.error('Error actualizando feedback:', error)
      alert('Error actualizando el feedback')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const startChatWithUser = async (feedback) => {
    try {
      console.log('🚀 Iniciando chat con usuario para feedback:', feedback.id)
      
      // Crear la conversación
      const { data: conversation, error: convError } = await supabase
        .from('feedback_conversations')
        .insert({
          feedback_id: feedback.id,
          user_id: feedback.user_id,
          status: 'waiting_admin',
          admin_id: user.id,
          started_by_admin: true
        })
        .select()
        .single()

      if (convError) throw convError

      console.log('✅ Conversación creada:', conversation.id)
      
      // Recargar conversaciones para mostrar la nueva
      await loadConversations()
      
      // Abrir el chat inmediatamente usando la función unificada
      await openChatConversation(conversation)
      
    } catch (error) {
      console.error('❌ Error iniciando chat:', error)
      alert('Error iniciando el chat con el usuario')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando feedbacks...</p>
        </div>
      </div>
    )
  }

  // Función para filtrar feedbacks según el filtro activo
  const getFilteredFeedbacks = () => {
    if (activeFilter === 'all') return feedbacks
    return feedbacks.filter(feedback => feedback.status === activeFilter)
  }

  // Función para manejar click en tarjetas de estadísticas
  const handleFilterClick = (filterType) => {
    setActiveFilter(filterType === activeFilter ? 'all' : filterType)
  }

  // Función para insertar emoji en adminResponse
  const insertEmoji = (emoji) => {
    const currentMessage = adminResponse
    const cursorPosition = currentMessage.length // Insertar al final por simplicidad
    const newMessage = currentMessage.slice(0, cursorPosition) + emoji + currentMessage.slice(cursorPosition)
    setAdminResponse(newMessage)
    setShowEmojiPicker(false)
  }

  // Función para subir imagen desde admin
  const handleImageUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen')
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede ser mayor a 5MB')
      return
    }

    setUploadingImage(true)

    try {
      // Crear nombre único para el archivo
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `admin-chat-images/${fileName}`

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
      alert('Error al subir la imagen. Inténtalo de nuevo.')
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
                🎧 Gestión de Soporte
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Sistema de tickets para atención al usuario
                {activeFilter !== 'all' && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                    Filtro: {
                      activeFilter === 'pending' ? 'Pendientes' :
                      activeFilter === 'resolved' ? 'Cerrados' :
                      activeFilter === 'dismissed' ? 'Descartados' : ''
                    }
                  </span>
                )}
              </p>
            </div>
            {newUserMessages.size > 0 && (
              <div className="bg-red-500 text-white px-3 py-2 rounded-lg animate-pulse text-sm self-start sm:self-auto">
                <span className="font-bold">{newUserMessages.size}</span> mensaje{newUserMessages.size > 1 ? 's' : ''} nuevo{newUserMessages.size > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Estadísticas - Filtros Clickeables */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-8">
          {/* Total */}
          <button
            onClick={() => handleFilterClick('all')}
            className={`p-3 sm:p-6 rounded-lg shadow transition-all hover:shadow-md ${
              activeFilter === 'all' 
                ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500' 
                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total</div>
            {activeFilter === 'all' && <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">✓ Filtro activo</div>}
          </button>
          
          {/* Pendientes */}
          <button
            onClick={() => handleFilterClick('pending')}
            className={`p-3 sm:p-6 rounded-lg shadow transition-all hover:shadow-md ${
              activeFilter === 'pending' 
                ? 'bg-yellow-100 dark:bg-yellow-900/50 ring-2 ring-yellow-500' 
                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Pendientes</div>
            {activeFilter === 'pending' && <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">✓ Filtro activo</div>}
          </button>
          
          {/* Cerrados */}
          <button
            onClick={() => handleFilterClick('resolved')}
            className={`p-3 sm:p-6 rounded-lg shadow transition-all hover:shadow-md ${
              activeFilter === 'resolved' 
                ? 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-500' 
                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Cerrados</div>
            {activeFilter === 'resolved' && <div className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Filtro activo</div>}
          </button>
          
          {/* Descartados */}
          <button
            onClick={() => handleFilterClick('dismissed')}
            className={`p-3 sm:p-6 rounded-lg shadow transition-all hover:shadow-md ${
              activeFilter === 'dismissed' 
                ? 'bg-gray-200 dark:bg-gray-700 ring-2 ring-gray-500' 
                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.dismissed}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Descartados</div>
            {activeFilter === 'dismissed' && <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">✓ Filtro activo</div>}
          </button>
        </div>

        {/* Lista de Feedbacks */}
        {getFilteredFeedbacks().length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {activeFilter === 'all' ? 'No hay tickets' : `No hay tickets ${
                activeFilter === 'pending' ? 'pendientes' :
                activeFilter === 'resolved' ? 'cerrados' :
                activeFilter === 'dismissed' ? 'descartados' : ''
              }`}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {activeFilter === 'all' 
                ? 'Los tickets de soporte aparecerán aquí'
                : 'No se encontraron tickets con este filtro'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {getFilteredFeedbacks().map((feedback) => (
              <div 
                key={feedback.id} 
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow p-4 sm:p-6"
              >
                
                {/* Header del feedback */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${FEEDBACK_TYPES[feedback.type]?.color || 'bg-gray-100 text-gray-800'}`}>
                      {FEEDBACK_TYPES[feedback.type]?.label || feedback.type}
                    </span>
                    <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${STATUS_CONFIG[feedback.status]?.color}`}>
                      {STATUS_CONFIG[feedback.status]?.label}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
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

                {/* Usuario */}
                <div className="mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    👤 {feedback.user_profiles?.full_name || 'Usuario anónimo'} 
                    {feedback.user_profiles?.full_name && feedback.user_profiles?.email && (
                      <span className="text-gray-500 dark:text-gray-400 font-normal">
                        ({feedback.user_profiles.email})
                      </span>
                    )}
                    {!feedback.user_profiles?.full_name && feedback.email && (
                      <span className="text-gray-500 dark:text-gray-400 font-normal">
                        {feedback.email}
                      </span>
                    )}
                  </span>
                  {feedback.wants_response && (
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                      📧 Quiere respuesta
                    </span>
                  )}
                </div>

                {/* Mensaje */}
                <div className="mb-4">
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                    {feedback.message}
                  </p>
                </div>

                {/* URL */}
                <div className="mb-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    📍 <a href={feedback.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {feedback.url}
                    </a>
                  </span>
                </div>

                {/* Respuesta admin */}
                {feedback.admin_response && (
                  <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-400">
                    <div className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
                      👨‍💼 Respuesta del administrador:
                    </div>
                    <p className="text-green-700 dark:text-green-400">
                      {feedback.admin_response}
                    </p>
                  </div>
                )}

                {/* Acciones */}
                {feedback.status === 'pending' && (
                  <div className="flex flex-wrap gap-2 pt-4 border-t dark:border-gray-700">
                    {/* Botón de Chat - Prioridad */}
                    {conversations[feedback.id] ? (
                      <button
                        onClick={() => openChatConversation(conversations[feedback.id])}
                        className={`px-3 sm:px-4 py-2 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium ${
                          newUserMessages.has(conversations[feedback.id].id)
                            ? 'bg-orange-600 hover:bg-orange-700 animate-pulse'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        <span className="sm:hidden">💬</span>
                        <span className="hidden sm:inline">💬 Ver Chat</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => startChatWithUser(feedback)}
                        className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium"
                      >
                        <span className="sm:hidden">💬</span>
                        <span className="hidden sm:inline">💬 Iniciar Chat</span>
                      </button>
                    )}
                    
                    {/* Respuesta rápida solo si no hay conversación activa */}
                    {!conversations[feedback.id] && (
                      // Botón de respuesta rápida para feedbacks sin conversación
                      <>
                        <button
                          onClick={() => setSelectedFeedback(feedback)}
                          className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium"
                        >
                          <span className="sm:hidden">📝</span>
                          <span className="hidden sm:inline">📝 Respuesta</span>
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Botones de Chat para feedbacks resueltos/descartados */}
                {feedback.status !== 'pending' && (
                  <div className="flex gap-2 pt-4 border-t dark:border-gray-700">
                    {conversations[feedback.id] ? (
                      <button
                        onClick={() => openChatConversation(conversations[feedback.id])}
                        className={`px-3 sm:px-4 py-2 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium ${
                          newUserMessages.has(conversations[feedback.id].id)
                            ? 'bg-orange-600 hover:bg-orange-700 animate-pulse'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        <span className="sm:hidden">💬</span>
                        <span className="hidden sm:inline">💬 Ver Chat</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => startChatWithUser(feedback)}
                        className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium"
                      >
                        <span className="sm:hidden">💬</span>
                        <span className="hidden sm:inline">💬 Iniciar Chat</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal de respuesta */}
        {selectedFeedback && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b dark:border-gray-700">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                  💬 Responder Ticket
                </h3>
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Contenido */}
              <div className="p-4 sm:p-6">
                
                {/* Solicitud original */}
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    📋 Solicitud de soporte:
                  </div>
                  <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200">
                    {selectedFeedback.message}
                  </p>
                </div>

                {/* Textarea de respuesta */}
                <div className="mb-4 sm:mb-6">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tu respuesta:
                  </label>
                  
                  {/* Vista previa de imágenes subidas */}
                  {uploadedImages.length > 0 && (
                    <div className="mb-3">
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
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <textarea
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      placeholder="Escribe tu respuesta al usuario... (Usa Enter para saltos de línea)"
                      rows={4}
                      className="w-full p-3 pr-20 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                      style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}
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
                </div>

                {/* Botones */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setSelectedFeedback(null)}
                    disabled={updatingStatus}
                    className="px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => updateFeedbackStatus(selectedFeedback.id, 'resolved', adminResponse)}
                    disabled={updatingStatus || !adminResponse.trim()}
                    className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium text-sm sm:text-base"
                  >
                    {updatingStatus ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        <span className="hidden sm:inline">Guardando...</span>
                        <span className="sm:hidden">...</span>
                      </span>
                    ) : (
                      <>
                        <span className="hidden sm:inline">✅ Resolver y Responder</span>
                        <span className="sm:hidden">✅ Resolver</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Chat */}
        {selectedConversation && (
          <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:w-96 sm:max-w-md h-[70vh] sm:h-[75vh] flex flex-col">
              
              {/* Header */}
              <div className="flex items-center justify-between p-2 sm:p-4 border-b dark:border-gray-700 flex-shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                    💬 Chat de Soporte
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 truncate">
                    {(() => {
                      const feedback = feedbacks.find(f => f.id === selectedConversation.feedback_id)
                      const userName = feedback?.user_profiles?.full_name || 'Usuario anónimo'
                      const userEmail = feedback?.user_profiles?.email || feedback?.email
                      return `👤 ${userName}${userEmail ? ` (${userEmail})` : ''}`
                    })()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 truncate">
                    Estado: {selectedConversation.status === 'waiting_admin' ? '⏳ Esperando tu respuesta' : 
                             selectedConversation.status === 'waiting_user' ? '💬 Esperando usuario' : 
                             selectedConversation.status}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 sm:p-2 rounded-lg transition-colors flex-shrink-0 ml-2"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Solicitud original */}
              <div className="p-2 sm:p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 flex-shrink-0">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  📋 Solicitud de soporte:
                </div>
                <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2">
                  {feedbacks.find(f => f.id === selectedConversation.feedback_id)?.message}
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 sm:space-y-3 bg-gray-25 min-h-0">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.is_admin ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[240px] sm:max-w-[280px] lg:max-w-md px-2 sm:px-3 py-2 rounded-lg ${
                      message.is_admin 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                    }`}>
                      <div className="text-xs sm:text-sm mb-1 font-medium">
                        {message.is_admin ? '👨‍💼 Tú (Admin)' : `👤 ${message.sender?.full_name || message.sender?.email || 'Usuario'}`}
                      </div>
                      <p className="text-xs sm:text-sm">{message.message}</p>
                      <div className="flex items-center justify-between text-xs mt-1 opacity-70">
                        <span>
                          {new Date(message.created_at).toLocaleString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                            timeZone: 'Europe/Madrid'
                          })}
                        </span>
                        {/* Ticks de leído - solo para mensajes del usuario */}
                        {!message.is_admin && (
                          <span className="ml-2" title={message.read_at ? `Leído: ${new Date(message.read_at).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'No leído'}>
                            {message.read_at ? (
                              <span className="text-blue-400">✓✓</span>
                            ) : (
                              <span className="text-gray-400">✓</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input para Admin estilo WhatsApp */}
              <div className="p-2 sm:p-4 border-t dark:border-gray-700 flex-shrink-0">
                
                {/* Vista previa de imágenes del chat */}
                {uploadedImages.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-2">
                      {uploadedImages.map((image) => (
                        <div key={image.id} className="relative group">
                          <img
                            src={image.url}
                            alt={image.name}
                            className="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(image.id, image.path)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title={`Eliminar ${image.name}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={(e) => {
                  e.preventDefault()
                  const message = e.target.message.value.trim()
                  if (message || uploadedImages.length > 0) {
                    // Preparar mensaje con imágenes
                    let messageWithImages = message
                    if (uploadedImages.length > 0) {
                      messageWithImages += '\n\n📸 Imágenes adjuntas:\n'
                      uploadedImages.forEach((img, index) => {
                        messageWithImages += `${index + 1}. ${img.name}: ${img.url}\n`
                      })
                    }
                    sendAdminMessage(selectedConversation.id, messageWithImages)
                    e.target.message.value = ''
                    setUploadedImages([])
                    setShowEmojiPicker(false)
                  }
                }}>
                  <div className="relative">
                    <div className="flex gap-2 sm:gap-3 items-end">
                      {/* Botones de acción fuera del input - estilo WhatsApp */}
                      <div className="flex gap-1 pb-2">
                        {/* Botón de Subir Imagen */}
                        <label className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer" title="Subir imagen">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={uploadingImage}
                          />
                          {uploadingImage ? (
                            <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                        </label>
                        
                        {/* Botón de Emojis */}
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-600"
                          title="Añadir emoji"
                        >
                          <span className="text-lg">😊</span>
                        </button>
                      </div>
                      
                      <div className="flex-1 relative">
                        <textarea
                          name="message"
                          placeholder="Escribe tu respuesta... (Ctrl+Enter para enviar)"
                          rows={3}
                          className="w-full p-3 sm:p-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm sm:text-base resize-none overflow-hidden"
                          style={{ 
                            whiteSpace: 'pre-wrap', 
                            lineHeight: '1.5',
                            minHeight: '60px',
                            maxHeight: '150px'
                          }}
                          onKeyDown={(e) => {
                            // Enviar con Ctrl/Cmd + Enter
                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                              e.preventDefault()
                              e.target.form.requestSubmit()
                            }
                          }}
                          onInput={(e) => {
                            // Auto-resize textarea
                            e.target.style.height = 'auto'
                            const scrollHeight = e.target.scrollHeight
                            const maxHeight = 150
                            const minHeight = 60
                            e.target.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`
                          }}
                        />
                      </div>
                        
                      {/* Selector de Emojis */}
                      {showEmojiPicker && (
                        <div className="absolute bottom-16 left-0 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 z-50 w-64 max-h-40 overflow-y-auto">
                            <div className="grid grid-cols-8 gap-1">
                              {EMOJIS.map((emoji, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    const textarea = document.querySelector('textarea[name="message"]')
                                    if (textarea) {
                                      const cursorPosition = textarea.selectionStart
                                      const currentValue = textarea.value
                                      const newValue = currentValue.slice(0, cursorPosition) + emoji + currentValue.slice(cursorPosition)
                                      textarea.value = newValue
                                      textarea.focus()
                                      textarea.setSelectionRange(cursorPosition + emoji.length, cursorPosition + emoji.length)
                                    }
                                    setShowEmojiPicker(false)
                                  }}
                                  className="p-1 text-lg hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                                  title={`Insertar ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                        </div>
                      )}
                      
                      {/* Botón enviar estilo WhatsApp */}
                      <button
                        type="submit"
                        className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex-shrink-0"
                        title="Enviar mensaje (Ctrl+Enter)"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </form>
                
                {/* Botón para resolver y cerrar */}
                <div className="mt-3 pt-3 border-t dark:border-gray-600">
                  <button
                    onClick={() => {
                      if (confirm('¿Cerrar este chat de soporte?')) {
                        // Cerrar conversación
                        supabase
                          .from('feedback_conversations')
                          .update({ status: 'closed' })
                          .eq('id', selectedConversation.id)
                          .then(() => {
                            console.log('💬 Conversación cerrada')
                            // Marcar feedback como resuelto
                            return supabase
                              .from('user_feedback')
                              .update({ 
                                status: 'resolved',
                                resolved_at: new Date().toISOString()
                              })
                              .eq('id', selectedConversation.feedback_id)
                          })
                          .then(() => {
                            console.log('✅ Feedback marcado como resuelto')
                            setSelectedConversation(null)
                            loadConversations()
                            loadFeedbacks()
                          })
                          .catch(error => {
                            console.error('Error:', error)
                            alert('Error al cerrar la conversación')
                          })
                      }
                    }}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium"
                  >
                    <span className="hidden sm:inline">✅ Cerrar Chat de Soporte</span>
                    <span className="sm:hidden">✅ Cerrar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}