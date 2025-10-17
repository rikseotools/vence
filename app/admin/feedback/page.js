// app/admin/feedback/page.js - Panel de administración de feedback
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

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
  'resolved': { label: '✅ Resuelto', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
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
  const [viewedConversations, setViewedConversations] = useState(new Set()) // IDs de conversaciones que el admin ya vio
  const [viewedConversationsLoaded, setViewedConversationsLoaded] = useState(false) // Flag para saber si ya se cargó localStorage
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (user) {
      console.log('🔄 Cargando datos iniciales de feedback...')
      
      // Cargar conversaciones vistas desde localStorage
      try {
        const stored = localStorage.getItem('admin_viewed_conversations')
        if (stored) {
          const viewedArray = JSON.parse(stored)
          setViewedConversations(new Set(viewedArray))
          console.log(`📂 Cargadas ${viewedArray.length} conversaciones vistas desde localStorage`)
        }
      } catch (error) {
        console.error('Error cargando conversaciones vistas:', error)
      } finally {
        // Marcar como cargado independientemente de si había data o no
        setViewedConversationsLoaded(true)
      }
      
      loadFeedbacks()
      loadConversations()
    }
  }, [user])

  // Scroll automático al final cuando cambian los mensajes
  useEffect(() => {
    scrollToBottom()
  }, [chatMessages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const checkForNewUserMessages = useCallback(async () => {
    try {
      // Obtener conversaciones que tienen status 'waiting_admin' (el usuario ha respondido)
      const { data: waitingConversations, error: convError } = await supabase
        .from('feedback_conversations')
        .select('id, feedback_id, status, last_message_at')
        .eq('status', 'waiting_admin')

      if (convError) throw convError

      if (waitingConversations && waitingConversations.length > 0) {
        const waitingIds = waitingConversations.map(conv => conv.id)
        console.log(`🔔 Conversaciones esperando admin:`, waitingIds.length)
        
        // Solo agregar conversaciones que NO han sido vistas por el admin
        setNewUserMessages(prev => {
          // Filtrar solo las conversaciones que no han sido vistas
          const unviewedIds = waitingIds.filter(id => !viewedConversations.has(id))
          const newSet = new Set([...prev, ...unviewedIds])
          
          console.log(`👁️ Conversaciones vistas: ${viewedConversations.size} [${[...viewedConversations].map(id => id.substring(0,8)).join(', ')}]`)
          console.log(`🆕 Conversaciones no vistas nuevas: ${unviewedIds.length}`)
          console.log(`📢 Total notificaciones: ${prev.size} → ${newSet.size}`)
          
          return newSet
        })
      }
    } catch (error) {
      console.error('Error verificando nuevos mensajes:', error)
    }
  }, [supabase, viewedConversations])

  // Polling para detectar nuevas respuestas de usuarios - SOLO después de cargar localStorage
  useEffect(() => {
    if (!user || !viewedConversationsLoaded) return

    // Ejecutar primera verificación inmediatamente
    checkForNewUserMessages()

    const interval = setInterval(() => {
      checkForNewUserMessages()
    }, 10000) // Verificar cada 10 segundos

    return () => clearInterval(interval)
  }, [user, viewedConversationsLoaded, checkForNewUserMessages])

  const loadFeedbacks = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setFeedbacks(data || [])
      
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
  }

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

  const sendAdminMessage = async (conversationId, message) => {
    try {
      // Primero verificar el estado actual de la conversación
      const { data: currentConv } = await supabase
        .from('feedback_conversations')
        .select('status')
        .eq('id', conversationId)
        .single()

      const wasReopened = currentConv?.status === 'closed'
      
      const { error } = await supabase
        .from('feedback_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          is_admin: true,
          message: message.trim()
        })

      if (error) throw error

      // Actualizar conversación - siempre reabrir si estaba cerrada
      await supabase
        .from('feedback_conversations')
        .update({ 
          status: 'waiting_user',
          last_message_at: new Date().toISOString(),
          admin_user_id: user.id
        })
        .eq('id', conversationId)

      // Mostrar mensaje si se reabrió la conversación
      if (wasReopened) {
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
              title: 'Nueva respuesta de soporte',
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
        
        if (emailResult.sent) {
          console.log('📧 Email de soporte enviado al usuario')
        } else {
          console.log(`📧 Email no enviado: ${emailResult.reason}`)
        }
      } catch (emailError) {
        console.error('❌ Error enviando email de soporte:', emailError)
        // No fallar toda la operación por un error de email
      }

      // Recargar mensajes
      await loadChatMessages(conversationId)
      await loadConversations()
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
        updateData.admin_response = response
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
      
      // Abrir el chat inmediatamente
      setSelectedConversation(conversation)
      setChatMessages([]) // Empezar con mensajes vacíos
      
      // Limpiar notificación si existía y marcar como vista
      setNewUserMessages(prev => {
        const newSet = new Set(prev)
        newSet.delete(conversation.id)
        return newSet
      })
      setViewedConversations(prev => {
        const newViewed = new Set([...prev, conversation.id])
        console.log(`✅ Nueva conversación marcada como vista: ${conversation.id.substring(0,8)}... (Total vistas: ${newViewed.size})`)
        
        // Sincronizar con localStorage para que el Header se entere
        const viewedArray = [...newViewed]
        localStorage.setItem('admin_viewed_conversations', JSON.stringify(viewedArray))
        
        return newViewed
      })
      
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                💬 Gestión de Feedback
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Administrar comentarios y sugerencias de usuarios
              </p>
            </div>
            {newUserMessages.size > 0 && (
              <div className="bg-red-500 text-white px-4 py-2 rounded-lg animate-pulse">
                <span className="font-bold">{newUserMessages.size}</span> mensaje{newUserMessages.size > 1 ? 's' : ''} nuevo{newUserMessages.size > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Pendientes</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Resueltos</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.dismissed}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Descartados</div>
          </div>
        </div>

        {/* Lista de Feedbacks */}
        {feedbacks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No hay feedbacks
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Los comentarios de usuarios aparecerán aquí
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((feedback) => (
              <div 
                key={feedback.id} 
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                
                {/* Header del feedback */}
                <div className="flex items-start justify-between mb-4">
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

                {/* Usuario */}
                <div className="mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    👤 {feedback.email || 'Usuario anónimo'}
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
                  <div className="flex gap-2 pt-4 border-t dark:border-gray-700">
                    {/* Botón de Chat - Prioridad */}
                    {conversations[feedback.id] ? (
                      <button
                        onClick={() => {
                          setSelectedConversation(conversations[feedback.id])
                          loadChatMessages(conversations[feedback.id].id)
                          // Marcar como visto y quitar notificación
                          const conversationId = conversations[feedback.id].id
                          setNewUserMessages(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(conversationId)
                            return newSet
                          })
                          // Marcar esta conversación como vista permanentemente
                          setViewedConversations(prev => {
                            const newViewed = new Set([...prev, conversationId])
                            console.log(`✅ Conversación marcada como vista: ${conversationId.substring(0,8)}... (Total vistas: ${newViewed.size})`)
                            
                            // Sincronizar con localStorage para que el Header se entere
                            const viewedArray = [...newViewed]
                            localStorage.setItem('admin_viewed_conversations', JSON.stringify(viewedArray))
                            
                            return newViewed
                          })
                          setNewUserMessages(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(conversations[feedback.id].id)
                            return newSet
                          })
                        }}
                        className={`px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium ${
                          newUserMessages.has(conversations[feedback.id].id)
                            ? 'bg-orange-600 hover:bg-orange-700 animate-pulse'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        💬 Ver Chat
                      </button>
                    ) : (
                      <button
                        onClick={() => startChatWithUser(feedback)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        💬 Iniciar Chat
                      </button>
                    )}
                    
                    {/* Botones diferentes según si hay conversación o no */}
                    {conversations[feedback.id] ? (
                      // Si hay conversación: opciones de resolución y cerrar chat
                      <>
                        <button
                          onClick={() => updateFeedbackStatus(feedback.id, 'resolved')}
                          disabled={updatingStatus}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          ✅ Resuelto
                        </button>
                        <button
                          onClick={() => {
                            // Cerrar solo el chat, mantener feedback pendiente
                            supabase
                              .from('feedback_conversations')
                              .update({ status: 'closed' })
                              .eq('id', conversations[feedback.id].id)
                              .then(() => {
                                console.log('💬 Chat cerrado')
                                loadConversations()
                              })
                          }}
                          disabled={updatingStatus}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          🔒 Cerrar Chat
                        </button>
                        <button
                          onClick={() => updateFeedbackStatus(feedback.id, 'dismissed')}
                          disabled={updatingStatus}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          ❌ Descartar
                        </button>
                      </>
                    ) : (
                      // Si no hay conversación: respuesta rápida o descartar
                      <>
                        <button
                          onClick={() => setSelectedFeedback(feedback)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          📝 Respuesta rápida
                        </button>
                        <button
                          onClick={() => updateFeedbackStatus(feedback.id, 'dismissed')}
                          disabled={updatingStatus}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          ❌ Descartar
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
                        onClick={() => {
                          setSelectedConversation(conversations[feedback.id])
                          loadChatMessages(conversations[feedback.id].id)
                          // Marcar como visto y quitar notificación
                          const conversationId = conversations[feedback.id].id
                          setNewUserMessages(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(conversationId)
                            return newSet
                          })
                          // Marcar esta conversación como vista permanentemente
                          setViewedConversations(prev => {
                            const newViewed = new Set([...prev, conversationId])
                            console.log(`✅ Conversación marcada como vista: ${conversationId.substring(0,8)}... (Total vistas: ${newViewed.size})`)
                            
                            // Sincronizar con localStorage para que el Header se entere
                            const viewedArray = [...newViewed]
                            localStorage.setItem('admin_viewed_conversations', JSON.stringify(viewedArray))
                            
                            return newViewed
                          })
                          setNewUserMessages(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(conversations[feedback.id].id)
                            return newSet
                          })
                        }}
                        className={`px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium ${
                          newUserMessages.has(conversations[feedback.id].id)
                            ? 'bg-orange-600 hover:bg-orange-700 animate-pulse'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        💬 Ver Chat
                      </button>
                    ) : (
                      <button
                        onClick={() => startChatWithUser(feedback)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        💬 Iniciar Chat
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
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  📝 Responder Feedback
                </h3>
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Contenido */}
              <div className="p-6">
                
                {/* Feedback original */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Feedback original:
                  </div>
                  <p className="text-gray-800 dark:text-gray-200">
                    {selectedFeedback.message}
                  </p>
                </div>

                {/* Textarea de respuesta */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tu respuesta:
                  </label>
                  <textarea
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    placeholder="Escribe tu respuesta al usuario..."
                    rows={6}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Botones */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedFeedback(null)}
                    disabled={updatingStatus}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => updateFeedbackStatus(selectedFeedback.id, 'resolved', adminResponse)}
                    disabled={updatingStatus || !adminResponse.trim()}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                  >
                    {updatingStatus ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Guardando...
                      </span>
                    ) : (
                      '✅ Resolver y Responder'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Chat */}
        {selectedConversation && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl h-[90vh] flex flex-col">
              
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    💬 Chat de Feedback
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Estado: {selectedConversation.status === 'waiting_admin' ? '⏳ Esperando tu respuesta' : 
                             selectedConversation.status === 'waiting_user' ? '💬 Esperando usuario' : 
                             selectedConversation.status}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Feedback original */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Feedback original:
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {feedbacks.find(f => f.id === selectedConversation.feedback_id)?.message}
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-25">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.is_admin ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                      message.is_admin 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                    }`}>
                      <div className="text-sm mb-1 font-medium">
                        {message.is_admin ? '👨‍💼 Tú (Admin)' : `👤 ${message.sender?.full_name || message.sender?.email || 'Usuario'}`}
                      </div>
                      <p className="text-sm">{message.message}</p>
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

              {/* Input para Admin */}
              <div className="p-4 border-t dark:border-gray-700">
                <form onSubmit={(e) => {
                  e.preventDefault()
                  const message = e.target.message.value.trim()
                  if (message) {
                    sendAdminMessage(selectedConversation.id, message)
                    e.target.message.value = ''
                  }
                }}>
                  <div className="flex gap-3">
                    <input
                      name="message"
                      type="text"
                      placeholder="Escribe tu respuesta..."
                      className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors font-medium"
                    >
                      📤 Enviar
                    </button>
                  </div>
                </form>
                
                {/* Botón para resolver y cerrar */}
                <div className="mt-3 pt-3 border-t dark:border-gray-600">
                  <button
                    onClick={() => {
                      if (confirm('¿Marcar este feedback como resuelto y cerrar la conversación?')) {
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
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    ✅ Resolver y Cerrar Conversación
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