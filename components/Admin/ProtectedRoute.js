// components/Admin/ProtectedRoute.js - Componente de protección para rutas administrativas
'use client'
import { useAuth } from '../../contexts/AuthContext'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function ProtectedRoute({ children, requireRole = 'admin' }) {
  const { user, supabase, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function checkAdminStatus() {
      // Esperar a que termine la carga de autenticación
      if (authLoading) return
      
      // Si no hay usuario, no es admin
      if (!user || !supabase) {
        setIsAdmin(false)
        setIsLoading(false)
        return
      }

      try {
        console.log('🔍 Verificando permisos de admin para:', user.email)
        console.log('🔍 Usuario actual:', user)
        
        // Verificar usuario desde supabase.auth.getUser()
        const { data: userData, error: userError } = await supabase.auth.getUser()
        console.log('🔍 Usuario desde supabase.auth.getUser():', userData, userError)
        
        // Verificar si el usuario actual es admin usando la función SQL
        const { data, error } = await supabase.rpc('is_current_user_admin')
        console.log('🔍 Resultado is_current_user_admin:', data, error)
        
        // También probar consulta directa
        const { data: directCheck, error: directError } = await supabase
          .from('admin_users_with_roles')
          .select('active_roles')
          .eq('user_id', user.id)
          .single()
        console.log('🔍 Consulta directa admin_users_with_roles:', directCheck, directError)
        
        if (error) {
          console.error('❌ Error verificando permisos:', error)
          
          // Si la función RPC falla, usar consulta directa como fallback
          if (directCheck && directCheck.active_roles) {
            const hasAdminRole = directCheck.active_roles.includes('admin') || 
                                directCheck.active_roles.includes('super_admin')
            console.log('✅ Usando consulta directa - Status de admin:', hasAdminRole)
            setIsAdmin(hasAdminRole)
          } else {
            setError('Error verificando permisos de administrador')
            setIsAdmin(false)
          }
        } else {
          const adminStatus = data === true
          console.log('✅ Status de admin desde RPC:', adminStatus)
          setIsAdmin(adminStatus)
        }
        
      } catch (err) {
        console.error('❌ Error en verificación de admin:', err)
        setError('Error de conexión al verificar permisos')
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAdminStatus()
  }, [user?.id, authLoading])

  // Estados de carga y error
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">🔍 Verificando permisos de administrador...</p>
        </div>
      </div>
    )
  }

  // Usuario no autenticado
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Acceso Restringido
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Necesitas iniciar sesión para acceder al área administrativa.
          </p>
          <Link 
            href="/es/login"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔑 Iniciar Sesión
          </Link>
        </div>
      </div>
    )
  }

  // Error en verificación
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            Error de Verificación
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Reintentar
          </button>
        </div>
      </div>
    )
  }

  // Usuario sin permisos de admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
          <div className="text-6xl mb-4">👨‍💼</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Permisos Insuficientes
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Esta área está reservada para administradores.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            Usuario actual: {user.email}
          </p>
          <div className="space-y-3">
            <Link 
              href="/es/auxiliar-administrativo-estado"
              className="block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              🏠 Volver al Inicio
            </Link>
            <Link 
              href="/es/mis-estadisticas"
              className="block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
            >
              📊 Mis Estadísticas
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Usuario es admin - mostrar contenido protegido
  return (
    <div>
      {/* Header de debug en desarrollo */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-green-100 border border-green-300 text-green-800 p-2 text-xs">
          🛡️ Admin verificado: {user.email} | Rol: {requireRole}
        </div>
      )}
      
      {children}
    </div>
  )
}