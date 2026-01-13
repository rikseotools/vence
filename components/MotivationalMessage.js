'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function MotivationalMessage({
  category = 'exam_result',
  context = {},
  onMessageLoaded = null,
  className = '',
  hideShareButton = false
}) {
  const { user, supabase } = useAuth()
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reaction, setReaction] = useState(null) // 'love', 'like', 'dislike', 'funny'
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)

  useEffect(() => {
    if (user) {
      fetchMessage()
    }
  }, [user, category])

  const fetchMessage = async () => {
    try {
      setLoading(true)

      console.log('🔍 Obteniendo mensaje motivacional:', { category, context })

      // Llamar a la función SQL
      const { data, error } = await supabase.rpc('get_personalized_message', {
        p_user_id: user.id,
        p_category: category,
        p_context: context
      })

      if (error) {
        console.error('❌ Error en get_personalized_message:', error)
        throw error
      }

      console.log('✅ Mensaje recibido:', data)

      if (data && data.length > 0) {
        const msg = data[0]
        setMessage(msg)

        // Detectar reacción previa del usuario
        const { data: userReaction } = await supabase
          .from('user_message_interactions')
          .select('action_type')
          .eq('user_id', user.id)
          .eq('message_id', msg.message_id)
          .in('action_type', ['love', 'like', 'dislike', 'funny'])
          .single()

        if (userReaction) {
          setReaction(userReaction.action_type)
        }

        // Registrar que se vio el mensaje
        await trackInteraction('view', msg.message_id, msg.message_text)

        if (onMessageLoaded) {
          onMessageLoaded(msg)
        }
      }
    } catch (error) {
      console.error('❌ Error al cargar mensaje motivacional:', error)
    } finally {
      setLoading(false)
    }
  }

  const trackInteraction = async (actionType, messageId, messageText, platform = null) => {
    if (!user || !messageId) {
      console.log('❌ No se puede guardar interacción: user o messageId faltante', { user: !!user, messageId })
      return
    }

    console.log('💾 Intentando guardar interacción:', {
      actionType,
      messageId,
      userId: user.id,
      category,
      platform,
      messageText: messageText?.substring(0, 50) + '...'
    })

    try {
      const interactionData = {
        user_id: user.id,
        message_id: messageId,
        action_type: actionType,
        shown_in: category,
        message_text: messageText,
        share_platform: platform,
        device_info: {
          screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
        }
      }

      console.log('📤 Datos a insertar:', interactionData)

      const { data, error } = await supabase
        .from('user_message_interactions')
        .insert(interactionData)
        .select()

      if (error) {
        if (error.code === '23505') {
          // Duplicado - comportamiento esperado, no mostrar como error
          console.log('ℹ️ Ya has reaccionado así a este mensaje')
        } else {
          console.error('❌ Error guardando interacción:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          })
        }
      } else {
        console.log('✅ Interacción guardada exitosamente:', data)
      }
    } catch (error) {
      console.error('❌ Error en trackInteraction (catch):', error)
    }
  }

  const handleReaction = async (reactionType) => {
    if (!message) return

    // Si ya tiene esa reacción, quitarla
    if (reaction === reactionType) {
      setReaction(null)
      await trackInteraction('unreact', message.message_id, message.message_text)
      return
    }

    // Establecer nueva reacción
    setReaction(reactionType)
    await trackInteraction(reactionType, message.message_id, message.message_text)

    // Si es dislike, cargar nuevo mensaje después de 1 segundo
    if (reactionType === 'dislike') {
      setTimeout(() => {
        fetchMessage()
      }, 1000)
    }
  }

  const handleShare = async (platform) => {
    if (!message) return

    // Crear texto personalizado con la puntuación del usuario
    const nota = context?.nota || 0
    const preguntas = context?.preguntas || 0
    const porcentaje = context?.accuracy || (nota * 10)

    const shareText = `¡Acabo de sacar un ${nota}/10 en mi test de oposiciones en vence.es! 💪`
    const url = 'https://www.vence.es'

    let shareUrl = ''

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`
        break
      case 'instagram':
        // Instagram no permite compartir directamente desde web, copiamos al portapapeles
        try {
          await navigator.clipboard.writeText(shareText)
          setShareSuccess(true)
          setTimeout(() => setShareSuccess(false), 2000)
          alert('Texto copiado al portapapeles. Pégalo en tu historia o publicación de Instagram.')
        } catch (error) {
          console.error('Error al copiar:', error)
        }
        break
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + url)}`
        break
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
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

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
    }

    await trackInteraction('share', message.message_id, message.message_text, platform)
    setShowShareMenu(false)
  }

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl p-6 ${className}`}>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      </div>
    )
  }

  if (!message) {
    return null
  }

  // Determinar colores según el color_scheme
  const colorClasses = {
    blue: 'from-blue-50 to-cyan-50 border-blue-200',
    green: 'from-green-50 to-emerald-50 border-green-200',
    yellow: 'from-yellow-50 to-amber-50 border-yellow-200',
    purple: 'from-purple-50 to-pink-50 border-purple-200',
    red: 'from-red-50 to-orange-50 border-red-200'
  }

  const bgClass = colorClasses[message.color_scheme] || colorClasses.blue

  return (
    <div className={`relative bg-gradient-to-br ${bgClass} border-2 rounded-xl p-6 shadow-lg ${className}`}>
      {/* Mensaje principal */}
      <div className="flex items-start space-x-4">
        <div className="text-4xl flex-shrink-0">
          {message.emoji}
        </div>
        <div className="flex-1">
          <p className="text-lg font-medium text-gray-800 dark:text-gray-900 leading-relaxed">
            {message.message_text}
          </p>
        </div>
      </div>

      {/* Botones de interacción */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-gray-200">
        {/* Reacciones: Corazón, Like, Dislike, Risa */}
        <div className="flex items-center justify-center sm:justify-start space-x-2">
          {/* Corazón */}
          <button
            onClick={() => handleReaction('love')}
            className={`px-2 sm:px-3 py-2 rounded-lg transition-all transform hover:scale-110 ${
              reaction === 'love'
                ? 'bg-red-100 text-red-600 scale-110'
                : 'bg-white hover:bg-red-50 text-gray-600'
            }`}
            title="Me encanta"
          >
            <span className="text-xl sm:text-2xl">❤️</span>
          </button>

          {/* Pulgar arriba */}
          <button
            onClick={() => handleReaction('like')}
            className={`px-2 sm:px-3 py-2 rounded-lg transition-all transform hover:scale-110 ${
              reaction === 'like'
                ? 'bg-blue-100 text-blue-600 scale-110'
                : 'bg-white hover:bg-blue-50 text-gray-600'
            }`}
            title="Me gusta"
          >
            <span className="text-xl sm:text-2xl">👍</span>
          </button>

          {/* Pulgar abajo */}
          <button
            onClick={() => handleReaction('dislike')}
            className={`px-2 sm:px-3 py-2 rounded-lg transition-all transform hover:scale-110 ${
              reaction === 'dislike'
                ? 'bg-gray-200 text-gray-700 scale-110'
                : 'bg-white hover:bg-gray-100 text-gray-600'
            }`}
            title="No me gusta (mostrar otro)"
          >
            <span className="text-xl sm:text-2xl">👎</span>
          </button>

          {/* Risa */}
          <button
            onClick={() => handleReaction('funny')}
            className={`px-2 sm:px-3 py-2 rounded-lg transition-all transform hover:scale-110 ${
              reaction === 'funny'
                ? 'bg-yellow-100 text-yellow-600 scale-110'
                : 'bg-white hover:bg-yellow-50 text-gray-600'
            }`}
            title="Me da risa"
          >
            <span className="text-xl sm:text-2xl">😂</span>
          </button>
        </div>

        {/* Compartir - Solo mostrar si no está oculto */}
        {!hideShareButton && (
          <div className="relative w-full sm:w-auto">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition-all shadow-sm w-full sm:w-auto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
              </svg>
              <span className="text-sm font-medium">Compartir</span>
            </button>

            {/* Menú de compartir */}
            {showShareMenu && (
              <div className="absolute left-0 sm:right-0 sm:left-auto bottom-full mb-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 w-full sm:min-w-[180px] sm:w-auto z-50">
                <button
                  onClick={() => handleShare('twitter')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-sm"
                >
                  <span>✖️</span>
                  <span>X (Twitter)</span>
                </button>
                <button
                  onClick={() => handleShare('facebook')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-sm"
                >
                  <span>📘</span>
                  <span>Facebook</span>
                </button>
                <button
                  onClick={() => handleShare('instagram')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-sm"
                >
                  <span>📷</span>
                  <span>Instagram</span>
                </button>
                <button
                  onClick={() => handleShare('whatsapp')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-sm"
                >
                  <span>💬</span>
                  <span>WhatsApp</span>
                </button>
                <button
                  onClick={() => handleShare('linkedin')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-sm"
                >
                  <span>💼</span>
                  <span>LinkedIn</span>
                </button>
                <div className="border-t border-gray-100 my-1"></div>
                <button
                  onClick={() => handleShare('copy')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-sm"
                >
                  <span>📋</span>
                  <span>{shareSuccess ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
