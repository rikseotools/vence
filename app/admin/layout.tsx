// app/admin/layout.tsx - Layout base para área administrativa
'use client'
import ProtectedRoute from '@/components/Admin/ProtectedRoute'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import { useLawChanges } from '@/hooks/useLawChanges'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminNotifications = useAdminNotifications(true)
  const { hasUnreviewedChanges } = useLawChanges()

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        
        {/* Header administrativo - CORREGIDO */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              
              {/* Logo y título - Responsive */}
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  👨‍💼
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                    Panel de Administración
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                    Gestión y analytics de Vence
                  </p>
                </div>
              </div>

              {/* Logo compacto solo en móvil */}
              <div className="sm:hidden">
                <h1 className="text-base font-bold text-gray-900 dark:text-white">Admin</h1>
              </div>
            </div>
          </div>
          
          {/* Navegación en dos filas */}
          <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <nav className="py-2">
                {/* Primera fila */}
                <div className="flex items-center justify-center flex-wrap gap-1 mb-2">
                  <a 
                    href="/admin" 
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📊</span>
                    <span>Dashboard</span>
                  </a>
                  <a
                    href="/admin/engagement" 
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>🎯</span>
                    <span>Engagement</span>
                  </a>
                  <a 
                    href="/admin/pwa" 
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📱</span>
                    <span>PWA</span>
                  </a>
                  <a 
                    href="/admin/notificaciones" 
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>🔔</span>
                    <span>Notificaciones</span>
                  </a>
                </div>
                
                {/* Segunda fila */}
                <div className="flex items-center justify-center flex-wrap gap-1">
                  <a 
                    href="/admin/notificaciones/push" 
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📱</span>
                    <span>Push</span>
                  </a>
                  <a 
                    href="/admin/notificaciones/email" 
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📧</span>
                    <span>Emails</span>
                  </a>
                  <a 
                    href="/admin/feedback" 
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      adminNotifications?.feedback > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>💬</span>
                    <span>Feedback</span>
                    {adminNotifications?.feedback > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                        {adminNotifications.feedback}
                      </span>
                    )}
                  </a>
                  <a 
                    href="/admin/impugnaciones" 
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      adminNotifications?.impugnaciones > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>📋</span>
                    <span>Impugnaciones</span>
                    {adminNotifications?.impugnaciones > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                        {adminNotifications.impugnaciones}
                      </span>
                    )}
                  </a>
                  <a 
                    href="/admin/newsletters" 
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📧</span>
                    <span>Newsletters</span>
                  </a>
                  <a
                    href="/admin/monitoreo"
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      hasUnreviewedChanges ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>🚨</span>
                    <span>Monitoreo</span>
                    {hasUnreviewedChanges && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                        !
                      </span>
                    )}
                  </a>
                  <a
                    href="/admin/revision-temas"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📚</span>
                    <span>Revisión Temas</span>
                  </a>
                  <a
                    href="/admin/calidad"
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      adminNotifications?.calidad > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>🔍</span>
                    <span>Calidad</span>
                    {adminNotifications?.calidad > 0 && (
                      <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                        {adminNotifications.calidad > 99 ? '99+' : adminNotifications.calidad}
                      </span>
                    )}
                  </a>
                  <a
                    href="/admin/ai"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>🤖</span>
                    <span>IA</span>
                  </a>
                  <a
                    href="/admin/conversiones"
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      adminNotifications?.ventas > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>💰</span>
                    <span>Conversiones</span>
                    {adminNotifications?.ventas > 0 && (
                      <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                        {adminNotifications.ventas}
                      </span>
                    )}
                  </a>
                  <a
                    href="/admin/fraudes"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>🚨</span>
                    <span>Fraudes</span>
                  </a>
                  <a
                    href="/admin/errores-validacion"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>🐕</span>
                    <span>Errores API</span>
                  </a>
                </div>
              </nav>
            </div>
          </div>
        </header>

        {/* Contenido principal - CORREGIDO */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {children}
        </main>

        {/* Footer administrativo - CORREGIDO y más compacto */}
        <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <span className="flex items-center space-x-1">
                  <span>👨‍💼</span>
                  <span>Panel Administrativo Vence</span>
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">
                  Actualizado: {new Date().toLocaleDateString('es-ES')}
                </span>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <span>Versión: 2.0</span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <span>🛡️</span>
                  <span>Área Protegida</span>
                </span>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </ProtectedRoute>
  )
}