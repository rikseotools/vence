// app/admin/feedback/page.js - Panel de administración de feedback
'use client'
import { useState, useEffect } from 'react'
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

  useEffect(() => {
    if (user) {
      loadFeedbacks()
      loadConversations()
    }
  }, [user])

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
      const { error } = await supabase
        .from('feedback_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          is_admin: true,
          message: message.trim()
        })

      if (error) throw error

      // Actualizar conversación
      await supabase
        .from('feedback_conversations')
        .update({ 
          status: 'waiting_user',
          last_message_at: new Date().toISOString(),
          admin_user_id: user.id
        })
        .eq('id', conversationId)

      // Crear notificación para el usuario
      const conversation = await supabase
        .from('feedback_conversations')
        .select('user_id, feedback_id')
        .eq('id', conversationId)
        .single()

      if (conversation.data?.user_id) {
        console.log('💬 Creando notificación de feedback response para user:', conversation.data.user_id)
        const { data: notifResult, error: notifError } = await supabase
          .from('notification_logs')
          .insert({
            user_id: conversation.data.user_id,
            message_sent: 'El equipo de iLoveTest te ha respondido',
            delivery_status: 'sent',
            context_data: { 
              type: 'feedback_response',
              title: 'Respuesta a tu feedback',
              conversation_id: conversationId,
              feedback_id: conversation.data.feedback_id
            }
          })
          .select()

        if (notifError) {
          console.error('❌ Error creando notificación:', notifError)
        } else {
          console.log('✅ Notificación creada exitosamente:', notifResult)
        }
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            💬 Gestión de Feedback
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Administrar comentarios y sugerencias de usuarios
          </p>
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
                      minute: '2-digit'
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
                    {conversations[feedback.id] && (
                      <button
                        onClick={() => {
                          setSelectedConversation(conversations[feedback.id])
                          loadChatMessages(conversations[feedback.id].id)
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        💬 Chat ({conversations[feedback.id].status === 'waiting_admin' ? 'Nuevo' : conversations[feedback.id].status})
                      </button>
                    )}
                    
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
                        {message.is_admin ? '👨‍💼 Tú (Admin)' : '👤 Usuario'}
                      </div>
                      <p className="text-sm">{message.message}</p>
                      <div className="text-xs mt-1 opacity-70">
                        {new Date(message.created_at).toLocaleString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                ))}
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
                
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      // Cerrar conversación
                      supabase
                        .from('feedback_conversations')
                        .update({ status: 'closed' })
                        .eq('id', selectedConversation.id)
                        .then(() => {
                          setSelectedConversation(null)
                          loadConversations()
                        })
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                  >
                    ✅ Cerrar Chat
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