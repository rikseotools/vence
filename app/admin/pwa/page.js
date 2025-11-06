// app/admin/pwa/page.js - Panel de control PWA
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import PWAStatsReal from '@/components/Admin/PWAStatsReal'

export default function PWAAdminPage() {
  const { user, supabase, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [stats, setStats] = useState(null)
  const [sendLoading, setSendLoading] = useState(false)
  const [sendResult, setSendResult] = useState(null)
  
  // Estados para el formulario de notificación
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    body: '',
    url: '/',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    requireInteraction: false,
    category: 'general',
    targetType: 'all' // all, active_users, specific_users
  })

  useEffect(() => {
    async function checkAdminAccess() {
      if (authLoading) return
      
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const { data: isAdminResult, error } = await supabase.rpc('is_current_user_admin')
        
        if (error) {
          console.error('Error verificando admin status:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(isAdminResult === true)
        }
        
        if (isAdminResult === true) {
          loadPWAStats()
        }
      } catch (error) {
        console.error('Error checking admin access:', error)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [user, authLoading, supabase])

  const loadPWAStats = async () => {
    try {
      console.log('📊 Cargando estadísticas PWA reales...')
      
      // 1. Datos PWA reales desde tablas tracking
      const [pwaInstallsResult, notificationEventsResult] = await Promise.all([
        // PWA installs reales
        supabase
          .from('pwa_events')
          .select('id, user_id, event_type, created_at')
          .eq('event_type', 'pwa_installed'),
        
        // Push notifications eventos (últimos 7 días)
        supabase
          .from('notification_events')
          .select('user_id, event_type, created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ])

      // Procesar datos reales
      const pwaInstalls = pwaInstallsResult.data || []
      const notificationEvents = notificationEventsResult.data || []
      
      // Si no hay datos PWA, mostrar 0 (datos reales)
      const totalPWAInstalls = pwaInstalls.length
      
      // Usuarios únicos con notificaciones activas
      const activeNotificationUsers = new Set(notificationEvents.map(e => e.user_id)).size
      
      // Notificaciones enviadas (últimos 7 días)
      const notificationsSent = notificationEvents.filter(e => e.event_type === 'notification_sent').length
      const notificationsClicked = notificationEvents.filter(e => e.event_type === 'notification_clicked').length
      
      // Click rate real
      const clickRate = notificationsSent > 0 ? ((notificationsClicked / notificationsSent) * 100).toFixed(1) : 0
      
      console.log('📊 Estadísticas PWA reales cargadas:', {
        pwaInstalls: totalPWAInstalls,
        activeNotificationUsers,
        notificationsSent,
        clickRate
      })
      
      const processedStats = {
        totalInstalls: totalPWAInstalls,
        activeSubscriptions: activeNotificationUsers,
        notificationsSent: notificationsSent,
        notificationsClicked: notificationsClicked,
        clickRate: clickRate,
        recentInstalls: pwaInstalls.slice(0, 5),
        activeUsersList: notificationEvents.slice(0, 10)
      }

      setStats(processedStats)
      console.log('📱 PWA Stats loaded:', processedStats)

    } catch (error) {
      console.error('Error cargando estadísticas PWA:', error)
    }
  }

  const handleSendNotification = async (e) => {
    e.preventDefault()
    setSendLoading(true)
    setSendResult(null)

    try {
      console.log('📱 Enviando notificación PWA:', notificationForm)

      // Crear el payload de la notificación
      const notificationPayload = {
        title: notificationForm.title,
        body: notificationForm.body,
        icon: notificationForm.icon,
        badge: notificationForm.badge,
        data: {
          url: notificationForm.url,
          category: notificationForm.category,
          timestamp: Date.now(),
          trackingId: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        },
        actions: [
          {
            action: 'open',
            title: '📚 Abrir App',
            icon: '/icon-192.png'
          },
          {
            action: 'dismiss',
            title: '⏰ Después',
            icon: '/icon-dismiss.png'
          }
        ],
        requireInteraction: notificationForm.requireInteraction,
        tag: `admin_notification_${Date.now()}`
      }

      // Enviar a API endpoint que maneje el envío masivo
      const response = await fetch('/api/admin/send-push-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notification: notificationPayload,
          targetType: notificationForm.targetType
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error enviando notificación')
      }

      setSendResult({
        success: true,
        message: `✅ Notificación enviada a ${result.sent} dispositivos`,
        details: result
      })

      // Limpiar formulario
      setNotificationForm({
        title: '',
        body: '',
        url: '/',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        requireInteraction: false,
        category: 'general',
        targetType: 'all'
      })

      // Recargar estadísticas
      setTimeout(loadPWAStats, 1000)

    } catch (error) {
      console.error('Error enviando notificación:', error)
      setSendResult({
        success: false,
        message: `❌ Error: ${error.message}`,
        details: null
      })
    } finally {
      setSendLoading(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">🔍 Verificando permisos...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          ❌ Acceso Denegado
        </h3>
        <p className="text-red-600 dark:text-red-400">
          No tienes permisos para acceder al panel de PWA.
        </p>
        <Link href="/" className="text-red-500 hover:text-red-700 mt-2 inline-block">
          ← Volver al inicio
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          📱 Panel PWA
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Gestión de Progressive Web App y notificaciones push
        </p>
      </div>

      {/* Estadísticas generales */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  PWAs Instaladas
                </p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalInstalls}</p>
                <p className="text-xs text-gray-500 mt-1">Datos reales</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📱</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Push Activos
                </p>
                <p className="text-2xl font-bold text-green-600">{stats.activeSubscriptions}</p>
                <p className="text-xs text-gray-500 mt-1">Suscripciones push</p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🔔</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Enviadas (7d)
                </p>
                <p className="text-2xl font-bold text-purple-600">{stats.notificationsSent}</p>
                <p className="text-xs text-gray-500 mt-1">Notificaciones push</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📤</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Click Rate
                </p>
                <p className="text-2xl font-bold text-orange-600">{stats.clickRate}%</p>
                <p className="text-xs text-gray-500 mt-1">Clicks vs enviadas</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <span className="text-2xl">👆</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulario para enviar notificación */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📤 Enviar Notificación Push
        </h3>

        <form onSubmit={handleSendNotification} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Título
              </label>
              <input
                type="text"
                value={notificationForm.title}
                onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="🎯 ¡Hora de estudiar!"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL de destino
              </label>
              <input
                type="text"
                value={notificationForm.url}
                onChange={(e) => setNotificationForm(prev => ({ ...prev, url: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="/auxiliar-administrativo-estado/test"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mensaje
            </label>
            <textarea
              value={notificationForm.body}
              onChange={(e) => setNotificationForm(prev => ({ ...prev, body: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="¡Tu plaza de funcionario no se va a conseguir sola! Haz un test rápido."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Categoría
              </label>
              <select
                value={notificationForm.category}
                onChange={(e) => setNotificationForm(prev => ({ ...prev, category: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="general">General</option>
                <option value="motivation">Motivacional</option>
                <option value="achievement">Logro</option>
                <option value="streak_danger">Peligro Racha</option>
                <option value="reminder">Recordatorio</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Audiencia
              </label>
              <select
                value={notificationForm.targetType}
                onChange={(e) => setNotificationForm(prev => ({ ...prev, targetType: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">Todos los usuarios</option>
                <option value="active_users">Solo usuarios activos</option>
              </select>
            </div>

            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                id="requireInteraction"
                checked={notificationForm.requireInteraction}
                onChange={(e) => setNotificationForm(prev => ({ ...prev, requireInteraction: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <label htmlFor="requireInteraction" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Requiere interacción
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              type="submit"
              disabled={sendLoading || !notificationForm.title || !notificationForm.body}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md font-medium transition-colors flex items-center space-x-2"
            >
              {sendLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <span>📤</span>
                  <span>Enviar Notificación</span>
                </>
              )}
            </button>

            {stats && (
              <div className="text-sm text-gray-500">
                Se enviará a ~{stats.activeSubscriptions} dispositivos
              </div>
            )}
          </div>
        </form>

        {/* Resultado del envío */}
        {sendResult && (
          <div className={`mt-4 p-4 rounded-lg border ${
            sendResult.success 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}>
            <p className="font-medium">{sendResult.message}</p>
            {sendResult.details && (
              <p className="text-sm mt-1 opacity-80">
                Detalles: {JSON.stringify(sendResult.details, null, 2)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/admin/notificaciones/push" 
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📊</span>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Analytics Push</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Ver métricas detalladas</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/usuarios" 
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">👥</span>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Gestión Usuarios</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Configurar suscripciones</p>
            </div>
          </div>
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">⚙️</span>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Config PWA</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Manifest y Service Worker</p>
            </div>
          </div>
        </div>
      </div>

      {/* 📱 PWA STATISTICS REAL - Nuevo componente agregado */}
      {isAdmin && (
        <div className="mt-8">
          <PWAStatsReal />
        </div>
      )}

    </div>
  )
}