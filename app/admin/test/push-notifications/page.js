'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

export default function PushNotificationsTestPage() {
  const { user, supabase, loading: authLoading } = useAuth()
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const [testMessage, setTestMessage] = useState({
    title: '🎯 Test de Notificación',
    body: 'Esta es una notificación de prueba desde el panel administrativo',
    category: 'test'
  })
  const [sendResult, setSendResult] = useState(null)

  useEffect(() => {
    if (!user || authLoading || !supabase) return

    async function checkAdminAccess() {
      try {
        // Usar la misma verificación que otras páginas admin
        const { data: isAdminResult, error } = await supabase.rpc('is_current_user_admin')
        
        if (error) {
          console.error('Error verificando admin status:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(isAdminResult === true)
          
          if (isAdminResult === true) {
            loadUsers()
          }
        }
      } catch (error) {
        console.error('Error checking admin access:', error)
        setIsAdmin(false)
      } finally {
        setAdminLoading(false)
      }
    }

    checkAdminAccess()
  }, [user, authLoading, supabase])

  useEffect(() => {
    if (user && isAdmin && supabase) {
      loadUsers()
    }
  }, [user, isAdmin, supabase])

  useEffect(() => {
    if (searchTerm) {
      const filtered = users.filter(u => 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredUsers(filtered)
    } else {
      setFilteredUsers(users)
    }
  }, [searchTerm, users])

  const loadUsers = async () => {
    try {
      setLoading(true)
      
      // Cargar usuarios con configuración de notificaciones usando join manual
      const { data: usersData, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          email,
          full_name,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      // Cargar configuraciones de notificación por separado
      const userIds = usersData?.map(u => u.id) || []
      
      if (userIds.length === 0) {
        setUsers([])
        setFilteredUsers([])
        return
      }

      const { data: notificationSettings, error: nsError } = await supabase
        .from('user_notification_settings')
        .select('user_id, push_enabled, push_subscription, created_at')
        .in('user_id', userIds)

      if (nsError) {
        console.error('Error loading notification settings:', nsError)
        // Continuar sin configuraciones de notificación
      }

      // Combinar datos y filtrar solo usuarios con push habilitado
      const usersWithPush = usersData?.filter(user => {
        const userSettings = notificationSettings?.find(ns => ns.user_id === user.id)
        return userSettings && 
               userSettings.push_enabled && 
               userSettings.push_subscription
      }).map(user => {
        const userSettings = notificationSettings?.find(ns => ns.user_id === user.id)
        return {
          ...user,
          user_notification_settings: userSettings
        }
      }) || []

      setUsers(usersWithPush)
      setFilteredUsers(usersWithPush)
      console.log(`✅ Cargados ${usersWithPush.length} usuarios con push habilitado`)

    } catch (error) {
      console.error('Error loading users:', error)
      alert('Error cargando usuarios: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const sendTestNotification = async () => {
    if (!selectedUser) {
      alert('Selecciona un usuario primero')
      return
    }

    if (!testMessage.title.trim() || !testMessage.body.trim()) {
      alert('Título y mensaje son obligatorios')
      return
    }

    try {
      setLoading(true)
      setSendResult(null)

      console.log('🚀 Enviando notificación de prueba a:', selectedUser.email)

      // Enviar notificación via API
      const response = await fetch('/api/admin/send-test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          title: testMessage.title,
          body: testMessage.body,
          category: testMessage.category,
          data: {
            testSentBy: user.email,
            testTimestamp: new Date().toISOString(),
            url: '/test/aleatorio?from=admin_test'
          }
        })
      })

      const result = await response.json()

      if (response.ok) {
        setSendResult({
          success: true,
          message: `✅ Notificación enviada exitosamente a ${selectedUser.email}`,
          details: result
        })
        console.log('✅ Notificación enviada:', result)
      } else {
        setSendResult({
          success: false,
          message: `❌ Error enviando notificación: ${result.error}`,
          details: result
        })
        console.error('❌ Error:', result)
      }

    } catch (error) {
      console.error('Error sending test notification:', error)
      setSendResult({
        success: false,
        message: `❌ Error de conexión: ${error.message}`,
        details: null
      })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">Solo administradores pueden acceder a esta página.</p>
          <p className="text-xs text-gray-500 mt-2">
            Usuario: {user?.email || 'No logueado'} | Admin: {isAdmin ? 'Sí' : 'No'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <Link href="/admin/test" className="text-blue-600 hover:text-blue-800">
                ← Volver al Panel de Testing
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">🔔 Testing de Notificaciones Push</h1>
            <p className="text-gray-600">Envía notificaciones de prueba a usuarios reales con push habilitado</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Panel Izquierdo: Debug Info */}
            <div className="space-y-6">
              

              {/* Estadísticas */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Estadísticas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{users.length}</div>
                    <div className="text-sm text-gray-600">Usuarios con Push</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{filteredUsers.length}</div>
                    <div className="text-sm text-gray-600">Filtrados</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Panel Derecho: Testing */}
            <div className="space-y-6">
              
              {/* Selector de Usuario */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">👤 Seleccionar Usuario de Prueba</h3>
                
                {/* Buscador */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Buscar por email o nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Lista de Usuarios */}
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {loading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-600 mt-2">Cargando usuarios...</p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-gray-600">No se encontraron usuarios con push habilitado</p>
                      <button 
                        onClick={loadUsers}
                        className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        🔄 Recargar
                      </button>
                    </div>
                  ) : (
                    filteredUsers.map(u => (
                      <div 
                        key={u.id}
                        onClick={() => setSelectedUser(u)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedUser?.id === u.id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-800">{u.full_name || 'Sin nombre'}</div>
                            <div className="text-sm text-gray-600">{u.email}</div>
                          </div>
                          <div className="text-xs text-green-600">🔔 Push ON</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Configurar Mensaje */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">📝 Configurar Mensaje de Prueba</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Título</label>
                    <input
                      type="text"
                      value={testMessage.title}
                      onChange={(e) => setTestMessage(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Título de la notificación"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mensaje</label>
                    <textarea
                      value={testMessage.body}
                      onChange={(e) => setTestMessage(prev => ({ ...prev, body: e.target.value }))}
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Contenido del mensaje"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                    <select
                      value={testMessage.category}
                      onChange={(e) => setTestMessage(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="test">🧪 Test</option>
                      <option value="motivation">💪 Motivación</option>
                      <option value="reminder">⏰ Recordatorio</option>
                      <option value="achievement">🏆 Logro</option>
                      <option value="streak_danger">🚨 Racha en Peligro</option>
                    </select>
                  </div>
                </div>

                {/* Botón Enviar */}
                <div className="mt-6">
                  <button
                    onClick={sendTestNotification}
                    disabled={!selectedUser || loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>Enviar Notificación de Prueba</span>
                      </>
                    )}
                  </button>
                  
                  {selectedUser && (
                    <p className="text-sm text-gray-600 mt-2 text-center">
                      Se enviará a: <strong>{selectedUser.email}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Resultado */}
              {sendResult && (
                <div className={`rounded-lg p-6 ${
                  sendResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <h3 className="text-lg font-bold mb-2 ${sendResult.success ? 'text-green-800' : 'text-red-800'}">
                    📋 Resultado del Envío
                  </h3>
                  <p className={`text-sm mb-2 ${sendResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {sendResult.message}
                  </p>
                  {sendResult.details && (
                    <details className={`text-xs ${sendResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      <summary className="cursor-pointer">Ver detalles técnicos</summary>
                      <pre className="mt-2 p-2 bg-white rounded border overflow-x-auto">
                        {JSON.stringify(sendResult.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  )
}