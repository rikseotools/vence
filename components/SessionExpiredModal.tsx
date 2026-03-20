// components/SessionExpiredModal.tsx
// Modal que aparece cuando la sesión expira durante un test.
// Informa al usuario y le permite re-logear. Las respuestas pendientes se guardan en localStorage.
'use client'

interface SessionExpiredModalProps {
  isOpen: boolean
  onReLogin: () => void
  onDismiss: () => void
  pendingAnswersCount?: number
}

export default function SessionExpiredModal({
  isOpen,
  onReLogin,
  onDismiss,
  pendingAnswersCount = 0
}: SessionExpiredModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-amber-500 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Sesion expirada
              </h2>
              <p className="text-white/80 text-sm">
                Tu sesion ha caducado mientras hacias el test
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              No te preocupes, tus respuestas estan guardadas localmente.
              {pendingAnswersCount > 0 && (
                <span className="font-medium"> ({pendingAnswersCount} respuesta{pendingAnswersCount !== 1 ? 's' : ''} pendiente{pendingAnswersCount !== 1 ? 's' : ''} de sincronizar)</span>
              )}
            </p>
            <p className="text-blue-700 dark:text-blue-300 text-sm mt-2">
              Inicia sesion de nuevo para continuar y sincronizar tus respuestas.
            </p>
          </div>

          <div className="space-y-3">
            {/* Boton principal: Re-login */}
            <button
              onClick={onReLogin}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>Iniciar sesion de nuevo</span>
            </button>

            {/* Boton secundario: Continuar sin guardar */}
            <button
              onClick={onDismiss}
              className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
            >
              Continuar sin guardar
            </button>
          </div>

          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center">
            Tus respuestas se sincronizaran automaticamente al volver a iniciar sesion.
          </p>
        </div>
      </div>
    </div>
  )
}
