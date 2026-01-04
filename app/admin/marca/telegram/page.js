'use client'
import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSearchParams } from 'next/navigation'
import TelegramLogin from '@/components/Admin/Marca/TelegramLogin'
import TelegramAlerts from '@/components/Admin/Marca/TelegramAlerts'
import TelegramGroups from '@/components/Admin/Marca/TelegramGroups'
import TelegramSearch from '@/components/Admin/Marca/TelegramSearch'

function TelegramPageContent() {
  const { supabase, user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || 'alerts'
  const [session, setSession] = useState(null)

  console.log('📱 TelegramPage: Rendering, user:', !!user, 'session:', !!session, 'authLoading:', authLoading)

  const [activeTab, setActiveTab] = useState(initialTab)
  const [telegramStatus, setTelegramStatus] = useState({
    connected: false,
    user: null,
    loading: true,
  })
  const [monitorStatus, setMonitorStatus] = useState({
    isMonitoring: false,
    groupCount: 0,
  })

  // Obtener session de Supabase
  useEffect(() => {
    async function getSession() {
      if (!supabase) return
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      console.log('📱 TelegramPage: Got session:', !!currentSession)
      setSession(currentSession)
    }
    getSession()
  }, [supabase, user])

  useEffect(() => {
    // Esperar a que auth termine de cargar y tengamos session
    if (authLoading || !session) return

    checkTelegramStatus()
    checkMonitorStatus()
  }, [session, authLoading])

  async function checkTelegramStatus() {
    console.log('📱 TelegramPage: checkTelegramStatus called, session:', !!session)
    if (!session) {
      console.log('📱 TelegramPage: No session, setting loading false')
      setTelegramStatus(prev => ({ ...prev, loading: false }))
      return
    }

    try {
      console.log('📱 TelegramPage: Fetching auth status...')
      const res = await fetch('/api/admin/marca/telegram/auth', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      console.log('📱 TelegramPage: Auth response:', data)

      setTelegramStatus({
        connected: data.connected || false,
        user: data.user,
        loading: false,
      })
    } catch (error) {
      console.error('📱 TelegramPage: Error checking Telegram status:', error)
      setTelegramStatus((prev) => ({ ...prev, loading: false }))
    }
  }

  async function checkMonitorStatus() {
    if (!session) return

    try {
      const res = await fetch('/api/admin/marca/telegram/monitor', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setMonitorStatus({
        isMonitoring: data.isMonitoring || false,
        groupCount: data.groupCount || 0,
      })
    } catch (error) {
      console.error('Error checking monitor status:', error)
    }
  }

  async function toggleMonitoring() {
    if (!session) return

    try {
      const method = monitorStatus.isMonitoring ? 'DELETE' : 'POST'
      const res = await fetch('/api/admin/marca/telegram/monitor', {
        method,
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()

      if (data.success || data.groupCount) {
        setMonitorStatus({
          isMonitoring: method === 'POST',
          groupCount: data.groupCount || 0,
        })
      } else if (data.error) {
        alert(data.error)
      }
    } catch (error) {
      console.error('Error toggling monitoring:', error)
    }
  }

  async function handleLogout() {
    if (!session) return
    if (!confirm('¿Cerrar sesión de Telegram?')) return

    try {
      await fetch('/api/admin/marca/telegram/auth', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      setTelegramStatus({
        connected: false,
        user: null,
        loading: false,
      })
      setMonitorStatus({
        isMonitoring: false,
        groupCount: 0,
      })
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const tabs = [
    { id: 'alerts', label: 'Alertas', icon: '🔔' },
    { id: 'search', label: 'Buscar', icon: '🔍' },
    { id: 'groups', label: 'Grupos', icon: '👥' },
    { id: 'config', label: 'Configuración', icon: '⚙️' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Telegram
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Monitoriza menciones de tu marca en grupos de Telegram
          </p>
        </div>

        {telegramStatus.connected && (
          <div className="flex items-center gap-3">
            {/* Estado del monitor */}
            <button
              onClick={toggleMonitoring}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                monitorStatus.isMonitoring
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              <span>{monitorStatus.isMonitoring ? '📡' : '⏸️'}</span>
              {monitorStatus.isMonitoring
                ? `Monitorizando (${monitorStatus.groupCount})`
                : 'Iniciar Monitor'}
            </button>

            {/* Usuario conectado */}
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <span className="text-blue-600 dark:text-blue-400">✓</span>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {telegramStatus.user?.firstName}
                {telegramStatus.user?.username && (
                  <span className="text-blue-500"> @{telegramStatus.user.username}</span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {(authLoading || !session || telegramStatus.loading) && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            {authLoading ? 'Cargando sesión...' : !session ? 'Obteniendo sesión...' : 'Verificando conexión...'}
          </span>
        </div>
      )}

      {/* Debug info */}
      {console.log('📱 TelegramPage: Render state:', { authLoading, hasSession: !!session, loading: telegramStatus.loading, connected: telegramStatus.connected })}

      {/* Si no está conectado, mostrar login */}
      {!authLoading && session && !telegramStatus.loading && !telegramStatus.connected && (
        <TelegramLogin
          session={session}
          onSuccess={() => checkTelegramStatus()}
        />
      )}

      {/* Si está conectado, mostrar tabs */}
      {telegramStatus.connected && (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-4">
            {activeTab === 'alerts' && <TelegramAlerts />}
            {activeTab === 'search' && <TelegramSearch />}
            {activeTab === 'groups' && (
              <TelegramGroups onGroupsChange={checkMonitorStatus} />
            )}
            {activeTab === 'config' && (
              <div className="space-y-6">
                {/* Info de conexión */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    Cuenta Conectada
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-gray-500">Nombre:</span>{' '}
                      <span className="text-gray-900 dark:text-white">
                        {telegramStatus.user?.firstName} {telegramStatus.user?.lastName}
                      </span>
                    </p>
                    {telegramStatus.user?.username && (
                      <p>
                        <span className="text-gray-500">Usuario:</span>{' '}
                        <span className="text-gray-900 dark:text-white">
                          @{telegramStatus.user.username}
                        </span>
                      </p>
                    )}
                    {telegramStatus.user?.phone && (
                      <p>
                        <span className="text-gray-500">Teléfono:</span>{' '}
                        <span className="text-gray-900 dark:text-white">
                          {telegramStatus.user.phone}
                        </span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-4 px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Cerrar Sesión de Telegram
                  </button>
                </div>

                {/* Instrucciones */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                    Cómo funciona
                  </h3>
                  <ol className="list-decimal list-inside text-sm text-yellow-800 dark:text-yellow-200 space-y-2">
                    <li>
                      <strong>Configura grupos:</strong> En la pestaña Grupos, activa la monitorización
                      en los grupos donde quieras detectar menciones.
                    </li>
                    <li>
                      <strong>Inicia el monitor:</strong> Haz clic en Iniciar Monitor para
                      empezar a escuchar mensajes.
                    </li>
                    <li>
                      <strong>Recibe alertas:</strong> Cuando alguien mencione keywords como
                      test, vence, oposiciones, aparecerá una alerta.
                    </li>
                    <li>
                      <strong>Responde:</strong> Desde la pestaña Alertas puedes responder
                      directamente desde tu cuenta.
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function TelegramPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Cargando...</span>
        </div>
      </div>
    }>
      <TelegramPageContent />
    </Suspense>
  )
}
