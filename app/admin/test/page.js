'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

export default function AdminTestPage() {
  const { user, supabase, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)

  useEffect(() => {
    if (!user || authLoading || !supabase) return

    async function checkAdminAccess() {
      try {
        const { data: isAdminResult, error } = await supabase.rpc('is_current_user_admin')
        
        if (error) {
          console.error('Error verificando admin status:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(isAdminResult === true)
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">🧪 Panel de Testing Administrativo</h1>
            <p className="text-gray-600">Herramientas para probar funcionalidades del sistema</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Tarjeta Debug Notificaciones Push */}
            <Link href="/admin/test/push-notifications" className="block">
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">🔔</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">Push Notifications</h3>
                      <p className="text-sm text-gray-500">Debug & Testing</p>
                    </div>
                  </div>
                  <span className="text-blue-600">→</span>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Probar sistema de notificaciones push, enviar mensajes de prueba a usuarios específicos
                </p>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Testing</span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">Real Users</span>
                </div>
              </div>
            </Link>

            {/* Placeholder para futuras herramientas */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 opacity-50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📧</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-400">Email Testing</h3>
                    <p className="text-sm text-gray-400">Próximamente</p>
                  </div>
                </div>
                <span className="text-gray-400">→</span>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Herramientas para probar envío de emails y plantillas
              </p>
              <div className="flex items-center space-x-2 text-xs">
                <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Próximamente</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 opacity-50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-400">Database Tools</h3>
                    <p className="text-sm text-gray-400">Próximamente</p>
                  </div>
                </div>
                <span className="text-gray-400">→</span>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Herramientas para consultas y mantenimiento de base de datos
              </p>
              <div className="flex items-center space-x-2 text-xs">
                <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Próximamente</span>
              </div>
            </div>

          </div>

          {/* Info Panel */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">💡</span>
              <div>
                <h3 className="text-lg font-bold text-blue-900 mb-2">Información del Panel de Testing</h3>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• Solo accesible para administradores autenticados</li>
                  <li>• Las pruebas afectan datos reales - usar con precaución</li>
                  <li>• Todos los tests se registran en logs para auditoría</li>
                  <li>• Usar preferiblemente en entorno de desarrollo</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}