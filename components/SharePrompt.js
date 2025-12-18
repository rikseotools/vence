'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

/**
 * SharePrompt - Componente inteligente para incentivar shares
 *
 * Lógica de cuándo mostrar el prompt:
 * - Nunca ha compartido → Mostrar siempre después de examen
 * - Ha compartido 1-2 veces y lleva 5+ tests → Recordar amablemente
 * - Comparte regularmente (1 share por cada 3 tests) → No molestar
 *
 * Props:
 * - score: Nota del examen (sobre 10)
 * - testSessionId: ID de la sesión del test (opcional)
 * - onClose: Callback cuando se cierra el prompt
 * - forceShow: Forzar mostrar (para testing)
 */
export default function SharePrompt({
  score,
  testSessionId = null,
  onClose = () => {},
  forceShow = false
}) {
  const { user, supabase } = useAuth()
  const [isVisible, setIsVisible] = useState(false)
  const [shareStats, setShareStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showShareOptions, setShowShareOptions] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [promptType, setPromptType] = useState('first') // 'first', 'reminder', 'celebrate'

  useEffect(() => {
    if (user) {
      checkIfShouldShowPrompt()
    } else {
      setLoading(false)
    }
  }, [user])

  const checkIfShouldShowPrompt = async () => {
    try {
      // Obtener estadísticas de shares del usuario
      const { data: stats, error } = await supabase
        .rpc('get_user_share_stats', { p_user_id: user.id })

      if (error) {
        console.error('Error obteniendo stats de shares:', error)
        // Si la función no existe aún, asumir que nunca ha compartido
        setShareStats({ total_shares: 0, total_tests: 1 })
        setPromptType('first')
        setIsVisible(true)
        setLoading(false)
        return
      }

      const shareData = stats?.[0] || { total_shares: 0, total_tests: 0 }
      setShareStats(shareData)

      // Lógica para decidir si mostrar prompt
      const { total_shares, total_tests } = shareData

      if (forceShow) {
        setPromptType('first')
        setIsVisible(true)
      } else if (total_shares === 0) {
        // Nunca ha compartido → Mostrar prompt amigable
        setPromptType('first')
        setIsVisible(true)
      } else if (total_shares <= 2 && total_tests >= 5) {
        // Ha compartido poco y es usuario activo → Recordar
        setPromptType('reminder')
        setIsVisible(true)
      } else if (total_shares > 0 && total_tests > 0 && (total_shares / total_tests) < 0.1) {
        // Menos del 10% de tests compartidos y lleva muchos tests → Recordar ocasionalmente
        // Solo mostrar 1 de cada 5 veces (20% probabilidad)
        if (Math.random() < 0.2) {
          setPromptType('reminder')
          setIsVisible(true)
        }
      }
      // Si comparte regularmente, no molestar

    } catch (error) {
      console.error('Error en checkIfShouldShowPrompt:', error)
    } finally {
      setLoading(false)
    }
  }

  const trackShare = async (platform, shareText, shareUrl) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('share_events')
        .insert({
          user_id: user.id,
          share_type: 'exam_result',
          platform: platform,
          score: parseFloat(score),
          test_session_id: testSessionId,
          share_text: shareText,
          share_url: shareUrl,
          device_info: {
            screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            referrer: typeof document !== 'undefined' ? document.referrer : null
          }
        })

      if (error) {
        console.error('Error registrando share:', error)
      } else {
        console.log('📤 Share registrado:', { platform, shareText, shareUrl })
      }
    } catch (error) {
      console.error('Error en trackShare:', error)
    }
  }

  const handleShare = async (platform) => {
    // URL con UTM parameters para trackear en Google Analytics
    const utmParams = `utm_source=${platform}&utm_medium=social&utm_campaign=exam_share&utm_content=score_${score}`
    const url = `https://vence.es?${utmParams}`
    const shareText = `He sacado un ${score}/10 en mi test de oposiciones en vence.es`
    let shareUrl = ''

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`
        break
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + url)}`
        break
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
        break
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`
        break
      case 'copy':
        try {
          await navigator.clipboard.writeText(shareText + '\n' + url)
          setShareSuccess(true)
          setTimeout(() => setShareSuccess(false), 2000)
        } catch (error) {
          console.error('Error al copiar:', error)
        }
        break
    }

    // Registrar el share con el texto y URL
    await trackShare(platform, shareText, shareUrl || `copied: ${shareText}\n${url}`)

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
      // Simplemente cerrar - no podemos saber si realmente compartió
      handleClose()
    }
  }

  const handleClose = () => {
    setIsVisible(false)
    onClose()
  }

  // Contenido del prompt según el tipo
  const getPromptContent = () => {
    switch (promptType) {
      case 'first':
        return {
          emoji: '🚀',
          title: '¡Comparte tu resultado!',
          message: 'Ayuda a otros opositores a descubrir Vence. ¡Juntos llegamos más lejos!',
          highlight: null
        }
      case 'reminder':
        return {
          emoji: '💪',
          title: '¡Ayúdanos a crecer!',
          message: `Has hecho ${shareStats?.total_tests || 'varios'} tests pero solo has compartido ${shareStats?.total_shares || 0} vez${shareStats?.total_shares === 1 ? '' : 'es'}. ¡Compartir ayuda mucho a Vence a seguir mejorando!`,
          highlight: 'Cada share cuenta'
        }
      case 'celebrate':
        return {
          emoji: '🎉',
          title: '¡Resultado increíble!',
          message: '¡Este resultado merece ser compartido! Demuestra tu progreso.',
          highlight: `${score}/10`
        }
      default:
        return {
          emoji: '📢',
          title: 'Comparte tu progreso',
          message: 'Compartir motiva a otros opositores como tú.',
          highlight: null
        }
    }
  }

  if (loading || !isVisible || !user) {
    return null
  }

  const content = getPromptContent()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform animate-slideUp">

        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-6 text-center text-white">
          <div className="text-5xl mb-3 animate-bounce">{content.emoji}</div>
          <h2 className="text-2xl font-bold mb-2">{content.title}</h2>
          {content.highlight && (
            <div className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-4 py-1 text-sm font-medium">
              {content.highlight}
            </div>
          )}
        </div>

        {/* Contenido */}
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
            {content.message}
          </p>

          {/* Nota del usuario */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 rounded-xl p-4 mb-6 text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Tu resultado</div>
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              {score}/10
            </div>
          </div>

          {/* Botones de redes sociales */}
          {!shareSuccess ? (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <button
                onClick={() => handleShare('whatsapp')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 transition-all hover:scale-105"
              >
                <span className="text-2xl mb-1">💬</span>
                <span className="text-xs text-green-700 dark:text-green-300 font-medium">WhatsApp</span>
              </button>

              <button
                onClick={() => handleShare('twitter')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/30 dark:hover:bg-sky-900/50 transition-all hover:scale-105"
              >
                <span className="text-2xl mb-1">𝕏</span>
                <span className="text-xs text-sky-700 dark:text-sky-300 font-medium">Twitter</span>
              </button>

              <button
                onClick={() => handleShare('facebook')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-all hover:scale-105"
              >
                <span className="text-2xl mb-1">📘</span>
                <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Facebook</span>
              </button>

              <button
                onClick={() => handleShare('telegram')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:hover:bg-cyan-900/50 transition-all hover:scale-105"
              >
                <span className="text-2xl mb-1">✈️</span>
                <span className="text-xs text-cyan-700 dark:text-cyan-300 font-medium">Telegram</span>
              </button>

              <button
                onClick={() => handleShare('linkedin')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 transition-all hover:scale-105"
              >
                <span className="text-2xl mb-1">💼</span>
                <span className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">LinkedIn</span>
              </button>

              <button
                onClick={() => handleShare('copy')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 transition-all hover:scale-105"
              >
                <span className="text-2xl mb-1">📋</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Copiar</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-5xl mb-3 animate-bounce">🙏</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                ¡Gracias por compartir!
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Ayudas a que más opositores conozcan Vence
              </div>
            </div>
          )}

          {/* Botón cerrar */}
          {!shareSuccess && (
            <button
              onClick={handleClose}
              className="w-full py-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm transition-colors"
            >
              Ahora no, gracias
            </button>
          )}
        </div>
      </div>

      {/* Estilos de animación */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
