'use client'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

/**
 * ShareStreak - Compartir racha de estudio en redes sociales
 *
 * Props:
 * - streakDays: Número de días de racha actual
 * - onClose: Callback al cerrar
 * - isOpen: Controla visibilidad del modal
 */
export default function ShareStreak({
  streakDays,
  onClose = () => {},
  isOpen = false
}) {
  const { user, supabase } = useAuth()
  const [shareSuccess, setShareSuccess] = useState(false)

  if (!isOpen || !streakDays) return null

  // Mensaje según el nivel de racha
  const getStreakMessage = () => {
    if (streakDays >= 100) {
      return { emoji: '🏆', title: '¡Racha LEGENDARIA!', level: 'legendary' }
    } else if (streakDays >= 30) {
      return { emoji: '🔥', title: '¡Racha ÉPICA!', level: 'epic' }
    } else if (streakDays >= 14) {
      return { emoji: '⚡', title: '¡Racha INCREÍBLE!', level: 'incredible' }
    } else if (streakDays >= 7) {
      return { emoji: '💪', title: '¡Gran racha!', level: 'great' }
    } else if (streakDays >= 3) {
      return { emoji: '🌟', title: '¡Buena racha!', level: 'good' }
    } else {
      return { emoji: '✨', title: '¡Empezando!', level: 'starting' }
    }
  }

  const streakInfo = getStreakMessage()

  // Formatear texto de compartir
  const formatShareText = (platform) => {
    const baseText = `${streakInfo.emoji} ¡Llevo ${streakDays} días consecutivos estudiando para mis oposiciones!`

    if (platform === 'twitter') {
      return `${baseText}\n\n¿Cuántos días llevas tú? #oposiciones #estudio`
    }

    return `${baseText}\n\nEstudio con Vence, una app gratuita para preparar oposiciones.\n\n¿Cuántos días llevas tú?`
  }

  // Registrar share en base de datos
  const trackShare = async (platform) => {
    if (!user) return

    try {
      await supabase
        .from('share_events')
        .insert({
          user_id: user.id,
          share_type: 'streak',
          platform: platform,
          share_text: formatShareText(platform),
          share_url: 'https://www.vence.es',
          device_info: {
            screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            streak_days: streakDays // Guardamos en device_info ya que no hay columna
          }
        })
      console.log('📤 Share racha registrado:', platform, streakDays, 'días')
    } catch (error) {
      console.error('Error registrando share de racha:', error)
    }
  }

  const handleShare = async (platform) => {
    const shareText = formatShareText(platform)
    const url = `https://www.vence.es?utm_source=${platform}&utm_medium=social&utm_campaign=streak_share&utm_content=streak_${streakDays}`
    let shareUrl = ''

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`
        break
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText + '\n\nhttps://www.vence.es')}`
        break
      case 'telegram':
        shareUrl = `https://t.me/share/url?text=${encodeURIComponent(shareText + '\n\nhttps://www.vence.es')}`
        break
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
        break
      case 'copy':
        try {
          await navigator.clipboard.writeText(shareText + '\n\nhttps://www.vence.es')
          setShareSuccess(true)
          setTimeout(() => {
            setShareSuccess(false)
            onClose()
          }, 1500)
        } catch (error) {
          console.error('Error al copiar:', error)
        }
        break
    }

    // Registrar el share
    await trackShare(platform)

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
      // Simplemente cerrar - no podemos saber si realmente compartió
      onClose()
    }
  }

  const handleClose = () => {
    setShareSuccess(false)
    onClose()
  }

  // Color según nivel de racha
  const getLevelGradient = () => {
    switch (streakInfo.level) {
      case 'legendary': return 'from-yellow-400 via-orange-500 to-red-600'
      case 'epic': return 'from-orange-500 via-red-500 to-pink-600'
      case 'incredible': return 'from-purple-500 via-pink-500 to-red-500'
      case 'great': return 'from-blue-500 via-purple-500 to-pink-500'
      case 'good': return 'from-green-500 via-teal-500 to-blue-500'
      default: return 'from-blue-400 via-indigo-500 to-purple-500'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header con gradiente según nivel */}
        <div className={`bg-gradient-to-r ${getLevelGradient()} p-6 text-center text-white`}>
          <div className="text-6xl mb-3 animate-bounce">{streakInfo.emoji}</div>
          <h2 className="text-2xl font-bold mb-2">{streakInfo.title}</h2>
          <div className="text-5xl font-black mb-1">{streakDays}</div>
          <div className="text-white/80 text-sm">días consecutivos</div>
        </div>

        {/* Contenido */}
        <div className="p-5">
          {!shareSuccess ? (
            <>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-5">
                ¡Comparte tu racha y motiva a otros opositores!
              </p>

              <div className="grid grid-cols-3 gap-3">
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

              {/* Preview */}
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Vista previa:</div>
                <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-line line-clamp-3">
                  {formatShareText('whatsapp')}
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full mt-4 py-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm transition-colors"
              >
                Ahora no
              </button>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-5xl mb-3 animate-bounce">🎉</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                ¡Compartido!
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Sigue así, ¡vas genial!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
