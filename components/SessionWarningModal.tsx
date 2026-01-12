// components/SessionWarningModal.tsx
// Modal BLOQUEANTE por sesiones simultáneas - el usuario NO puede cerrar
'use client'

export interface SessionInfo {
  id: string
  startedAt: string
  ip: string | null
  city: string
  device: string
}

interface SessionWarningModalProps {
  isOpen: boolean
  onLogout: () => Promise<void>
  isLoggingOut?: boolean
}

export default function SessionWarningModal({
  isOpen,
  onLogout,
  isLoggingOut = false
}: SessionWarningModalProps) {
  if (!isOpen) return null

  const handleLogout = async () => {
    await onLogout()
  }

  // Abre WhatsApp con mensaje predefinido
  const handleContactSupport = () => {
    const message = encodeURIComponent(
      'Hola, tengo un problema con mi cuenta. Me aparece que hay varias sesiones activas pero creo que es un error.'
    )
    window.open(`https://wa.me/34644441040?text=${message}`, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header con gradiente de alerta */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Sesiones activas detectadas
              </h2>
              <p className="text-white/80 text-sm">
                Tu cuenta se está usando en varios dispositivos
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Mensaje principal */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-800 dark:text-red-200 text-sm">
              Hemos detectado accesos desde <strong>varios dispositivos</strong>.
              Tu plan Premium está pensado para <strong>uso individual</strong>.
            </p>
            <p className="text-red-700 dark:text-red-300 text-sm mt-2 font-medium">
              Para continuar, cierra sesión en los otros dispositivos.
            </p>
          </div>

          {/* Botones de acción */}
          <div className="space-y-3">
            {/* Botón principal: Cerrar sesión */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoggingOut ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Cerrando sesión...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Cerrar sesión y volver a entrar</span>
                </>
              )}
            </button>

            {/* Botón secundario: Contactar soporte */}
            <button
              onClick={handleContactSupport}
              className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Contactar con soporte</span>
            </button>
          </div>

          {/* Nota legal */}
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center">
            El uso compartido de cuentas viola nuestros términos de servicio.
            Si crees que es un error, contacta con soporte.
          </p>
        </div>
      </div>
    </div>
  )
}
