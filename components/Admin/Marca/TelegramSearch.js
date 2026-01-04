'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function TelegramSearch({ onReply }) {
  const { supabase, user } = useAuth()
  const [session, setSession] = useState(null)
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  useEffect(() => {
    async function getSession() {
      if (!supabase) return
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      setSession(currentSession)
    }
    getSession()
  }, [supabase, user])

  useEffect(() => {
    loadGroups()
  }, [session])

  async function loadGroups() {
    if (!session) {
      setLoadingGroups(false)
      return
    }

    try {
      setLoadingGroups(true)
      const res = await fetch('/api/admin/marca/telegram/groups?source=db', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()

      if (!data.error) {
        setGroups(data.groups || [])
        if (data.groups?.length > 0) {
          setSelectedGroup(data.groups[0].id.toString())
        }
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoadingGroups(false)
    }
  }

  async function searchMessages() {
    if (!session || !selectedGroup) return

    try {
      setLoading(true)
      const queryParam = searchQuery.trim()
        ? `&q=${encodeURIComponent(searchQuery.trim())}`
        : ''

      const res = await fetch(
        `/api/admin/marca/telegram/search?groupId=${selectedGroup}${queryParam}&limit=100`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )
      const data = await res.json()

      if (data.error) {
        alert(data.error)
        return
      }

      setMessages(data.messages || [])
    } catch (error) {
      console.error('Error searching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  async function sendReply() {
    if (!session || !replyingTo || !replyText.trim()) return

    try {
      setSendingReply(true)
      const res = await fetch('/api/admin/marca/telegram/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          groupId: selectedGroup,
          messageId: replyingTo.id,
          text: replyText.trim(),
          asReply: true,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setReplyingTo(null)
        setReplyText('')
        alert('Respuesta enviada')
        onReply?.()
      } else {
        alert(data.error || 'Error enviando respuesta')
      }
    } catch (error) {
      console.error('Error sending reply:', error)
      alert('Error enviando respuesta')
    } finally {
      setSendingReply(false)
    }
  }

  function formatDate(isoDate) {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    const timeStr = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })

    if (diffDays === 0) {
      return `Hoy ${timeStr}`
    } else if (diffDays === 1) {
      return `Ayer ${timeStr}`
    } else if (diffDays < 7) {
      return `Hace ${diffDays} días ${timeStr}`
    } else {
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: diffDays > 365 ? 'numeric' : undefined,
      }) + ` ${timeStr}`
    }
  }

  if (loadingGroups) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controles de búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Selector de grupo */}
        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
        >
          {groups.length === 0 ? (
            <option value="">No hay grupos</option>
          ) : (
            groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.title}
              </option>
            ))
          )}
        </select>

        {/* Campo de búsqueda */}
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchMessages()}
            placeholder="Buscar mensajes... (vacío = recientes)"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={searchMessages}
            disabled={loading || !selectedGroup}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Resultados */}
      {messages.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {messages.length} mensaje{messages.length !== 1 ? 's' : ''} encontrado{messages.length !== 1 ? 's' : ''}
        </div>
      )}

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {messages.length === 0 && !loading && (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">
              Selecciona un grupo y haz clic en Buscar
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Header: nombre y fecha */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {message.senderName}
                  </span>
                  {message.senderUsername && (
                    <span className="text-sm text-gray-500">
                      @{message.senderUsername}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {formatDate(message.date)}
                  </span>
                </div>

                {/* Texto del mensaje */}
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {message.text}
                </p>
              </div>

              {/* Botón responder */}
              <button
                onClick={() => {
                  setReplyingTo(message)
                  setReplyText('')
                }}
                className="shrink-0 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                Responder
              </button>
            </div>

            {/* Formulario de respuesta inline */}
            {replyingTo?.id === message.id && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Escribe tu respuesta..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={sendReply}
                    disabled={sendingReply || !replyText.trim()}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {sendingReply ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
