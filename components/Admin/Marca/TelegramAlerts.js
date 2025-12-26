'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function TelegramAlerts() {
  const { session, supabase } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('unread') // all, unread
  const [replyModal, setReplyModal] = useState(null) // alert to reply to
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadAlerts()
  }, [supabase, filter])

  async function loadAlerts() {
    if (!supabase) return

    try {
      setLoading(true)

      let query = supabase
        .from('telegram_alerts')
        .select(`
          *,
          telegram_groups (
            id,
            title,
            username
          )
        `)
        .order('detected_at', { ascending: false })
        .limit(50)

      if (filter === 'unread') {
        query = query.eq('is_read', false)
      }

      const { data, error } = await query

      if (error) throw error
      setAlerts(data || [])
    } catch (error) {
      console.error('Error loading alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(alertId) {
    if (!session) return

    try {
      const res = await fetch('/api/admin/marca/telegram/alerts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: alertId, isRead: true }),
      })

      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
        )
      }
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  async function markAllAsRead() {
    if (!session) return

    try {
      const res = await fetch('/api/admin/marca/telegram/alerts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ markAllRead: true }),
      })

      if (res.ok) {
        setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })))
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  async function sendReply() {
    if (!session || !replyModal || !replyText.trim()) return

    setSending(true)

    try {
      const res = await fetch('/api/admin/marca/telegram/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          alertId: replyModal.id,
          text: replyText.trim(),
          asReply: true,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === replyModal.id
              ? { ...a, is_replied: true, is_read: true, reply_text: replyText.trim() }
              : a
          )
        )
        setReplyModal(null)
        setReplyText('')
      } else {
        alert(data.error || 'Error enviando respuesta')
      }
    } catch (error) {
      console.error('Error sending reply:', error)
      alert('Error enviando respuesta')
    } finally {
      setSending(false)
    }
  }

  const unreadCount = alerts.filter((a) => !a.is_read).length

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header con filtros */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            Sin leer ({unreadCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            Todas
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            Marcar todas como leidas
          </button>
        )}
      </div>

      {/* Lista de alertas */}
      {alerts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            {filter === 'unread'
              ? 'No hay alertas sin leer'
              : 'No hay alertas todavia'}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Las alertas apareceran cuando se detecten menciones en los grupos monitorizados
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-all ${
                !alert.is_read ? 'border-l-4 border-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header del mensaje */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {alert.sender_name}
                    </span>
                    {alert.sender_username && (
                      <span className="text-sm text-gray-500">
                        @{alert.sender_username}
                      </span>
                    )}
                    <span className="text-sm text-gray-400">en</span>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {alert.telegram_groups?.title}
                    </span>
                  </div>

                  {/* Mensaje */}
                  <p className="text-gray-700 dark:text-gray-300 mb-2">
                    {alert.message_text}
                  </p>

                  {/* Keywords */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {alert.matched_keywords?.map((kw) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>

                  {/* Respuesta enviada */}
                  {alert.is_replied && alert.reply_text && (
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border-l-2 border-green-500">
                      <p className="text-xs text-green-600 dark:text-green-400 mb-1">
                        Tu respuesta:
                      </p>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        {alert.reply_text}
                      </p>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex flex-col items-end gap-2">
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(alert.detected_at).toLocaleString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>

                  <div className="flex gap-2">
                    {!alert.is_read && (
                      <button
                        onClick={() => markAsRead(alert.id)}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Marcar leida
                      </button>
                    )}

                    {!alert.is_replied && (
                      <button
                        onClick={() => setReplyModal(alert)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Responder
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de respuesta */}
      {replyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Responder mensaje
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                En {replyModal.telegram_groups?.title}
              </p>
            </div>

            <div className="p-4">
              {/* Mensaje original */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">
                  {replyModal.sender_name} escribio:
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {replyModal.message_text}
                </p>
              </div>

              {/* Textarea para respuesta */}
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Escribe tu respuesta..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                autoFocus
              />

              <p className="text-xs text-gray-500 mt-2">
                Se enviara como respuesta al mensaje desde tu cuenta de Telegram
              </p>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setReplyModal(null)
                  setReplyText('')
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={sendReply}
                disabled={sending || !replyText.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? 'Enviando...' : 'Enviar respuesta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
