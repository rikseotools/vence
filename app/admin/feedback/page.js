// app/admin/feedback/page.js - Panel de administración de soporte
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@supabase/supabase-js'

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
  const [selectedUser, setSelectedUser] = useState(null) // Usuario seleccionado para ver sus conversaciones
  const [usersWithConversations, setUsersWithConversations] = useState([]) // Lista de usuarios agrupados
  const [inlineChatMessages, setInlineChatMessages] = useState([]) // Mensajes del chat inline
  const [inlineNewMessage, setInlineNewMessage] = useState('') // Mensaje nuevo para el chat inline
  const [sendingInlineMessage, setSendingInlineMessage] = useState(false) // Enviando mensaje inline
  const [viewedConversationsLoaded, setViewedConversationsLoaded] = useState(false) // Flag para saber si ya se inicializó
  const [expandedImage, setExpandedImage] = useState(null) // Estado para modal de imagen expandida
  const [userProfilesCache, setUserProfilesCache] = useState(new Map()) // Cache de perfiles de usuario
  
  // Estados para emojis e imágenes en admin
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [uploadedImages, setUploadedImages] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const messagesEndRef = useRef(null)
  const chatTextareaRef = useRef(null)

  // Estado para otras conversaciones del mismo usuario
  const [userOtherConversations, setUserOtherConversations] = useState([])

  // Efecto para cerrar modal de imagen con ESC
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && expandedImage) {
        setExpandedImage(null)
      }
    }

    if (expandedImage) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevenir scroll del body cuando el modal está abierto
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [expandedImage])

  // Función para cargar otras conversaciones del mismo usuario
  const loadUserOtherConversations = async (userId, currentConversationId) => {
    if (!userId) {
      console.log('⚠️ No hay user_id, no se pueden cargar otras conversaciones')
      setUserOtherConversations([])
      return
    }

    try {
      console.log('🔍 Cargando otras conversaciones del usuario:', userId)

      const { data, error } = await supabase
        .from('feedback_conversations')
        .select(`
          *,
          feedback:user_feedback(id, message, type, created_at, status)
        `)
        .eq('user_id', userId)
        .neq('id', currentConversationId) // Excluir la conversación actual
        .order('last_message_at', { ascending: false })
        .limit(10)

      if (error) throw error

      console.log(`📂 Otras conversaciones del usuario: ${data?.length || 0}`)
      setUserOtherConversations(data || [])
    } catch (error) {
      console.error('❌ Error cargando otras conversaciones del usuario:', error)
      setUserOtherConversations([])
    }
  }

  // Función auxiliar para abrir chat y marcar como visto
  const openChatConversation = async (conversation) => {
    console.log('💬 Abriendo chat para conversación:', conversation.id)

    setSelectedConversation(conversation)
    setChatMessages([]) // Empezar con mensajes vacíos

    // Cargar otras conversaciones del mismo usuario
    loadUserOtherConversations(conversation.user_id, conversation.id)
    
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

  // Agrupar usuarios cuando cambian feedbacks o conversaciones
  useEffect(() => {
    if (feedbacks.length > 0) {
      const grouped = groupFeedbacksByUser(feedbacks, conversations)
      setUsersWithConversations(grouped)
      console.log('👥 Usuarios agrupados:', grouped.length)
    }
  }, [feedbacks, conversations])

  // Cargar mensajes del chat inline cuando se selecciona un feedback
  useEffect(() => {
    const loadInlineChatMessages = async () => {
      if (!selectedFeedback || !selectedUser) {
        setInlineChatMessages([])
        return
      }

      const conversation = conversations[selectedFeedback.id]
      if (!conversation) {
        setInlineChatMessages([])
        return
      }

      try {
        const { data, error } = await supabase
          .from('feedback_messages')
          .select('*')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true })

        if (error) throw error
        setInlineChatMessages(data || [])
        console.log('💬 Mensajes inline cargados:', data?.length || 0)

        // Marcar como leído
        if (newUserMessages.has(conversation.id)) {
          await supabase
            .from('feedback_conversations')
            .update({ admin_viewed_at: new Date().toISOString() })
            .eq('id', conversation.id)

          setNewUserMessages(prev => {
            const newSet = new Set(prev)
            newSet.delete(conversation.id)
            return newSet
          })
        }
      } catch (error) {
        console.error('❌ Error cargando mensajes inline:', error)
      }
    }

    loadInlineChatMessages()
  }, [selectedFeedback, selectedUser, conversations])

  // Función para enviar mensaje inline
  const sendInlineMessage = async () => {
    if (!inlineNewMessage.trim() || !selectedFeedback || sendingInlineMessage) return

    setSendingInlineMessage(true)
    try {
      let conversation = conversations[selectedFeedback.id]

      // Si no hay conversación, crear una
      if (!conversation) {
        const { data: newConv, error: convError } = await supabase
          .from('feedback_conversations')
          .insert({
            feedback_id: selectedFeedback.id,
            user_id: selectedFeedback.user_id,
            status: 'waiting_user',
            last_message_at: new Date().toISOString()
          })
          .select()
          .single()

        if (convError) throw convError
        conversation = newConv

        // Actualizar el mapa de conversaciones
        setConversations(prev => ({
          ...prev,
          [selectedFeedback.id]: conversation
        }))
      }

      // Enviar el mensaje
      const { data: newMsg, error: msgError } = await supabase
        .from('feedback_messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          is_admin: true,
          message: inlineNewMessage.trim()
        })
        .select()
        .single()

      if (msgError) throw msgError

      // Actualizar estado de la conversación
      await supabase
        .from('feedback_conversations')
        .update({
          status: 'waiting_user',
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversation.id)

      // Actualizar feedback a in_review si estaba pending
      if (selectedFeedback.status === 'pending') {
        await supabase
          .from('user_feedback')
          .update({ status: 'in_review' })
          .eq('id', selectedFeedback.id)
      }

      // Añadir mensaje a la lista
      setInlineChatMessages(prev => [...prev, newMsg])
      setInlineNewMessage('')

      // Recargar datos
      loadConversations()
      loadFeedbacks()

      console.log('✅ Mensaje inline enviado')
    } catch (error) {
      console.error('❌ Error enviando mensaje inline:', error)
      alert('Error al enviar el mensaje')
    } finally {
      setSendingInlineMessage(false)
    }
  }

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
      
      console.log(`🔍 Cargando perfiles para ${userIds.length} usuarios únicos`)
      console.log('📋 User IDs específicos:', userIds)
      
      // Debug específico para Ismael
      const hasIsmaelId = userIds.includes('7f40b5c7-c52f-4c1f-9d30-db7a49c57f43')
      console.log('🎯 ¿Incluye ID de Ismael?', hasIsmaelId)

      if (userIds.length === 0) {
        console.log('ℹ️ No hay user_ids para cargar perfiles')
        return feedbacks
      }

      // Cargar perfiles en lotes CON SERVICE ROLE (bypassa RLS automáticamente)
      const supabaseServiceRole = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
      )
      
      const { data: profiles, error } = await supabaseServiceRole
        .from('user_profiles')
        .select('id, full_name, email, plan_type, registration_date, created_at, target_oposicion, is_active_student, ciudad')
        .in('id', userIds)

      if (error) {
        console.warn('⚠️ Error cargando perfiles de usuario:', error)
        return feedbacks
      }

      console.log(`✅ Perfiles cargados: ${profiles?.length || 0}/${userIds.length}`)
      console.log('📝 IDs de perfiles obtenidos:', profiles?.map(p => p.id) || [])

      // Cargar última sesión de cada usuario para obtener info de dispositivo
      const { data: sessions, error: sessionsError } = await supabaseServiceRole
        .from('user_sessions')
        .select('user_id, browser_name, operating_system, device_model, user_agent, session_start')
        .in('user_id', userIds)
        .order('session_start', { ascending: false })

      // Función para parsear user_agent y extraer info útil
      const parseUserAgent = (ua) => {
        if (!ua) return { browser: null, os: null }

        let browser = null
        let os = null

        // Detectar navegador
        if (ua.includes('Edg/')) browser = 'Edge'
        else if (ua.includes('Chrome/')) browser = 'Chrome'
        else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari'
        else if (ua.includes('Firefox/')) browser = 'Firefox'
        else if (ua.includes('Opera/') || ua.includes('OPR/')) browser = 'Opera'

        // Detectar SO/dispositivo
        if (ua.includes('iPhone')) os = 'iPhone'
        else if (ua.includes('iPad')) os = 'iPad'
        else if (ua.includes('Android')) os = 'Android'
        else if (ua.includes('Windows')) os = 'Windows'
        else if (ua.includes('Mac OS')) os = 'Mac'
        else if (ua.includes('Linux')) os = 'Linux'

        return { browser, os }
      }

      // Crear mapa de última sesión por usuario
      const sessionsMap = new Map()
      if (!sessionsError && sessions) {
        sessions.forEach(session => {
          // Solo guardar la primera (más reciente) por usuario
          if (!sessionsMap.has(session.user_id)) {
            // Parsear user_agent si los campos están vacíos
            const parsed = parseUserAgent(session.user_agent)
            sessionsMap.set(session.user_id, {
              ...session,
              browser_name: session.browser_name || parsed.browser,
              operating_system: session.operating_system || parsed.os
            })
          }
        })
        console.log(`📱 Sesiones de dispositivo cargadas: ${sessionsMap.size}`)
      }

      // Crear un mapa de profiles por user_id y actualizar cache
      const profilesMap = new Map()
      if (profiles) {
        profiles.forEach(profile => {
          // Agregar info de dispositivo al perfil
          const lastSession = sessionsMap.get(profile.id)
          const profileWithDevice = {
            ...profile,
            browserName: lastSession?.browser_name,
            operatingSystem: lastSession?.operating_system,
            deviceModel: lastSession?.device_model
          }
          profilesMap.set(profile.id, profileWithDevice)
          console.log(`📝 Perfil cargado: ${profile.full_name || profile.email || profile.id}`)
        })

        // Actualizar cache global
        setUserProfilesCache(prevCache => {
          const newCache = new Map(prevCache)
          profiles.forEach(profile => {
            const lastSession = sessionsMap.get(profile.id)
            newCache.set(profile.id, {
              ...profile,
              browserName: lastSession?.browser_name,
              operatingSystem: lastSession?.operating_system,
              deviceModel: lastSession?.device_model
            })
          })
          return newCache
        })
      }

      // Debug: Log de usuarios que no tienen perfil
      const missingProfiles = userIds.filter(id => !profilesMap.has(id))
      if (missingProfiles.length > 0) {
        console.warn(`⚠️ Usuarios sin perfil: ${missingProfiles.length}`, missingProfiles)
      }

      // Agregar los perfiles a los feedbacks
      return feedbacks.map(feedback => {
        const profile = feedback.user_id ? profilesMap.get(feedback.user_id) || null : null
        return {
          ...feedback,
          user_profiles: profile
        }
      })

    } catch (error) {
      console.error('❌ Error en loadUserProfiles:', error)
      return feedbacks
    }
  }

  // Función para agrupar feedbacks por usuario
  const groupFeedbacksByUser = (feedbacksList, conversationsMap) => {
    const usersMap = new Map()

    feedbacksList.forEach(feedback => {
      // Usar email como key si no hay user_id
      const userKey = feedback.user_id || feedback.email || 'anonymous'

      if (!usersMap.has(userKey)) {
        const profile = feedback.user_profiles
        usersMap.set(userKey, {
          id: feedback.user_id,
          email: feedback.email || profile?.email,
          name: profile?.full_name || null,
          // Datos adicionales del perfil
          planType: profile?.plan_type || 'free',
          registrationDate: profile?.registration_date || profile?.created_at,
          targetOposicion: profile?.target_oposicion,
          isActiveStudent: profile?.is_active_student,
          ciudad: profile?.ciudad,
          // Info de dispositivo
          browserName: profile?.browserName,
          operatingSystem: profile?.operatingSystem,
          deviceModel: profile?.deviceModel,
          feedbacks: [],
          totalConversations: 0,
          pendingConversations: 0,
          lastActivity: feedback.created_at
        })
      }

      const userData = usersMap.get(userKey)
      userData.feedbacks.push(feedback)
      userData.totalConversations++

      // Contar pendientes para el admin:
      // - Conversación en waiting_admin (usuario esperando respuesta)
      // - Feedback pending SIN conversación (ticket nuevo sin responder)
      const conversation = conversationsMap[feedback.id]
      const isPendingForAdmin =
        conversation?.status === 'waiting_admin' ||
        (feedback.status === 'pending' && !conversation)

      if (isPendingForAdmin) {
        userData.pendingConversations++
      }

      // Actualizar última actividad (considerar también la conversación)
      const feedbackDate = new Date(feedback.updated_at || feedback.created_at)
      const conversationDate = conversation?.updated_at ? new Date(conversation.updated_at) : null
      const mostRecentDate = conversationDate && conversationDate > feedbackDate ? conversationDate : feedbackDate
      const lastDate = new Date(userData.lastActivity)
      if (mostRecentDate > lastDate) {
        userData.lastActivity = mostRecentDate.toISOString()
      }
    })

    // Convertir a array y ordenar por pendientes primero, luego por última actividad
    return Array.from(usersMap.values())
      .sort((a, b) => {
        // Primero por pendientes (más pendientes primero)
        if (b.pendingConversations !== a.pendingConversations) {
          return b.pendingConversations - a.pendingConversations
        }
        // Luego por última actividad
        return new Date(b.lastActivity) - new Date(a.lastActivity)
      })
  }

  const loadFeedbacks = useCallback(async () => {
    try {
      setLoading(true)
      console.log('🔄 Iniciando carga de feedbacks...')
      
      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      console.log(`📋 Feedbacks obtenidos: ${data?.length || 0}`)

      // Cargar perfiles de usuario para los feedbacks que tienen user_id
      const feedbacksWithProfiles = await loadUserProfiles(data || [])
      
      console.log('📝 Feedbacks con perfiles procesados:', feedbacksWithProfiles?.length)
      
      // Debug específico para ismaelceuta
      const ismaelFeedback = feedbacksWithProfiles?.find(f => f.email === 'ismaelceuta@gmail.com')
      if (ismaelFeedback) {
        console.log('🎯 Feedback de Ismael procesado:', {
          email: ismaelFeedback.email,
          user_id: ismaelFeedback.user_id,
          user_profiles: ismaelFeedback.user_profiles
        })
      }
      
      setFeedbacks(feedbacksWithProfiles)
      
      // Calcular estadísticas
      const stats = {
        total: data?.length || 0,
        pending: data?.filter(f => f.status === 'pending').length || 0,
        resolved: data?.filter(f => f.status === 'resolved').length || 0,
        dismissed: data?.filter(f => f.status === 'dismissed').length || 0
      }
      setStats(stats)

      console.log('✅ Feedbacks cargados y estado actualizado')
      
      // 🔧 FORCE REFRESH: Forzar re-render después de cargar perfiles
      setTimeout(() => {
        console.log('🔄 Forzando re-render después de cargar perfiles')
        setFeedbacks(prevFeedbacks => [...prevFeedbacks])
      }, 100)

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
        // La respuesta ya incluye las URLs de imagen directamente en el texto
        updateData.admin_response = response
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

  // Función para renderizar mensaje con imágenes incrustadas (estilo WhatsApp)
  const renderMessageWithImages = (messageText) => {
    if (!messageText) return ''
    
    console.log('🖼️ [DEBUG] Procesando mensaje:', messageText.substring(0, 100) + '...')
    
    // Detectar URLs de imagen en el mensaje - regex más amplia
    const imageUrlRegex = /(https?:\/\/[^\s\n]+\.(?:jpg|jpeg|png|gif|webp|JPG|JPEG|PNG|GIF|WEBP)(?:\?[^\s\n]*)?)/gi
    const urls = messageText.match(imageUrlRegex)
    
    console.log('🖼️ [DEBUG] URLs encontradas:', urls)
    console.log('🖼️ [DEBUG] Mensaje completo para análisis:', messageText)
    
    if (!urls || urls.length === 0) {
      // No hay imágenes, renderizar solo texto
      return <span style={{ whiteSpace: 'pre-wrap' }}>{messageText}</span>
    }
    
    // Dividir el texto por las URLs de imagen
    const parts = messageText.split(imageUrlRegex)
    
    return parts.map((part, index) => {
      // Resetear regex para cada test
      const testRegex = /(https?:\/\/[^\s\n]+\.(?:jpg|jpeg|png|gif|webp|JPG|JPEG|PNG|GIF|WEBP)(?:\?[^\s\n]*)?)/gi
      
      // Si es una URL de imagen, renderizar como imagen pequeña
      if (testRegex.test(part)) {
        console.log('🖼️ [DEBUG] Renderizando imagen:', part)
        return (
          <div 
            key={index} 
            className="my-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700"
            style={{ userSelect: 'none' }}
          >
            <div className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-medium">
              📸 Imagen adjunta - Click para expandir
            </div>
            <div 
              className="inline-block cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('🖼️ [DEBUG] Click en contenedor para expandir:', part)
                setExpandedImage(part)
              }}
            >
              <img
                src={part}
                alt="Imagen adjunta"
                className="max-w-48 max-h-36 rounded-lg border-2 border-blue-400 dark:border-blue-500 hover:opacity-80 hover:border-blue-600 transition-all object-cover shadow-lg pointer-events-none"
                onError={(e) => {
                  console.error('❌ [DEBUG] Error cargando imagen:', part)
                  e.target.style.display = 'none'
                  // Mostrar link si la imagen no carga
                  const link = document.createElement('a')
                  link.href = part
                  link.target = '_blank'
                  link.className = 'text-blue-500 hover:underline text-sm font-medium'
                  link.textContent = '🖼️ Ver imagen (enlace directo)'
                  e.target.parentNode.appendChild(link)
                }}
                onLoad={() => {
                  console.log('✅ [DEBUG] Imagen cargada exitosamente:', part)
                }}
                title="Click para expandir imagen"
                draggable={false}
              />
            </div>
          </div>
        )
      } else {
        // Si es texto normal, renderizar como texto con saltos de línea
        return (
          <span key={index} style={{ whiteSpace: 'pre-wrap' }}>
            {part}
          </span>
        )
      }
    })
  }

  // Función para insertar imagen en input del chat
  const handleChatImageUpload = async (event, textareaRef) => {
    const file = event.target.files[0]
    if (!file) return

    console.log('📸 Chat: Iniciando subida de imagen:', file.name)

    // Validar archivo
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede ser mayor a 5MB')
      return
    }

    setUploadingImage(true)

    try {
      // Usar la API para subir
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userPath', 'admin-chat-images')

      const response = await fetch('/api/upload-feedback-image', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Error subiendo imagen')
      }

      const result = await response.json()
      console.log('✅ Chat: Imagen subida:', result.url)

      // Verificar que el textarea existe
      if (!textareaRef.current) {
        console.error('❌ Chat: Textarea ref no está disponible')
        // Mostrar la URL como fallback
        alert(`Imagen subida exitosamente: ${result.url}`)
        return
      }

      // Enviar la imagen directamente al chat
      const currentMessage = textareaRef.current.value.trim()
      const messageWithImage = currentMessage ? `${currentMessage}\n${result.url}` : result.url
      
      // Enviar mensaje con imagen al chat inmediatamente
      if (selectedConversation?.id) {
        await sendAdminMessage(selectedConversation.id, messageWithImage)
        textareaRef.current.value = '' // Limpiar textarea
        console.log('✅ Chat: Imagen enviada directamente al chat')
      } else {
        // Si no hay conversación activa, insertar en textarea como fallback
        const imageMarkdown = `\n${result.url}\n`
        const cursorPosition = textareaRef.current.selectionStart
        const currentValue = textareaRef.current.value
        const newValue = currentValue.slice(0, cursorPosition) + imageMarkdown + currentValue.slice(cursorPosition)
        textareaRef.current.value = newValue
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = cursorPosition + imageMarkdown.length
        console.log('✅ Chat: Imagen insertada en textarea (fallback)')
      }

    } catch (error) {
      console.error('❌ Chat: Error subiendo imagen:', error)
      alert('Error al subir la imagen')
    } finally {
      setUploadingImage(false)
      event.target.value = '' // Limpiar input file
    }
  }

  // Función para subir imagen desde admin
  const handleImageUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    console.log('📸 Iniciando subida de imagen:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`)

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      console.error('❌ Tipo de archivo no válido:', file.type)
      alert('Solo se permiten archivos de imagen (JPG, PNG, GIF, etc.)')
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.error('❌ Archivo demasiado grande:', file.size, 'bytes')
      alert('La imagen no puede ser mayor a 5MB')
      return
    }

    setUploadingImage(true)

    try {
      // Crear nombre único para el archivo
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `admin-chat-images/${fileName}`

      console.log('📤 Subiendo archivo a Supabase:', filePath)

      // Usar cliente con service role para garantizar permisos
      const supabaseServiceRole = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
      )

      // Intentar subir a bucket 'feedback-images' (más específico)
      const { data, error: uploadError } = await supabaseServiceRole.storage
        .from('feedback-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true // Permitir sobrescribir si existe
        })

      if (uploadError) {
        console.error('❌ Error de Supabase Storage:', uploadError)
        
        // Si el bucket no existe, intentar crearlo automáticamente
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('bucket')) {
          console.log('🆕 Intentando crear bucket feedback-images...')
          
          const { data: bucketData, error: bucketError } = await supabaseServiceRole.storage
            .createBucket('feedback-images', { 
              public: true,
              allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
            })
          
          if (bucketError) {
            console.error('❌ Error creando bucket:', bucketError)
            throw new Error(`Error de configuración del storage: ${uploadError.message}`)
          }
          
          console.log('✅ Bucket creado exitosamente')
          
          // Intentar subir nuevamente
          const { data: retryData, error: retryError } = await supabaseServiceRole.storage
            .from('feedback-images')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true
            })
          
          if (retryError) {
            throw new Error(`Error en segunda tentativa: ${retryError.message}`)
          }
          
          console.log('✅ Archivo subido exitosamente (segundo intento)')
        } else {
          throw uploadError
        }
      } else {
        console.log('✅ Archivo subido exitosamente')
      }

      // Obtener URL pública
      const { data: { publicUrl } } = supabaseServiceRole.storage
        .from('feedback-images')
        .getPublicUrl(filePath)

      console.log('🔗 URL pública generada:', publicUrl)

      // En lugar de añadir a lista separada, insertar directamente en el mensaje
      const imageMarkdown = `\n${publicUrl}\n`
      
      // Insertar en adminResponse donde está el cursor (al final por simplicidad)
      setAdminResponse(prev => prev + imageMarkdown)

      console.log('✅ Imagen insertada directamente en el mensaje')
      
      // Mostrar mensaje de éxito al usuario
      const successMessage = `✅ Imagen "${file.name}" subida correctamente`
      // Crear una notificación temporal en lugar de alert
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
      console.error('❌ Error completo subiendo imagen:', error)
      console.error('❌ Stack trace:', error.stack)
      
      // Mostrar error más específico al usuario
      let userMessage = 'Error al subir la imagen.'
      
      if (error.message?.includes('Bucket not found')) {
        userMessage = 'Error de configuración del almacenamiento. Contacta al administrador.'
      } else if (error.message?.includes('permissions') || error.message?.includes('policy')) {
        userMessage = 'Error de permisos al subir la imagen. Verifica tu configuración.'
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        userMessage = 'Error de conexión. Verifica tu internet e inténtalo de nuevo.'
      } else if (error.message) {
        userMessage = `Error: ${error.message}`
      }
      
      alert(userMessage)
    } finally {
      setUploadingImage(false)
      // Limpiar input
      event.target.value = ''
    }
  }

  // Función para eliminar imagen subida
  const removeImage = async (imageId, imagePath) => {
    try {
      console.log('🗑️ Eliminando imagen:', imagePath)
      
      // Usar cliente con service role para garantizar permisos
      const supabaseServiceRole = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
      )
      
      // Eliminar de Supabase Storage
      const { error } = await supabaseServiceRole.storage
        .from('feedback-images')
        .remove([imagePath])

      if (error) {
        console.error('❌ Error eliminando de storage:', error)
        // No lanzar error, solo loggear
      } else {
        console.log('✅ Imagen eliminada del storage')
      }

      // Eliminar de la lista local (siempre, incluso si falla el storage)
      setUploadedImages(prev => prev.filter(img => img.id !== imageId))
      console.log('✅ Imagen removida de la lista local')
    } catch (error) {
      console.error('❌ Error eliminando imagen:', error)
      // Remover de la lista local de todas formas
      setUploadedImages(prev => prev.filter(img => img.id !== imageId))
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
            <div className="flex gap-2 items-center">
              {newUserMessages.size > 0 && (
                <div className="bg-red-500 text-white px-3 py-2 rounded-lg animate-pulse text-sm">
                  <span className="font-bold">{newUserMessages.size}</span> mensaje{newUserMessages.size > 1 ? 's' : ''} nuevo{newUserMessages.size > 1 ? 's' : ''}
                </div>
              )}
              {/* Botón temporal de debug */}
              <button
                onClick={() => {
                  console.log('🔄 Forzando recarga de feedbacks...')
                  loadFeedbacks()
                }}
                className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors"
                title="Recargar feedbacks (debug)"
              >
                🔄 Recargar
              </button>
            </div>
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

        {/* Vista principal: Lista de usuarios o conversaciones del usuario */}
        {!selectedUser ? (
          // === LISTA DE USUARIOS ===
          <>
            {usersWithConversations.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No hay usuarios con conversaciones
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Los usuarios que envíen solicitudes de soporte aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                  👥 Usuarios ({usersWithConversations.length})
                </h2>
                {usersWithConversations.map((userData, index) => (
                  <button
                    key={userData.id || userData.email || index}
                    onClick={() => setSelectedUser(userData)}
                    className="w-full text-left bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-all p-4 sm:p-5 border-l-4 border-transparent hover:border-blue-500"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Avatar */}
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg sm:text-xl">
                            {userData.name ? userData.name.charAt(0).toUpperCase() : '👤'}
                          </span>
                        </div>

                        {/* Info del usuario */}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {userData.name || userData.email || 'Usuario anónimo'}
                          </div>
                          {userData.name && userData.email && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {userData.email}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            Última actividad: {new Date(userData.lastActivity).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Badges de conversaciones */}
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {userData.pendingConversations > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
                            {userData.pendingConversations} pendiente{userData.pendingConversations > 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2.5 py-1 rounded-full">
                          {userData.totalConversations} conv.
                        </span>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          // === CONVERSACIONES DEL USUARIO SELECCIONADO (Layout 2 columnas) ===
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
            {/* Header con información del usuario */}
            <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => {
                    setSelectedUser(null)
                    setSelectedFeedback(null)
                  }}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors mt-1"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">
                    {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : '👤'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {selectedUser.name || 'Usuario'}
                    </h2>
                    {/* Badge Premium/Free */}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      selectedUser.planType === 'premium' || selectedUser.planType === 'pro'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {selectedUser.planType === 'premium' || selectedUser.planType === 'pro' ? '⭐ Premium' : 'Free'}
                    </span>
                    {selectedUser.pendingConversations > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded">
                        {selectedUser.pendingConversations} pendiente{selectedUser.pendingConversations > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {/* Email */}
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    📧 {selectedUser.email || 'Sin email'}
                  </p>
                  {/* Info adicional */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-500">
                    {selectedUser.targetOposicion && (
                      <span>📚 {selectedUser.targetOposicion}</span>
                    )}
                    {selectedUser.registrationDate && (
                      <span>
                        📅 Registro: {new Date(selectedUser.registrationDate).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'Europe/Madrid'
                        })}
                      </span>
                    )}
                    {selectedUser.ciudad && (
                      <span>📍 {selectedUser.ciudad}</span>
                    )}
                    {(selectedUser.browserName || selectedUser.operatingSystem || selectedUser.deviceModel) && (
                      <span>
                        💻 {[
                          selectedUser.operatingSystem,
                          selectedUser.browserName,
                          // Solo mostrar deviceModel si no tenemos OS específico
                          !selectedUser.operatingSystem && selectedUser.deviceModel &&
                            selectedUser.deviceModel.charAt(0).toUpperCase() + selectedUser.deviceModel.slice(1)
                        ].filter(Boolean).join(' / ')}
                      </span>
                    )}
                    <span>💬 {selectedUser.totalConversations} conv.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Layout de 2 columnas */}
            <div className="flex h-full" style={{ height: 'calc(100% - 110px)' }}>
              {/* Panel izquierdo: Lista de conversaciones */}
              <div className="w-80 border-r dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                {selectedUser.feedbacks
                  .sort((a, b) => {
                    // Primero ordenar por pendientes (arriba)
                    const convA = conversations[a.id]
                    const convB = conversations[b.id]
                    const isPendingA = convA?.status === 'waiting_admin' || (a.status === 'pending' && !convA)
                    const isPendingB = convB?.status === 'waiting_admin' || (b.status === 'pending' && !convB)
                    if (isPendingA !== isPendingB) return isPendingA ? -1 : 1
                    // Luego por fecha más reciente
                    return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
                  })
                  .map((feedback) => {
                    const conversation = conversations[feedback.id]
                    // Pendiente para admin: waiting_admin O (pending SIN conversación)
                    const isPending = conversation?.status === 'waiting_admin' ||
                      (feedback.status === 'pending' && !conversation)
                    const hasNewMessage = conversation && newUserMessages.has(conversation.id)
                    const isSelected = selectedFeedback?.id === feedback.id

                    return (
                      <button
                        key={feedback.id}
                        onClick={() => setSelectedFeedback(feedback)}
                        className={`w-full text-left p-3 border-b dark:border-gray-700 transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 border-l-4 border-l-transparent'
                        } ${hasNewMessage ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isPending && (
                              <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0"></span>
                            )}
                            {hasNewMessage && (
                              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse flex-shrink-0"></span>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded ${FEEDBACK_TYPES[feedback.type]?.color || 'bg-gray-100 text-gray-800'}`}>
                              {FEEDBACK_TYPES[feedback.type]?.label?.split(' ')[0] || '❓'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(feedback.updated_at || feedback.created_at).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Europe/Madrid'
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                          {feedback.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs ${STATUS_CONFIG[feedback.status]?.color} px-1.5 py-0.5 rounded`}>
                            {STATUS_CONFIG[feedback.status]?.label}
                          </span>
                          {conversation?.status === 'waiting_admin' && (
                            <span className="text-xs text-orange-600 dark:text-orange-400">
                              💬 Esperando
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
              </div>

              {/* Panel derecho: Chat integrado */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
                {!selectedFeedback ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <div className="text-4xl mb-2">👈</div>
                      <p>Selecciona una conversación</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${FEEDBACK_TYPES[selectedFeedback.type]?.color}`}>
                            {FEEDBACK_TYPES[selectedFeedback.type]?.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CONFIG[selectedFeedback.status]?.color}`}>
                            {STATUS_CONFIG[selectedFeedback.status]?.label}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(selectedFeedback.created_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Madrid'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Área de mensajes */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-100 dark:bg-gray-900">
                      {/* Solicitud original (primer mensaje) */}
                      <div className="flex justify-start">
                        <div className="max-w-[80%] bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            📋 Solicitud original
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                            {selectedFeedback.message}
                          </p>
                          <div className="text-xs text-gray-400 mt-1 text-right">
                            {new Date(selectedFeedback.created_at).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Europe/Madrid'
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Mensajes del chat */}
                      {inlineChatMessages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-lg p-3 ${
                            msg.is_admin
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            <div className={`text-xs mt-1 text-right ${msg.is_admin ? 'text-blue-200' : 'text-gray-400'}`}>
                              {new Date(msg.created_at).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Europe/Madrid'
                              })}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Indicador de sin mensajes */}
                      {inlineChatMessages.length === 0 && !conversations[selectedFeedback.id] && (
                        <div className="text-center text-gray-400 dark:text-gray-500 py-4 text-sm">
                          Escribe un mensaje para iniciar la conversación
                        </div>
                      )}
                    </div>

                    {/* Input de mensaje */}
                    <div className="p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
                      <div className="flex gap-2">
                        <textarea
                          value={inlineNewMessage}
                          onChange={(e) => setInlineNewMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              sendInlineMessage()
                            }
                          }}
                          placeholder="Escribe tu respuesta... (Enter para enviar)"
                          rows={2}
                          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                        />
                        <button
                          onClick={sendInlineMessage}
                          disabled={!inlineNewMessage.trim() || sendingInlineMessage}
                          className="px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {sendingInlineMessage ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de respuesta - Solo se abre cuando NO hay usuario seleccionado (modo antiguo) */}
        {selectedFeedback && !selectedUser && (
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
                  <div className="text-sm sm:text-base text-gray-800 dark:text-gray-200">
                    {renderMessageWithImages(selectedFeedback.message)}
                  </div>
                </div>

                {/* Textarea de respuesta */}
                <div className="mb-4 sm:mb-6">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tu respuesta:
                  </label>
                  

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
                      <label className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border border-gray-200 dark:border-gray-600 hover:border-blue-300" title="Subir imagen (JPG, PNG, GIF - máx 5MB)">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          onClick={() => console.log('📸 [ADMIN] Click en botón de subir imagen')}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                        {uploadingImage ? (
                          <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
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
            <div className={`bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-2xl w-full h-[70vh] sm:h-[80vh] flex ${userOtherConversations.length > 0 ? 'sm:max-w-4xl' : 'sm:w-96 sm:max-w-md'}`}>

              {/* Panel izquierdo: Lista de conversaciones del usuario */}
              {userOtherConversations.length > 0 && (
                <div className="hidden sm:flex flex-col w-64 border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  {/* Header del panel */}
                  <div className="p-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      📂 Conversaciones del usuario
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {userOtherConversations.length + 1} en total
                    </p>
                  </div>

                  {/* Lista de conversaciones */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {/* Conversación actual (marcada) */}
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500 rounded-lg">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">📍 Actual</span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {new Date(selectedConversation.last_message_at || selectedConversation.created_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-blue-800 dark:text-blue-200 line-clamp-2">
                        {feedbacks.find(f => f.id === selectedConversation.feedback_id)?.message?.substring(0, 60)}...
                      </p>
                    </div>

                    {/* Otras conversaciones */}
                    {userOtherConversations.map((conv) => {
                      const statusColors = {
                        'waiting_admin': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                        'waiting_user': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
                        'closed': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }
                      const statusLabels = {
                        'waiting_admin': '⏳',
                        'waiting_user': '💬',
                        'closed': '✅'
                      }
                      return (
                        <button
                          key={conv.id}
                          onClick={() => openChatConversation(conv)}
                          className="w-full text-left p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                        >
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[conv.status] || statusColors['closed']}`}>
                              {statusLabels[conv.status] || '•'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(conv.last_message_at || conv.created_at).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short'
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                            {conv.feedback?.message?.substring(0, 60)}{conv.feedback?.message?.length > 60 ? '...' : ''}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Panel derecho: Chat actual */}
              <div className="flex flex-col flex-1">

              {/* Header */}
              <div className="flex items-center justify-between p-2 sm:p-4 border-b dark:border-gray-700 flex-shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                    💬 Chat de Soporte
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 truncate">
                    {(() => {
                      const feedback = feedbacks.find(f => f.id === selectedConversation.feedback_id)
                      const userName = feedback?.user_profiles?.full_name || feedback?.email || 'Usuario anónimo'
                      const userEmail = feedback?.user_profiles?.email || feedback?.email
                      return `👤 ${userName}${userEmail && userName !== userEmail ? ` (${userEmail})` : ''}`
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
                <div className="text-xs text-gray-800 dark:text-gray-200 line-clamp-3">
                  {renderMessageWithImages(feedbacks.find(f => f.id === selectedConversation.feedback_id)?.message)}
                </div>
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
                      <div className="text-xs sm:text-sm">
                        {renderMessageWithImages(message.message)}
                      </div>
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
                

                <form onSubmit={(e) => {
                  e.preventDefault()
                  const message = e.target.message.value.trim()
                  if (message) {
                    // El mensaje ya incluye las URLs de imagen directamente
                    sendAdminMessage(selectedConversation.id, message)
                    e.target.message.value = ''
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
                            onChange={(e) => handleChatImageUpload(e, chatTextareaRef)}
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
                          ref={chatTextareaRef}
                          name="message"
                          placeholder="Escribe tu respuesta... Usa el botón de imagen para adjuntar imagen si lo deseas."
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
                                    const textarea = chatTextareaRef.current
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
          </div>
        )}

        {/* Modal para expandir imagen (estilo WhatsApp) */}
        {expandedImage && (
          <div 
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4"
            onClick={() => setExpandedImage(null)}
          >
            <div className="relative max-w-full max-h-full">
              {/* Botón de cerrar */}
              <button
                onClick={() => setExpandedImage(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors border-2 border-white/30 hover:border-white/50"
                title="Cerrar (ESC)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* Imagen expandida */}
              <img
                src={expandedImage}
                alt="Imagen expandida"
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              
              {/* Botón para abrir en nueva pestaña */}
              <button
                onClick={() => window.open(expandedImage, '_blank')}
                className="absolute bottom-4 right-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                🔗 Abrir en nueva pestaña
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}