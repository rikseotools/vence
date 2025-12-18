'use client'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

/**
 * ShareQuestion - Compartir preguntas individuales en redes sociales
 *
 * Comparte la pregunta como reto (sin mostrar respuesta) para generar curiosidad y clicks
 *
 * Props:
 * - question: Objeto con question_text, option_a/b/c/d, correct_option, explanation
 * - onClose: Callback al cerrar
 * - isOpen: Controla visibilidad del modal
 */
export default function ShareQuestion({
  question,
  onClose = () => {},
  isOpen = false
}) {
  const { user, supabase } = useAuth()
  const [shareSuccess, setShareSuccess] = useState(false)

  if (!isOpen || !question) return null

  // 🔄 Normalizar estructura de pregunta (TestLayout vs ExamLayout)
  const isTestLayoutFormat = Array.isArray(question.options)

  const getQuestionText = () => {
    return question.question_text || question.question || ''
  }

  const getOptions = () => {
    if (isTestLayoutFormat) {
      return question.options || []
    }
    return [question.option_a, question.option_b, question.option_c, question.option_d]
  }

  // Formatear texto para compartir
  const formatShareText = (platform) => {
    const questionText = getQuestionText()
    const options = getOptions()

    // Truncar para Twitter
    const truncate = (text, max) => {
      if (!text) return ''
      return text.length > max ? text.substring(0, max - 3) + '...' : text
    }

    const quizText = `🤔 ¿Sabrías responder esta pregunta?

${questionText}

A) ${options[0] || ''}
B) ${options[1] || ''}
C) ${options[2] || ''}
D) ${options[3] || ''}

¿Cuál es la respuesta correcta?`

    return platform === 'twitter'
      ? `🤔 ¿Sabrías responder?\n\n${truncate(questionText, 180)}\n\nA, B, C o D?`
      : quizText
  }

  // Registrar share en base de datos
  const trackShare = async (platform) => {
    if (!user) return

    try {
      await supabase
        .from('share_events')
        .insert({
          user_id: user.id,
          share_type: 'question_quiz',
          platform: platform,
          question_id: question.id,
          share_text: formatShareText(platform),
          share_url: `https://vence.es/pregunta/${question.id}`,
          device_info: {
            screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null
          }
        })
    } catch (error) {
      console.error('Error registrando share:', error)
    }
  }

  const handleShare = async (platform) => {
    const shareText = formatShareText(platform)
    const questionId = question.id
    const utmParams = `utm_source=${platform}&utm_medium=social&utm_campaign=question_share`
    const url = questionId
      ? `https://vence.es/pregunta/${questionId}?${utmParams}`
      : `https://vence.es?${utmParams}`
    let shareUrl = ''

    // URL limpia para WhatsApp/Telegram/Copy
    const cleanUrl = questionId
      ? `https://vence.es/pregunta/${questionId}`
      : 'https://vence.es'

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`
        break
      case 'whatsapp':
        const whatsappLink = cleanUrl.replace('https://', '')
        const whatsappMessage = `🤔 ¿Sabrías responder esta pregunta?\n\n${getQuestionText()}\n\nA) ${getOptions()[0] || ''}\nB) ${getOptions()[1] || ''}\nC) ${getOptions()[2] || ''}\nD) ${getOptions()[3] || ''}\n\n¿Cuál es la respuesta correcta?\n\n${whatsappLink}`

        // Intentar Web Share API en móviles
        if (typeof navigator !== 'undefined' && navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
          try {
            await navigator.share({ text: whatsappMessage })
            await trackShare('whatsapp')
            onClose()
            return
          } catch (err) {
            console.log('Web Share cancelado, usando método tradicional')
          }
        }

        shareUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`
        break
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(cleanUrl)}&text=${encodeURIComponent(shareText)}`
        break
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
        break
      case 'copy':
        try {
          const copyLink = cleanUrl.replace('https://', '')
          await navigator.clipboard.writeText(shareText + '\n\n' + copyLink)
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

    // Registrar intento de share
    await trackShare(platform)

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
      onClose()
    }
  }

  const handleClose = () => {
    setShareSuccess(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>📤</span> Compartir pregunta
            </h2>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-5">
          {/* Preview de la pregunta */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-5 text-sm">
            <p className="text-gray-700 dark:text-gray-300 font-medium line-clamp-3">
              {getQuestionText()}
            </p>
          </div>

          {!shareSuccess ? (
            <>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                ¿Dónde quieres compartir?
              </p>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleShare('whatsapp')}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 transition-all hover:scale-105"
                >
                  <svg className="w-7 h-7 mb-1" viewBox="0 0 24 24" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="text-xs text-green-700 dark:text-green-300 font-medium">WhatsApp</span>
                </button>

                <button
                  onClick={() => handleShare('twitter')}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-all hover:scale-105"
                >
                  <svg className="w-7 h-7 mb-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">X</span>
                </button>

                <button
                  onClick={() => handleShare('facebook')}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-all hover:scale-105"
                >
                  <svg className="w-7 h-7 mb-1" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Facebook</span>
                </button>

                <button
                  onClick={() => handleShare('telegram')}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:hover:bg-cyan-900/50 transition-all hover:scale-105"
                >
                  <svg className="w-7 h-7 mb-1" viewBox="0 0 24 24" fill="#0088cc">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  <span className="text-xs text-cyan-700 dark:text-cyan-300 font-medium">Telegram</span>
                </button>

                <button
                  onClick={() => handleShare('linkedin')}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-all hover:scale-105"
                >
                  <svg className="w-7 h-7 mb-1" viewBox="0 0 24 24" fill="#0A66C2">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">LinkedIn</span>
                </button>

                <button
                  onClick={() => handleShare('copy')}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 transition-all hover:scale-105"
                >
                  <svg className="w-7 h-7 mb-1 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Copiar</span>
                </button>
              </div>

              {/* Preview del texto */}
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Vista previa:</div>
                <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-line line-clamp-4">
                  {formatShareText('whatsapp')}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  vence.es/pregunta/...
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-5xl mb-3">📋</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                ¡Copiado!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
