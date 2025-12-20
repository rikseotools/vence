// components/UpgradeLimitModal.js
// Modal persuasivo cuando el usuario alcanza el limite diario
'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { trackUpgradeModalView, trackUpgradeButtonClick } from '@/lib/services/conversionTracker'

export default function UpgradeLimitModal({
  isOpen,
  onClose,
  questionsAnswered = 20,
  resetTime = null,
  supabase = null,
  userId = null
}) {
  const router = useRouter()
  const hasTrackedView = useRef(false)

  // Prevenir scroll cuando esta abierto + trackear vista
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'

      // Trackear vista del modal (solo una vez por apertura)
      if (!hasTrackedView.current && supabase && userId) {
        trackUpgradeModalView(supabase, userId, 'limit_reached')
        hasTrackedView.current = true
      }

      return () => {
        document.body.style.overflow = 'unset'
        hasTrackedView.current = false
      }
    }
  }, [isOpen, supabase, userId])

  // Calcular tiempo hasta reset
  const getTimeUntilReset = () => {
    if (!resetTime) return null
    const now = new Date()
    const reset = new Date(resetTime)
    const diffMs = reset - now
    if (diffMs <= 0) return null

    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes} minutos`
  }

  if (!isOpen) return null

  const handleUpgrade = () => {
    // Trackear clic en boton de upgrade
    if (supabase && userId) {
      trackUpgradeButtonClick(supabase, userId, 'limit_modal')
    }
    router.push('/premium')
    onClose()
  }

  const timeUntilReset = getTimeUntilReset()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Has llegado al limite
          </h2>
          <p className="text-white/90 text-sm">
            {questionsAnswered} preguntas respondidas hoy
          </p>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {/* Mensaje principal persuasivo */}
          <div className="text-center mb-6">
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Los opositores que aprueban son los premium.
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              No dejes que te ganen.
            </p>
          </div>

          {/* Beneficios */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 text-sm uppercase tracking-wider">
              Con Premium obtendras:
            </h3>
            <ul className="space-y-2">
              {[
                'Preguntas ilimitadas todos los dias',
                'Acceso a todos los temas'
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          {/* Botones */}
          <div className="space-y-3">
            <button
              onClick={handleUpgrade}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
            >
              Hacerme Premium Ahora
            </button>

            <button
              onClick={onClose}
              className="w-full py-2 px-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium transition-colors"
            >
              Continuar manana
              {timeUntilReset && (
                <span className="ml-1 text-xs opacity-75">
                  (reset en {timeUntilReset})
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
