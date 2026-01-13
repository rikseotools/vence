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
    const url = `https://www.vence.es?${utmParams}`
    const shareText = `He sacado un ${score}/10 en mi test de oposiciones en vence.es`
    let shareUrl = ''

    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + url)}`
        break
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`
        break
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`
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
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => handleShare('whatsapp')}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 transition-all hover:scale-105"
              >
                <svg className="w-8 h-8 mb-2" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className="text-xs text-green-700 dark:text-green-300 font-medium">WhatsApp</span>
              </button>

              <button
                onClick={() => handleShare('telegram')}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:hover:bg-cyan-900/50 transition-all hover:scale-105"
              >
                <svg className="w-8 h-8 mb-2" viewBox="0 0 24 24" fill="#0088cc">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                <span className="text-xs text-cyan-700 dark:text-cyan-300 font-medium">Telegram</span>
              </button>

              <button
                onClick={() => handleShare('facebook')}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-all hover:scale-105"
              >
                <svg className="w-8 h-8 mb-2" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Facebook</span>
              </button>

              <button
                onClick={() => handleShare('twitter')}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 transition-all hover:scale-105"
              >
                <svg className="w-8 h-8 mb-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">X</span>
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
