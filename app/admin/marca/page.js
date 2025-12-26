'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

export default function MarcaDashboard() {
  const { supabase, session } = useAuth()
  const [stats, setStats] = useState({
    telegramConnected: false,
    unreadAlerts: 0,
    totalGroups: 0,
    monitoringActive: false,
  })
  const [recentAlerts, setRecentAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [supabase, session])

  async function loadStats() {
    if (!supabase || !session) {
      setLoading(false)
      return
    }

    try {

      // Obtener estado de Telegram
      const authRes = await fetch('/api/admin/marca/telegram/auth', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const authData = await authRes.json()

      // Obtener estado del monitor
      const monitorRes = await fetch('/api/admin/marca/telegram/monitor', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const monitorData = await monitorRes.json()

      // Obtener grupos monitorizados
      const { data: groups } = await supabase
        .from('telegram_groups')
        .select('id')
        .eq('is_monitoring', true)

      // Obtener alertas no leídas
      const { data: alerts, count } = await supabase
        .from('telegram_alerts')
        .select('*, telegram_groups(title)', { count: 'exact' })
        .eq('is_read', false)
        .order('detected_at', { ascending: false })
        .limit(5)

      setStats({
        telegramConnected: authData.connected || false,
        telegramUser: authData.user,
        unreadAlerts: count || 0,
        totalGroups: groups?.length || 0,
        monitoringActive: monitorData.isMonitoring || false,
      })

      setRecentAlerts(alerts || [])
    } catch (error) {
      console.error('Error cargando stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Gesti&oacute;n de Marca
        </h1>
        <Link
          href="/admin/marca/telegram"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Configurar Telegram
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Telegram Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Telegram</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats.telegramConnected ? 'Conectado' : 'Desconectado'}
              </p>
              {stats.telegramUser && (
                <p className="text-xs text-gray-500">@{stats.telegramUser.username}</p>
              )}
            </div>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                stats.telegramConnected
                  ? 'bg-green-100 dark:bg-green-900'
                  : 'bg-red-100 dark:bg-red-900'
              }`}
            >
              <span className="text-2xl">
                {stats.telegramConnected ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </div>

        {/* Monitor Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monitor</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats.monitoringActive ? 'Activo' : 'Inactivo'}
              </p>
            </div>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                stats.monitoringActive
                  ? 'bg-green-100 dark:bg-green-900'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              <span className="text-2xl">
                {stats.monitoringActive ? '📡' : '⏸️'}
              </span>
            </div>
          </div>
        </div>

        {/* Grupos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Grupos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalGroups}
              </p>
              <p className="text-xs text-gray-500">monitorizados</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        {/* Alertas */}
        <Link
          href="/admin/marca/telegram?tab=alerts"
          className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Alertas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.unreadAlerts}
              </p>
              <p className="text-xs text-gray-500">sin leer</p>
            </div>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                stats.unreadAlerts > 0
                  ? 'bg-red-100 dark:bg-red-900'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              <span className="text-2xl">🔔</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Alertas Recientes */}
      {recentAlerts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Alertas Recientes
            </h2>
            <Link
              href="/admin/marca/telegram?tab=alerts"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Ver todas →
            </Link>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {alert.sender_name}
                      </span>
                      {alert.sender_username && (
                        <span className="text-xs text-gray-500">
                          @{alert.sender_username}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        en {alert.telegram_groups?.title}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                      {alert.message_text}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {alert.matched_keywords?.slice(0, 3).map((kw) => (
                        <span
                          key={kw}
                          className="px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(alert.detected_at).toLocaleString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!stats.telegramConnected && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Conecta tu cuenta de Telegram
          </h3>
          <p className="text-blue-700 dark:text-blue-300 mb-4">
            Para empezar a monitorizar menciones de tu marca en grupos de Telegram,
            primero necesitas conectar tu cuenta.
          </p>
          <Link
            href="/admin/marca/telegram"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Conectar Telegram
          </Link>
        </div>
      )}
    </div>
  )
}
