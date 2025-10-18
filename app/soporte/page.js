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
  'otro': '❓ Otro Motivo'
}

function SoporteContent() {
  const { user, supabase } = useAuth()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('conversations')
  const [feedbacks, setFeedbacks] = useState([])
  const [notifications, setNotifications] = useState([])
  const [conversations, setConversations] = useState({})
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [disputes, setDisputes] = useState([])
  const [disputesLoading, setDisputesLoading] = useState(false)
  const messagesEndRef = useRef(null)

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
  }, [searchParams, disputes])

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
      const { data, error } = await supabase
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
          questions!inner (
            question_text,
            correct_option,
            option_a,
            option_b,
            option_c,
            option_d,
            articles!inner (
              article_number,
              title,
              laws!inner (short_name)
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDisputes(data || [])
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
              onClick={() => setShowFeedbackModal(true)}
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
                      onClick={() => setShowFeedbackModal(true)}
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
                                {conversations[feedback.id].status === 'waiting_admin' ? '⏳ Esperando respuesta de Vence' : 
                                 conversations[feedback.id].status === 'waiting_user' ? '💬 Te respondieron' : 
                                 conversations[feedback.id].status}
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedConversation(conversations[feedback.id])
                                  loadChatMessages(conversations[feedback.id].id)
                                }}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                  conversations[feedback.id].status === 'waiting_user'
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                              >
                                {conversations[feedback.id].status === 'waiting_user' 
                                  ? 'Abrir Chat'
                                  : 'Ver Chat'
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
                {disputesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando impugnaciones...</p>
                  </div>
                ) : disputes.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">⚖️</div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      No tienes impugnaciones
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Cuando encuentres una pregunta incorrecta, puedes reportarla desde el test.
                    </p>
                    <Link 
                      href="/auxiliar-administrativo-estado/test"
                      className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      🎯 Hacer un Test
                    </Link>
                  </div>
                ) : (
                  disputes.map((dispute) => {
                    const statusConfig = DISPUTE_STATUS_CONFIG[dispute.status] || { label: dispute.status, color: 'bg-gray-100 text-gray-800' }
                    return (
                      <div key={dispute.id} id={`dispute-${dispute.id}`} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow">
                        
                        {/* Header de la impugnación */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {dispute.questions?.articles?.laws?.short_name} - Art. {dispute.questions?.articles?.article_number}
                            </span>
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
                          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">📋 Pregunta impugnada:</h4>
                          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">{dispute.questions?.question_text}</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                              Respuesta correcta: {['A', 'B', 'C', 'D'][dispute.questions?.correct_option - 1]}
                            </p>
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
                              <p className="text-green-800 dark:text-green-300 text-sm">{dispute.admin_response}</p>
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
                            
                            {/* Botones de satisfacción discretos */}
                            {(dispute.status === 'resolved' || dispute.status === 'rejected') && 
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
                            {(dispute.status === 'resolved' || dispute.status === 'rejected') && 
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

        {/* Modal de Chat */}
        {selectedConversation && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm sm:max-w-2xl h-[95vh] sm:h-[85vh] flex flex-col">
              
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b dark:border-gray-700">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                    💬 Chat
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {selectedConversation.status === 'waiting_admin' ? '⏳ Esperando respuesta de Vence' : 
                     selectedConversation.status === 'waiting_user' ? '💬 Te respondieron' : 
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
              <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Original:
                </div>
                <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                  {feedbacks.find(f => f.id === selectedConversation.feedback_id)?.message}
                </p>
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

              {/* Input para Usuario */}
              <div className="p-3 sm:p-4 border-t dark:border-gray-700">
                <form onSubmit={(e) => {
                  e.preventDefault()
                  if (newMessage.trim()) {
                    sendUserMessage(selectedConversation.id, newMessage)
                  }
                }}>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      type="text"
                      placeholder="Escribe tu respuesta..."
                      disabled={sendingMessage}
                      className="w-full sm:flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={sendingMessage || !newMessage.trim()}
                      className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors font-medium disabled:opacity-50 touch-manipulation"
                    >
                      {sendingMessage ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Enviando...
                        </span>
                      ) : (
                        '📤 Enviar'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modal de Feedback */}
      <FeedbackModal 
        isOpen={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false)
          // Recargar datos después de enviar feedback
          setTimeout(() => loadUserData(), 1000)
        }}
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