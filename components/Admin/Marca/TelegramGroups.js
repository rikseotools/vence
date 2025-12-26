'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function TelegramGroups({ onGroupsChange }) {
  const { supabase, user } = useAuth()
  const [session, setSession] = useState(null)
  const [monitoredGroups, setMonitoredGroups] = useState([])
  const [telegramGroups, setTelegramGroups] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingTelegram, setLoadingTelegram] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [view, setView] = useState('monitored') // monitored, mygroups, search
  const [editingKeywords, setEditingKeywords] = useState(null)
  const [keywordsText, setKeywordsText] = useState('')

  // Obtener session de Supabase
  useEffect(() => {
    async function getSession() {
      if (!supabase) return
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      setSession(currentSession)
    }
    getSession()
  }, [supabase, user])

  useEffect(() => {
    loadMonitoredGroups()
  }, [supabase])

  async function loadMonitoredGroups() {
    if (!supabase) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('telegram_groups')
        .select('*')
        .order('added_at', { ascending: false })

      if (error) throw error
      setMonitoredGroups(data || [])
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadTelegramGroups() {
    if (!session) return

    try {
      setLoadingTelegram(true)
      const res = await fetch('/api/admin/marca/telegram/groups?source=telegram', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()

      if (data.error) {
        alert(data.error)
        return
      }

      setTelegramGroups(data.groups || [])
      setView('mygroups')
    } catch (error) {
      console.error('Error loading Telegram groups:', error)
    } finally {
      setLoadingTelegram(false)
    }
  }

  async function searchGroups() {
    if (!session || !searchQuery.trim()) return

    try {
      setSearching(true)
      const res = await fetch(
        `/api/admin/marca/telegram/groups?search=${encodeURIComponent(searchQuery)}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )
      const data = await res.json()

      if (data.error) {
        alert(data.error)
        return
      }

      setSearchResults(data.groups || [])
      setView('search')
    } catch (error) {
      console.error('Error searching groups:', error)
    } finally {
      setSearching(false)
    }
  }

  async function addGroup(group) {
    if (!session) return

    try {
      const res = await fetch('/api/admin/marca/telegram/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: group.id,
          title: group.title,
          username: group.username,
          memberCount: group.memberCount,
        }),
      })

      const data = await res.json()

      if (data.success) {
        loadMonitoredGroups()
        onGroupsChange?.()
        // Actualizar lista de grupos de Telegram
        setTelegramGroups((prev) =>
          prev.map((g) => (g.id === group.id ? { ...g, isMonitored: true } : g))
        )
      } else {
        alert(data.error || 'Error añadiendo grupo')
      }
    } catch (error) {
      console.error('Error adding group:', error)
    }
  }

  async function toggleMonitoring(group) {
    if (!session) return

    try {
      const res = await fetch('/api/admin/marca/telegram/groups', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: group.id,
          isMonitoring: !group.is_monitoring,
        }),
      })

      if (res.ok) {
        setMonitoredGroups((prev) =>
          prev.map((g) =>
            g.id === group.id ? { ...g, is_monitoring: !g.is_monitoring } : g
          )
        )
        onGroupsChange?.()
      }
    } catch (error) {
      console.error('Error toggling monitoring:', error)
    }
  }

  async function updateKeywords(groupId) {
    if (!session) return

    try {
      const keywords = keywordsText
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 0)

      const res = await fetch('/api/admin/marca/telegram/groups', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: groupId, keywords }),
      })

      if (res.ok) {
        setMonitoredGroups((prev) =>
          prev.map((g) => (g.id === groupId ? { ...g, keywords } : g))
        )
        setEditingKeywords(null)
        setKeywordsText('')
      }
    } catch (error) {
      console.error('Error updating keywords:', error)
    }
  }

  async function removeGroup(groupId) {
    if (!session) return
    if (!confirm('¿Eliminar este grupo de la monitorizacion?')) return

    try {
      const res = await fetch(`/api/admin/marca/telegram/groups?id=${groupId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        setMonitoredGroups((prev) => prev.filter((g) => g.id !== groupId))
        onGroupsChange?.()
      }
    } catch (error) {
      console.error('Error removing group:', error)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs y acciones */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setView('monitored')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              view === 'monitored'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            Monitorizados ({monitoredGroups.length})
          </button>
          <button
            onClick={loadTelegramGroups}
            disabled={loadingTelegram}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              view === 'mygroups'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {loadingTelegram ? 'Cargando...' : 'Mis Grupos'}
          </button>
        </div>

        {/* Buscador */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchGroups()}
            placeholder="Buscar grupos publicos..."
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={searchGroups}
            disabled={searching || !searchQuery.trim()}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {searching ? '...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Vista: Grupos monitorizados */}
      {view === 'monitored' && (
        <>
          {monitoredGroups.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">
                No hay grupos monitorizados
              </p>
              <button
                onClick={loadTelegramGroups}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Añadir grupos
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {monitoredGroups.map((group) => (
                <div
                  key={group.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {group.title}
                        </h3>
                        {group.username && (
                          <span className="text-sm text-gray-500">
                            @{group.username}
                          </span>
                        )}
                      </div>

                      {/* Keywords */}
                      {editingKeywords === group.id ? (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={keywordsText}
                            onChange={(e) => setKeywordsText(e.target.value)}
                            placeholder="test, vence, oposiciones..."
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <button
                            onClick={() => updateKeywords(group.id)}
                            className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => {
                              setEditingKeywords(null)
                              setKeywordsText('')
                            }}
                            className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {group.keywords?.map((kw) => (
                            <span
                              key={kw}
                              className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                            >
                              {kw}
                            </span>
                          ))}
                          <button
                            onClick={() => {
                              setEditingKeywords(group.id)
                              setKeywordsText(group.keywords?.join(', ') || '')
                            }}
                            className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-800"
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Toggle monitoring */}
                      <button
                        onClick={() => toggleMonitoring(group)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          group.is_monitoring
                            ? 'bg-green-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            group.is_monitoring ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>

                      {/* Remove */}
                      <button
                        onClick={() => removeGroup(group.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Vista: Mis grupos de Telegram */}
      {view === 'mygroups' && (
        <div className="space-y-3">
          {telegramGroups.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">
                No se encontraron grupos
              </p>
            </div>
          ) : (
            telegramGroups.map((group) => (
              <div
                key={group.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center justify-between"
              >
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {group.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {group.username && <span>@{group.username}</span>}
                    {group.memberCount > 0 && (
                      <span>{group.memberCount.toLocaleString()} miembros</span>
                    )}
                  </div>
                </div>

                {group.isMonitored ? (
                  <span className="px-3 py-1 text-sm bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-lg">
                    Monitorizado
                  </span>
                ) : (
                  <button
                    onClick={() => addGroup(group)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Añadir
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Vista: Resultados de búsqueda */}
      {view === 'search' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Resultados para {searchQuery}
          </p>
          {searchResults.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">
                No se encontraron grupos
              </p>
            </div>
          ) : (
            searchResults.map((group) => (
              <div
                key={group.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {group.title}
                    </h3>
                    {group.isVerified && (
                      <span className="text-blue-500">✓</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {group.username && <span>@{group.username}</span>}
                    {group.memberCount > 0 && (
                      <span>{group.memberCount.toLocaleString()} miembros</span>
                    )}
                  </div>
                  {group.about && (
                    <p className="text-sm text-gray-400 mt-1 line-clamp-1">
                      {group.about}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => addGroup(group)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Unirse y monitorizar
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
