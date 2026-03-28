// components/Admin/ProtectedRoute.tsx - Componente de protección para rutas administrativas
'use client'
import { useAuth } from '../../contexts/AuthContext'
import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { useOposicionPaths } from '@/hooks/useOposicionPaths'

interface ProtectedRouteProps {
  children: ReactNode
  requireRole?: string
}

export default function ProtectedRoute({ children, requireRole = 'admin' }: ProtectedRouteProps) {
  const { user, supabase, loading: authLoading } = useAuth() as {
    user: { id: string; email?: string } | null
    supabase: { rpc: (fn: string) => Promise<{ data: boolean | null; error: unknown }> } | null
    loading: boolean
  }
  const { homeUrl } = useOposicionPaths()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkAdminStatus() {
      if (authLoading) return

      if (!user || !supabase) {
        setIsAdmin(false)
        setIsLoading(false)
        return
      }

      try {
        const { data, error } = await supabase.rpc('is_current_user_admin')

        if (error) {
          console.error('Error verificando permisos:', error)
          setError('Error verificando permisos de administrador')
          setIsAdmin(false)
        } else {
          setIsAdmin(data === true)
        }
      } catch (err) {
        console.error('Error en verificación de admin:', err)
        setError('Error de conexión al verificar permisos')
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAdminStatus()
  }, [user?.id, authLoading, supabase])

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verificando permisos de administrador...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Acceso Restringido
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Necesitas iniciar sesión para acceder al área administrativa.
          </p>
          <Link
            href="/login"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Iniciar Sesión
          </Link>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
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
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
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
              href={homeUrl}
              className="block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Volver al Inicio
            </Link>
            <Link
              href="/mis-estadisticas"
              className="block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Mis Estadísticas
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-green-100 border border-green-300 text-green-800 p-2 text-xs">
          Admin verificado: {user.email} | Rol: {requireRole}
        </div>
      )}
      {children}
    </div>
  )
}
