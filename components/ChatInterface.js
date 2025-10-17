// components/ChatInterface.js - Interface de chat para feedback
'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function ChatInterface({ conversationId, onClose, feedbackData }) {
  const { user, supabase } = useAuth()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [conversation, setConversation] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (conversationId) {
      loadConversation()
      loadMessages()
      
      // Subscription para mensajes en tiempo real
      const subscription = supabase
        .channel(`feedback_messages:${conversationId}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'feedback_messages',
            filter: `conversation_id=eq.${conversationId}`
          }, 
          (payload) => {
            setMessages(prev => [...prev, payload.new])
            scrollToBottom()
          }
        )
        .subscribe()

      return () => subscription.unsubscribe()
    }
  }, [conversationId, supabase])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_conversations')
        .select('*')
        .eq('id', conversationId)
        .single()

      if (error) throw error
      setConversation(data)
    } catch (error) {
      console.error('Error cargando conversación:', error)
    }
  }

  const loadMessages = async () => {
    try {
      setLoading(true)
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
      setMessages(data || [])
    } catch (error) {
      console.error('Error cargando mensajes:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('feedback_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          is_admin: false,
          message: newMessage.trim()
        })

      if (error) throw error

      // Actualizar estado de conversación
      await supabase
        .from('feedback_conversations')
        .update({ 
          status: 'waiting_admin',
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId)

      setNewMessage('')
    } catch (error) {
      console.error('Error enviando mensaje:', error)
    } finally {
      setSending(false)
    }
  }

  const getStatusLabel = (status) => {
    const statuses = {
      'waiting_admin': '⏳ Esperando respuesta',
      'waiting_user': '💬 Tu turno',
      'open': '🔄 Conversación activa',
      'closed': '✅ Conversación cerrada'
    }
    return statuses[status] || status
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl h-96 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Cargando conversación...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              💬 Conversación de Feedback
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {conversation && getStatusLabel(conversation.status)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Feedback original */}
        {feedbackData && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Feedback original:
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-200">{feedbackData.message}</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.is_admin ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.is_admin 
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' 
                  : 'bg-blue-600 text-white'
              }`}>
                <div className="text-sm mb-1">
                  {message.is_admin ? (
                    <span className="font-medium">👨‍💼 Equipo Vence</span>
                  ) : (
                    <span className="font-medium">Tú</span>
                  )}
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

        {/* Input */}
        {conversation?.status !== 'closed' && (
          <form onSubmit={sendMessage} className="p-4 border-t dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe tu mensaje..."
                disabled={sending}
                className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  '📤'
                )}
              </button>
            </div>
          </form>
        )}

        {conversation?.status === 'closed' && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-400 text-center">
              ✅ Esta conversación ha sido cerrada. Gracias por tu feedback!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}