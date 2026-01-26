// components/UpgradeLimitModal.js
// Modal persuasivo con A/B testing - mensajes desde BD
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// Iconos SVG para cada tipo de mensaje
const MessageIcon = ({ type }) => {
  const icons = {
    money: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    calendar: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    ),
    clock: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    users: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    ),
    star: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    ),
    rocket: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    ),
    chart: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    ),
    warning: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    ),
    lock: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    )
  }

  return (
    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {icons[type] || icons.lock}
    </svg>
  )
}

// Mensaje por defecto si falla la BD
const DEFAULT_MESSAGE = {
  id: null,
  message_key: 'default',
  title: 'Has llegado al limite',
  subtitle: 'Preguntas ilimitadas te esperan',
  body_message: 'Los opositores que aprueban son los que no se limitan.',
  highlight: 'Desbloquea tu potencial',
  icon: 'lock',
  gradient: 'from-amber-500 via-orange-500 to-red-500'
}

export default function UpgradeLimitModal({
  isOpen,
  onClose,
  questionsAnswered = 25,
  resetTime = null,
  supabase = null,
  userId = null,
  userName = null  // Nombre del usuario para personalizar
}) {
  const router = useRouter()
  const [message, setMessage] = useState(null)
  const [impressionId, setImpressionId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasTrackedRef = useRef(false)

  // Reemplazar {nombre} en los textos
  const personalize = (text) => {
    if (!text) return text
    const name = userName || 'opositor'
    return text.replace(/\{nombre\}/g, name)
  }

  // Cargar mensaje aleatorio de la BD (excluyendo los ya vistos)
  const loadMessage = useCallback(async () => {
    if (!supabase) {
      setMessage(DEFAULT_MESSAGE)
      setIsLoading(false)
      return
    }

    try {
      // Pasar userId para excluir mensajes ya vistos
      const { data, error } = await supabase.rpc('get_random_upgrade_message', {
        p_user_id: userId
      })

      if (error || !data || data.length === 0) {
        console.warn('Error cargando mensaje de upgrade, usando default:', error)
        setMessage(DEFAULT_MESSAGE)
      } else {
        setMessage(data[0])
      }
    } catch (err) {
      console.error('Error en loadMessage:', err)
      setMessage(DEFAULT_MESSAGE)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  // Trackear que el mensaje fue mostrado
  const trackImpression = useCallback(async (messageData) => {
    if (!supabase || !userId || !messageData?.id || hasTrackedRef.current) return

    try {
      const { data, error } = await supabase.rpc('track_upgrade_message_shown', {
        p_user_id: userId,
        p_message_id: messageData.id,
        p_trigger_type: 'daily_limit',
        p_questions_answered: questionsAnswered
      })

      if (!error && data) {
        setImpressionId(data)
        hasTrackedRef.current = true
        console.log('Impresion trackeada:', data, '| Mensaje:', messageData.message_key)
      }
    } catch (err) {
      console.error('Error trackeando impresion:', err)
    }
  }, [supabase, userId, questionsAnswered])

  // Efecto al abrir modal
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      hasTrackedRef.current = false
      setImpressionId(null)
      loadMessage()

      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, loadMessage])

  // Trackear impresion cuando tenemos el mensaje
  useEffect(() => {
    if (isOpen && message && message.id && !hasTrackedRef.current) {
      trackImpression(message)
    }
  }, [isOpen, message, trackImpression])

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

  // Handler para clic en upgrade con plan específico
  const handleUpgradeWithPlan = async (plan) => {
    // Trackear clic
    if (supabase && impressionId) {
      try {
        await supabase.rpc('track_upgrade_message_click', {
          p_impression_id: impressionId
        })
        console.log('Clic en upgrade trackeado')
      } catch (err) {
        console.error('Error trackeando clic:', err)
      }
    }

    // Redirigir a premium con el plan seleccionado
    router.push(`/premium?plan=${plan}`)
    onClose()
  }

  // Handler para clic en botón principal (usa plan por defecto: semester)
  const handleUpgrade = async () => {
    await handleUpgradeWithPlan('semester')
  }

  // Handler para dismiss
  const handleDismiss = async () => {
    // Trackear dismiss
    if (supabase && impressionId) {
      try {
        await supabase.rpc('track_upgrade_message_dismiss', {
          p_impression_id: impressionId
        })
        console.log('Dismiss trackeado')
      } catch (err) {
        console.error('Error trackeando dismiss:', err)
      }
    }

    onClose()
  }

  if (!isOpen) return null

  const timeUntilReset = getTimeUntilReset()
  const currentMessage = message || DEFAULT_MESSAGE

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal - compacto en móvil */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header con gradiente dinamico - más compacto en móvil */}
        <div className={`bg-gradient-to-r ${currentMessage.gradient} p-3 sm:p-5 text-center`}>
          <div className="w-10 h-10 sm:w-14 sm:h-14 mx-auto mb-2 sm:mb-3 bg-white/20 rounded-full flex items-center justify-center">
            {isLoading ? (
              <div className="w-5 h-5 sm:w-7 sm:h-7 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
              <div className="scale-75 sm:scale-100">
                <MessageIcon type={currentMessage.icon} />
              </div>
            )}
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-white mb-0.5">
            {personalize(currentMessage.title)}
          </h2>
          <p className="text-white/90 text-xs sm:text-sm">
            {personalize(currentMessage.subtitle)}
          </p>
        </div>

        {/* Contenido - más compacto en móvil */}
        <div className="p-3 sm:p-5">
          {/* Contador de preguntas */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3 text-center">
            <span className="text-red-600 dark:text-red-400 font-semibold text-xs sm:text-sm">
              {questionsAnswered} preguntas hoy - Limite alcanzado
            </span>
          </div>

          {/* Mensaje principal persuasivo */}
          <div className="text-center mb-2 sm:mb-4">
            <p className="text-gray-700 dark:text-gray-300 mb-1 sm:mb-2 text-xs sm:text-sm leading-snug">
              {personalize(currentMessage.body_message)}
            </p>
            <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
              {personalize(currentMessage.highlight)}
            </p>
          </div>

          {/* Beneficios - grid en móvil para ahorrar espacio */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg sm:rounded-xl p-2 sm:p-3 mb-2 sm:mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5 sm:mb-2 text-xs uppercase tracking-wider">
              Con Premium:
            </h3>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-1 sm:space-y-1.5 sm:gap-0">
              {[
                'Preguntas ilimitadas',
                '16 temas completos',
                'Estadisticas detalladas',
                'Sin interrupciones'
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="leading-tight">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Precios - clic directo a checkout */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-2 sm:mb-4">
            <button
              type="button"
              onClick={() => handleUpgradeWithPlan('monthly')}
              className="rounded-lg p-2 sm:p-3 text-center border-2 transition-all cursor-pointer bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:border-blue-500 hover:bg-blue-100 hover:scale-105"
            >
              <div className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">20€</div>
              <div className="text-[10px] sm:text-xs text-blue-600/70 dark:text-blue-400/70">al mes</div>
            </button>
            <button
              type="button"
              onClick={() => handleUpgradeWithPlan('semester')}
              className="rounded-lg p-2 sm:p-3 text-center border-2 relative transition-all cursor-pointer bg-green-50 dark:bg-green-900/20 border-green-500 hover:bg-green-100 hover:scale-105"
            >
              <div className="absolute -top-1.5 sm:-top-2 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                -50%
              </div>
              <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">59€</div>
              <div className="text-[10px] sm:text-xs text-green-600/70 dark:text-green-400/70">6 meses</div>
            </button>
          </div>

          {/* Botones */}
          <div className="space-y-1.5 sm:space-y-2">
            <button
              onClick={handleUpgrade}
              className={`w-full py-2.5 sm:py-3.5 px-3 bg-gradient-to-r ${currentMessage.gradient} hover:opacity-90 text-white font-bold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] text-sm sm:text-base`}
            >
              Desbloquear Acceso Ilimitado
            </button>

            <button
              onClick={handleDismiss}
              className="w-full py-1.5 sm:py-2 px-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xs sm:text-sm font-medium transition-colors"
            >
              Esperar a mañana
              {timeUntilReset && (
                <span className="ml-1 opacity-75">
                  ({timeUntilReset})
                </span>
              )}
            </button>
          </div>

          {/* Garantia */}
          <p className="text-center text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-2 sm:mt-3">
            Pago seguro con Stripe. Cancela cuando quieras.
          </p>
        </div>
      </div>
    </div>
  )
}
