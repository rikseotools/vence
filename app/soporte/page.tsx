// app/soporte/page.tsx - Centro de soporte unificado para usuarios
'use client'
import { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import FeedbackModal from '@/components/FeedbackModal'
import type {
  FeedbackWithConversation,
  ConversationMessage,
} from '@/lib/api/soporte/schemas'

// ============================================
// TIPOS
// ============================================

interface DisputeQuestion {
  questionText: string
  optionA: string | null
  optionB: string | null
  optionC: string | null
  optionD: string | null
  correctOption: number | null
  explanation: string | null
  questionSubtype?: string | null
  solutionSteps?: string | null
  contentData?: unknown
  article?: {
    articleNumber: string
    title: string | null
    content: string | null
    lawShortName: string | null
  } | null
}

interface Dispute {
  id: string
  disputeType: string
  description: string
  status: string | null
  createdAt: string | null
  resolvedAt: string | null
  adminResponse: string | null
  appealText?: string | null
  appealSubmittedAt?: string | null
  isRead: boolean | null
  isPsychometric: boolean
  question: DisputeQuestion | null
}

// ============================================
// CONSTANTES
// ============================================

const FEEDBACK_TYPES: Record<string, { label: string; color: string }> = {
  'bug': { label: '🐛 Bug', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
  'suggestion': { label: '💡 Sugerencia', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  'content': { label: '📚 Contenido', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
  'design': { label: '🎨 Diseño', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300' },
  'praise': { label: '⭐ Felicitación', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  'other': { label: '❓ Otro', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' }
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  'pending': { label: '⏳ Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
  'in_review': { label: '👀 En Revisión', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  'resolved': { label: '✅ Cerrado', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  'dismissed': { label: '❌ Descartado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' }
}

const DISPUTE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  'pending': { label: '🟡 Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
  'reviewing': { label: '🔵 En revisión', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  'resolved': { label: '🟢 Resuelta', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  'rejected': { label: '🔴 Rechazada', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' }
}

const DISPUTE_TYPES: Record<string, string> = {
  'respuesta_incorrecta': '❌ Respuesta Incorrecta',
  'no_literal': '📝 No Literal',
  'otro': '💭 Otro Motivo',
  'ai_detected_error': '📊 Error en datos/gráficos',
  'other': '💭 Otro Motivo'
}

const QUESTION_SUBTYPES: Record<string, string> = {
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

// ============================================
// HELPER: obtener token de auth
// ============================================

async function getAuthToken(supabase: any): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

function SoporteContent() {
  const { user, supabase } = useAuth() as { user: any; supabase: any }
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'conversations' | 'disputes'>('conversations')
  const [feedbacks, setFeedbacks] = useState<FeedbackWithConversation[]>([])
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [initialConversationId, setInitialConversationId] = useState<string | null>(null)
  const [disputeFilter, setDisputeFilter] = useState<'all' | 'pending' | 'resolved'>('all')
  const [selectedQuestionModal, setSelectedQuestionModal] = useState<Dispute | null>(null)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)

  // Chat inline state
  const [inlineChatConversationId, setInlineChatConversationId] = useState<string | null>(null)
  const [inlineChatMessages, setInlineChatMessages] = useState<ConversationMessage[]>([])
  const [inlineChatLoading, setInlineChatLoading] = useState(false)
  const [inlineChatNewMessage, setInlineChatNewMessage] = useState('')
  const [inlineChatSending, setInlineChatSending] = useState(false)
  const inlineChatEndRef = useRef<HTMLDivElement>(null)
  const inlineChatTextareaRef = useRef<HTMLTextAreaElement>(null)

  // ============================================
  // CARGA DE DATOS
  // ============================================

  const loadUserData = useCallback(async () => {
    if (!supabase) return
    try {
      setLoading(true)
      const token = await getAuthToken(supabase)
      if (!token) return

      const res = await fetch('/api/soporte', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()

      if (data.success) {
        setFeedbacks(data.feedbacks ?? [])
        setDisputes(data.disputes ?? [])
      }
    } catch (error) {
      console.error('Error cargando datos de soporte:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (user) {
      loadUserData()
    } else {
      setLoading(false)
    }
  }, [user, loadUserData])

  // ============================================
  // CHAT INLINE: cargar mensajes
  // ============================================

  const loadInlineChatMessages = useCallback(async (conversationId: string) => {
    if (!supabase) return
    try {
      setInlineChatLoading(true)
      const token = await getAuthToken(supabase)
      if (!token) return

      const res = await fetch(`/api/soporte/messages?conversationId=${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()

      if (data.success) {
        setInlineChatMessages(data.messages ?? [])
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error)
    } finally {
      setInlineChatLoading(false)
    }
  }, [supabase])

  // Auto-scroll al final de mensajes
  useEffect(() => {
    inlineChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [inlineChatMessages])

  // ============================================
  // CHAT INLINE: enviar mensaje (usa POST /api/feedback/message existente)
  // ============================================

  const sendInlineChatMessage = async () => {
    if (!inlineChatConversationId || !inlineChatNewMessage.trim() || !user) return
    try {
      setInlineChatSending(true)
      const res = await fetch('/api/feedback/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: inlineChatConversationId,
          message: inlineChatNewMessage.trim(),
          userId: user.id,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setInlineChatNewMessage('')
        // Recargar mensajes
        await loadInlineChatMessages(inlineChatConversationId)

        // Notificar admin
        try {
          // Buscar feedback_id del feedback asociado
          const feedback = feedbacks.find(f => f.conversation?.id === inlineChatConversationId)
          const { sendAdminChatResponseNotification } = await import('../../lib/notifications/adminEmailNotifications')
          await sendAdminChatResponseNotification({
            conversation_id: inlineChatConversationId,
            user_id: user.id,
            user_email: user.email,
            user_name: (user as any).user_metadata?.full_name || 'Usuario',
            message: inlineChatNewMessage.trim(),
            feedback_id: feedback?.id,
            created_at: new Date().toISOString()
          })
        } catch {
          // No fallar si la notificación falla
        }

        // Recargar datos generales
        loadUserData()
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      alert('Error enviando mensaje. Inténtalo de nuevo.')
    } finally {
      setInlineChatSending(false)
    }
  }

  // ============================================
  // ABRIR CHAT INLINE DESDE URL (conversation_id)
  // ============================================

  useEffect(() => {
    const conversationId = searchParams.get('conversation_id')
    if (conversationId) {
      setInlineChatConversationId(conversationId)
      loadInlineChatMessages(conversationId)
      setActiveTab('conversations')

      // Marcar notificaciones como leídas
      if (user && supabase) {
        supabase
          .from('notification_logs')
          .update({ opened_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .is('opened_at', null)
          .contains('context_data', { conversation_id: conversationId })
          .then(({ error }: { error: any }) => {
            if (!error) {
              window.dispatchEvent(new Event('notifications-updated'))
            }
          })
      }
    }
  }, [searchParams, user, supabase, loadInlineChatMessages])

  // ============================================
  // IMPUGNACIONES: desde URL
  // ============================================

  useEffect(() => {
    const disputeId = searchParams.get('dispute_id')
    const tab = searchParams.get('tab')

    if (tab === 'impugnaciones') {
      setActiveTab('disputes')

      if (disputeId && disputes.length > 0) {
        const dispute = disputes.find(d => d.id === disputeId)

        if (dispute && !dispute.isRead) {
          const tableName = dispute.isPsychometric ? 'psychometric_question_disputes' : 'question_disputes'
          supabase
            .from(tableName)
            .update({ is_read: true })
            .eq('id', disputeId)
            .eq('user_id', user.id)
            .then(({ error }: { error: any }) => {
              if (!error) {
                setDisputes(prev => prev.map(d =>
                  d.id === disputeId ? { ...d, isRead: true } : d
                ))
              }
            })
        }

        setTimeout(() => {
          const disputeElement = document.getElementById(`dispute-${disputeId}`)
          if (disputeElement) {
            disputeElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
            disputeElement.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-50')
            setTimeout(() => {
              disputeElement.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-50')
            }, 3000)
          }
        }, 500)
      }
    }
  }, [searchParams, disputes, user, supabase])

  // ============================================
  // AUTO-DETECTAR TAB POR DEFECTO
  // ============================================

  useEffect(() => {
    const hasUrlParams = searchParams.get('tab') || searchParams.get('conversation_id') || searchParams.get('dispute_id')

    if (!hasUrlParams && (disputes.length > 0 || feedbacks.some(f => f.conversation))) {
      const pendingDisputesList = disputes.filter(d => d.status === 'pending')
      const waitingUserConvs = feedbacks.filter(f => f.conversation?.status === 'waiting_user')

      if (waitingUserConvs.length > 0) {
        setActiveTab('conversations')
      } else if (pendingDisputesList.length > 0) {
        setActiveTab('disputes')
        setDisputeFilter('pending')
      }
    }
  }, [disputes, feedbacks, searchParams])

  // ============================================
  // MODALS: ESC + body scroll lock
  // ============================================

  useEffect(() => {
    if (selectedQuestionModal || expandedImage) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = 'unset' }
    }
    return undefined
  }, [selectedQuestionModal, expandedImage])

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (expandedImage) {
          setExpandedImage(null)
        } else if (selectedQuestionModal) {
          setSelectedQuestionModal(null)
        }
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [expandedImage, selectedQuestionModal])

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderMessageWithImages = (messageText: string) => {
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
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  if (target.nextElementSibling) {
                    (target.nextElementSibling as HTMLElement).style.display = 'block'
                  }
                }}
              />
              <div style={{display: 'none'}} className="text-xs text-blue-600 dark:text-blue-400">
                Error cargando imagen
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all">
                <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">Ver</span>
              </div>
            </div>
          </div>
        )
      } else {
        return part.trim() ? <span key={index}>{part}</span> : null
      }
    })
  }

  const getFilteredDisputes = () => {
    if (disputeFilter === 'all') return disputes
    if (disputeFilter === 'pending') return disputes.filter(d => d.status === 'pending')
    return disputes.filter(d => d.status === 'resolved' || d.status === 'rejected' || d.status === 'appealed')
  }

  const handleDisputeSatisfaction = async (dispute: Dispute, isSatisfied: boolean) => {
    try {
      if (isSatisfied) {
        await supabase
          .from('question_disputes')
          .update({
            status: 'resolved',
            appeal_text: 'Usuario de acuerdo con la respuesta del administrador.',
            appeal_submitted_at: new Date().toISOString()
          })
          .eq('id', dispute.id)

        alert('Gracias por tu feedback. La impugnación se ha marcado como resuelta.')
      } else {
        const appealReason = prompt('Por favor, explica por qué no estás de acuerdo con la respuesta y qué consideras que debería corregirse:')
        if (!appealReason?.trim()) return

        await supabase
          .from('question_disputes')
          .update({
            status: 'pending',
            appeal_text: appealReason.trim(),
            appeal_submitted_at: new Date().toISOString()
          })
          .eq('id', dispute.id)

        alert('Tu apelación ha sido registrada. Vence revisará tu caso nuevamente.')
      }

      await loadUserData()
    } catch (error) {
      console.error('Error procesando satisfacción:', error)
      alert('Error al procesar tu respuesta. Inténtalo de nuevo.')
    }
  }

  // ============================================
  // COMPUTED
  // ============================================

  const pendingFeedbacks = feedbacks.filter(f => f.status === 'pending')
  const waitingUserConversations = feedbacks.filter(f => f.conversation?.status === 'waiting_user')
  const conversationsCount = feedbacks.filter(f => f.conversation).length
  const pendingDisputesList = disputes.filter(d => d.status === 'pending')

  // Encontrar el feedback asociado al chat inline
  const inlineChatFeedback = inlineChatConversationId
    ? feedbacks.find(f => f.conversation?.id === inlineChatConversationId)
    : null

  // ============================================
  // AUTH GUARD
  // ============================================

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

  // ============================================
  // CHAT INLINE VIEW
  // ============================================

  if (inlineChatConversationId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-3xl">

          {/* Header con botón volver */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4">
            <div className="flex items-center gap-3 p-4 border-b dark:border-gray-700">
              <button
                onClick={() => {
                  setInlineChatConversationId(null)
                  setInlineChatMessages([])
                  // Limpiar URL param sin recargar
                  const url = new URL(window.location.href)
                  url.searchParams.delete('conversation_id')
                  window.history.replaceState({}, '', url.toString())
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Volver"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                  Conversación con Soporte
                </h2>
                {inlineChatFeedback && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FEEDBACK_TYPES[inlineChatFeedback.type]?.color || 'bg-gray-100 text-gray-800'}`}>
                      {FEEDBACK_TYPES[inlineChatFeedback.type]?.label || inlineChatFeedback.type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[inlineChatFeedback.status ?? '']?.color || ''}`}>
                      {STATUS_CONFIG[inlineChatFeedback.status ?? '']?.label || inlineChatFeedback.status}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mensajes */}
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {inlineChatLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Cargando mensajes...</p>
                </div>
              ) : inlineChatMessages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No hay mensajes aún</p>
                </div>
              ) : (
                inlineChatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isAdmin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        msg.isAdmin
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                          : 'bg-blue-600 text-white rounded-tr-sm'
                      }`}
                    >
                      {msg.isAdmin && (
                        <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                          Vence Soporte
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {renderMessageWithImages(msg.message)}
                      </div>
                      <div className={`text-[10px] mt-1 ${msg.isAdmin ? 'text-gray-400 dark:text-gray-500' : 'text-blue-200'}`}>
                        {msg.createdAt && new Date(msg.createdAt).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/Madrid'
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={inlineChatEndRef} />
            </div>

            {/* Input de mensaje */}
            <div className="p-4 border-t dark:border-gray-700">
              <div className="flex gap-2">
                <textarea
                  ref={inlineChatTextareaRef}
                  value={inlineChatNewMessage}
                  onChange={(e) => setInlineChatNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendInlineChatMessage()
                    }
                  }}
                  placeholder="Escribe tu mensaje..."
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={sendInlineChatMessage}
                  disabled={inlineChatSending || !inlineChatNewMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
                >
                  {inlineChatSending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de Imagen Expandida */}
        {expandedImage && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setExpandedImage(null) }}
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
      </div>
    )
  }

  // ============================================
  // VISTA NORMAL (tabs)
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-6xl">

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Centro de Soporte
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestiona tus consultas, feedback y conversaciones con nuestro equipo
          </p>
        </div>

        {/* Stats Cards */}
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
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{conversationsCount}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Chats</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Acciones Rápidas
          </h3>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => {
                setInitialConversationId(null)
                setShowFeedbackModal(true)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Abrir chat soporte
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
              Chat de soporte ({feedbacks.length})
            </button>
            <button
              onClick={() => setActiveTab('disputes')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'disputes'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Impugnaciones ({disputes.length})
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
                      Abrir chat soporte
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
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_CONFIG[feedback.status ?? '']?.color}`}>
                            {STATUS_CONFIG[feedback.status ?? '']?.label}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {feedback.createdAt && new Date(feedback.createdAt).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Madrid'
                          })}
                        </div>
                      </div>

                      {/* Mensaje - ocultar si es conversación iniciada por soporte */}
                      {!feedback.message?.startsWith('[Conversación iniciada') && (
                        <p className="text-gray-800 dark:text-gray-200 mb-3">
                          {feedback.message}
                        </p>
                      )}

                      {/* Chat conversation indicator */}
                      {feedback.conversation && (
                        <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-green-800 dark:text-green-300">
                              {feedback.message?.startsWith('[Conversación iniciada')
                                ? 'Conversación con soporte'
                                : `"${feedback.message.substring(0, 50)}${feedback.message.length > 50 ? '...' : ''}"`}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                feedback.conversation.status === 'waiting_admin'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                  : feedback.conversation.status === 'waiting_user'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {feedback.conversation.status === 'waiting_admin' ? 'Esperando respuesta' :
                                 feedback.conversation.status === 'waiting_user' ? 'Nueva respuesta' :
                                 feedback.conversation.status}
                              </span>
                              <button
                                onClick={() => {
                                  setInitialConversationId(feedback.conversation!.id)
                                  setShowFeedbackModal(true)
                                }}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                  feedback.conversation.status === 'waiting_user'
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                              >
                                {feedback.conversation.status === 'waiting_user'
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

                {/* Filtros */}
                {disputes.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4 mb-6">
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm sm:text-base">Filtrar:</h4>
                      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                        {([
                          { key: 'pending' as const, label: 'Pendientes', emoji: '⏳', count: pendingDisputesList.length },
                          { key: 'resolved' as const, label: 'Resueltas', emoji: '✅', count: disputes.filter(d => d.status === 'resolved' || d.status === 'rejected' || d.status === 'appealed').length },
                          { key: 'all' as const, label: 'Todas', emoji: '📋', count: disputes.length }
                        ]).map(filter => (
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

                {getFilteredDisputes().length === 0 ? (
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
                      Hacer un Test
                    </Link>
                  </div>
                ) : (
                  getFilteredDisputes().map((dispute) => {
                    const statusConfig = DISPUTE_STATUS_CONFIG[dispute.status ?? ''] || { label: dispute.status, color: 'bg-gray-100 text-gray-800' }
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
                                Psicotécnico
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {dispute.question?.article?.lawShortName} - Art. {dispute.question?.article?.articleNumber}
                              </span>
                            )}
                            <span className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                              {DISPUTE_TYPES[dispute.disputeType] || dispute.disputeType}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {dispute.createdAt && new Date(dispute.createdAt).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>

                        {/* Pregunta impugnada (compacta) */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                              {dispute.isPsychometric ? 'Pregunta psicotécnica:' : 'Pregunta impugnada:'}
                            </h4>
                            <button
                              onClick={() => setSelectedQuestionModal(dispute)}
                              className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                            >
                              Ver pregunta
                            </button>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">{dispute.question?.questionText}</p>

                            {!dispute.isPsychometric && dispute.question?.correctOption != null && (
                              <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded border-l-4 border-green-400">
                                <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
                                  Respuesta correcta: {['A', 'B', 'C', 'D'][dispute.question.correctOption]}
                                </p>
                                <p className="text-sm text-green-800 dark:text-green-300">
                                  {dispute.question.correctOption === 0 ? dispute.question.optionA :
                                   dispute.question.correctOption === 1 ? dispute.question.optionB :
                                   dispute.question.correctOption === 2 ? dispute.question.optionC :
                                   dispute.question.correctOption === 3 ? dispute.question.optionD : 'N/A'}
                                </p>
                              </div>
                            )}

                            {dispute.isPsychometric && dispute.question?.questionSubtype && (
                              <div className="bg-purple-50 dark:bg-purple-900/30 p-2 rounded border-l-4 border-purple-400">
                                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                  Tipo: {QUESTION_SUBTYPES[dispute.question.questionSubtype] || dispute.question.questionSubtype.replace(/_/g, ' ')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tu reporte */}
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Tu reporte:</h4>
                          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border-l-4 border-blue-400">
                            <p className="text-blue-800 dark:text-blue-300 text-sm">{dispute.description}</p>
                          </div>
                        </div>

                        {/* Respuesta del administrador */}
                        {dispute.adminResponse && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Respuesta de Vence:</h4>
                            <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg border-l-4 border-green-400">
                              <p className="text-green-800 dark:text-green-300 text-sm whitespace-pre-wrap leading-relaxed">{dispute.adminResponse}</p>
                              {dispute.resolvedAt && (
                                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                  Resuelto el {new Date(dispute.resolvedAt).toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              )}
                            </div>

                            {/* Botones de satisfacción */}
                            {!dispute.isPsychometric && (dispute.status === 'resolved' || dispute.status === 'rejected') &&
                             dispute.appealText !== 'Usuario de acuerdo con la respuesta del administrador.' && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                  ¿Estás de acuerdo con esta respuesta?
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleDisputeSatisfaction(dispute, true)}
                                    className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                  >
                                    Sí, gracias
                                  </button>
                                  <button
                                    onClick={() => handleDisputeSatisfaction(dispute, false)}
                                    className="inline-flex items-center px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                                  >
                                    No, quiero apelar
                                  </button>
                                </div>
                              </div>
                            )}

                            {!dispute.isPsychometric && (dispute.status === 'resolved' || dispute.status === 'rejected') &&
                             dispute.appealText === 'Usuario de acuerdo con la respuesta del administrador.' && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                  Marcado como resuelto satisfactoriamente
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Alegación */}
                        {dispute.status === 'pending' && dispute.appealText &&
                         dispute.appealText !== 'Usuario de acuerdo con la respuesta del administrador.' && (
                          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                            <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                              Tu Alegación
                            </h4>
                            <div className="text-sm text-orange-700 dark:text-orange-300">
                              {dispute.appealText}
                            </div>
                            <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                              En revisión por Vence
                            </div>
                          </div>
                        )}

                        {/* Estado pendiente */}
                        {dispute.status === 'pending' && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg border-l-4 border-yellow-400">
                            <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                              Tu impugnación está pendiente de revisión. Te notificaremos cuando sea procesada.
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
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedQuestionModal(null) }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm sm:max-w-lg lg:max-w-3xl max-h-[90vh] overflow-y-auto">

              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {selectedQuestionModal.isPsychometric ? 'Pregunta Psicotécnica' : 'Pregunta Completa'}
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

                {selectedQuestionModal.isPsychometric && (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                      Pregunta Psicotécnica
                    </span>
                    {selectedQuestionModal.question?.questionSubtype && (
                      <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs">
                        {QUESTION_SUBTYPES[selectedQuestionModal.question.questionSubtype] || selectedQuestionModal.question.questionSubtype.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                )}

                {/* Pregunta */}
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Pregunta:</h4>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {selectedQuestionModal.question?.questionText}
                    </p>
                  </div>
                </div>

                {/* Opciones */}
                {selectedQuestionModal.question?.optionA && (
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Opciones:</h4>
                    <div className="space-y-2">
                      {['A', 'B', 'C', 'D'].map((letter, index) => {
                        const q = selectedQuestionModal.question!
                        const isCorrect = q.correctOption === index
                        const optionKey = `option${letter}` as keyof DisputeQuestion
                        const optionText = q[optionKey] as string | null

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

                {/* Pasos de solución - Solo psicotécnicas */}
                {selectedQuestionModal.isPsychometric && selectedQuestionModal.question?.solutionSteps && (
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Pasos de solución:</h4>
                    <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border-l-4 border-purple-400">
                      <div className="text-purple-800 dark:text-purple-200 leading-relaxed whitespace-pre-wrap text-sm">
                        {selectedQuestionModal.question.solutionSteps}
                      </div>
                    </div>
                  </div>
                )}

                {/* Explicación */}
                {selectedQuestionModal.question?.explanation && (
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Explicación:</h4>
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border-l-4 border-blue-400">
                      <div className="text-blue-800 dark:text-blue-200 leading-relaxed whitespace-pre-wrap text-sm">
                        {selectedQuestionModal.question.explanation}
                      </div>
                    </div>
                  </div>
                )}

                {/* Artículo */}
                {selectedQuestionModal.question?.article && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200">Artículo:</h4>
                      <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full">
                        Contiene respuesta
                      </span>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border-l-4 border-purple-400">
                      <p className="text-purple-800 dark:text-purple-200 font-medium mb-3">
                        {selectedQuestionModal.question.article.lawShortName} - Artículo {selectedQuestionModal.question.article.articleNumber}
                      </p>

                      {selectedQuestionModal.question.article.content ? (
                        <div className="text-purple-700 dark:text-purple-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedQuestionModal.question.article.content}
                        </div>
                      ) : (
                        <div className="text-purple-600 dark:text-purple-400 text-sm italic">
                          El contenido del artículo no está disponible.
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modal de Imagen Expandida */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setExpandedImage(null) }}
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
          setInitialConversationId(null)
          setTimeout(() => loadUserData(), 1000)
        }}
        initialConversationId={initialConversationId as any}
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
