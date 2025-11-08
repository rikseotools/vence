// components/ProgressiveRegistrationModal.js - CON DARK MODE COMPLETO
'use client'
import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient, signInWithGoogle } from '../lib/supabase'

export default function ProgressiveRegistrationModal({ 
  isOpen, 
  onClose, 
  onRegister,
  currentQuestion = 0,
  totalQuestions = 10,
  tema = 1,
  testNumber = 1,
  attempt = 1,
  score = 0,
  isCompleted = false,
  isInitialPrompt = false,
  isQuestionPrompt = false
}) {
  // 🚫 TEMPORALMENTE DESACTIVADO - Modal muy agresivo
  return null
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [timeLeft, setTimeLeft] = useState(30)

  // ✅ VERIFICAR USUARIO AL ABRIR MODAL
  useEffect(() => {
    if (isOpen) {
      setError(null)
      setTimeLeft(30)
      setLoading(false)
      
      // ⚡ Verificar si ya hay usuario autenticado
      const checkUser = async () => {
        try {
          const supabase = getSupabaseClient()
          const { data: { user }, error } = await supabase.auth.getUser()
          
          if (user && !error) {
            console.log('✅ [MODAL] Usuario ya autenticado:', user.email)
            onRegister()
          }
        } catch (err) {
          console.warn('⚠️ [MODAL] Error verificando usuario:', err)
        }
      }
      
      checkUser()
    }
  }, [isOpen, onRegister])

  // ✅ ESCUCHAR EVENTOS DE AUTH GLOBALES
  useEffect(() => {
    const handleAuthSuccess = (event) => {
      const { user } = event.detail
      if (user) {
        console.log('✅ [MODAL] Usuario autenticado vía evento:', user.email)
        onRegister()
      }
    }

    const handleAuthChange = (event) => {
      const { event: authEvent, user } = event.detail
      if (authEvent === 'SIGNED_IN' && user) {
        console.log('✅ [MODAL] Usuario conectado:', user.email)
        onRegister()
      }
    }

    // ✅ Escuchar múltiples tipos de eventos
    window.addEventListener('supabaseAuthSuccess', handleAuthSuccess)
    window.addEventListener('supabaseAuthChange', handleAuthChange)

    return () => {
      window.removeEventListener('supabaseAuthSuccess', handleAuthSuccess)
      window.removeEventListener('supabaseAuthChange', handleAuthChange)
    }
  }, [onRegister])

  // ✅ COUNTDOWN TIMER
  useEffect(() => {
    let timerId = null
    
    if (isOpen && timeLeft > 0 && attempt >= 2 && !loading) {
      timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
    }
    
    return () => {
      if (timerId) clearTimeout(timerId)
    }
  }, [isOpen, timeLeft, attempt, loading])

  // ✅ FUNCIÓN DE LOGIN SIMPLIFICADA
  const handleGoogleLogin = useCallback(async () => {
    if (loading) return
    
    try {
      setLoading(true)
      setError(null)
      
      console.log('🚀 [MODAL] Iniciando OAuth con Google...')
      
      // ⚡ Usar función simplificada del singleton
      const result = await signInWithGoogle()
      
      if (!result.success) {
        throw new Error(result.error || 'Error desconocido en OAuth')
      }
      
      console.log('🔄 [MODAL] Redirigiendo a Google OAuth...')
      
      // ✅ El navegador redirigirá automáticamente
      // No cerramos el modal aquí - se cerrará cuando vuelva el usuario
      
    } catch (error) {
      console.error('❌ [MODAL] Error en OAuth:', error)
      
      let userFriendlyError = 'Error de autenticación. Inténtalo de nuevo.'
      
      // ⚡ Mensajes específicos para errores comunes
      if (error.message.includes('popup')) {
        userFriendlyError = 'Popup bloqueado. Permite popups para este sitio.'
      } else if (error.message.includes('network')) {
        userFriendlyError = 'Error de conexión. Verifica tu internet.'
      } else if (error.message.includes('cancelled')) {
        userFriendlyError = 'Login cancelado. Inténtalo de nuevo.'
      }
      
      setError(userFriendlyError)
      
    } finally {
      setLoading(false)
    }
  }, [loading])

  // ✅ FUNCIÓN DE SKIP
  const handleSkip = useCallback(() => {
    console.log('👋 [MODAL] Usuario saltó registro')
    onClose()
  }, [onClose])

  // ✅ CONTENIDO DINÁMICO DEL MODAL
  const getModalContent = useCallback(() => {
    if (isCompleted) {
      return {
        icon: "🏆",
        title: "¡Guarda tu Resultado!",
        subtitle: `${score}/${totalQuestions} correctas`,
        urgency: "Tu resultado se perderá al cerrar",
        backgroundColor: "from-emerald-600 to-blue-600",
        benefits: [
          `💾 Guardar puntuación: ${score}/${totalQuestions}`,
          "📊 Estadísticas detalladas",
          "📈 Comparar intentos",
          "🎯 Recomendaciones IA"
        ]
      }
    } else if (attempt >= 3) {
      return {
        icon: "🚀",
        title: "¡Regístrate Ahora!",
        subtitle: `${currentQuestion + 1}/${totalQuestions} completadas`,
        urgency: "✨ Solo toma 5 segundos con Google",
        backgroundColor: "from-blue-500 to-indigo-600",
        benefits: [
          "🧠 Análisis inteligente de tu progreso",
          "📊 Seguimiento detallado de mejoras",
          "🎯 Recomendaciones personalizadas",
          "📱 Sincronización en todos tus dispositivos",
          "🔥 Sistema de rachas motivacional",
          "⚡ Detección automática de puntos débiles"
        ]
      }
    } else if (attempt >= 2) {
      return {
        icon: "🚀",
        title: "¡Regístrate Gratis!",
        subtitle: `${currentQuestion + 1} preguntas completadas`,
        urgency: `✨ Desbloquea todas las funcionalidades premium`,
        backgroundColor: "from-emerald-500 to-blue-500",
        benefits: [
          "🧠 Análisis con IA de tu progreso",
          "📊 Seguimiento detallado de mejoras",
          "🎯 Recomendaciones personalizadas",
          "📱 Sincronización en todos tus dispositivos",
          "🔥 Sistema de rachas motivacional",
          "⚡ Detección automática de puntos débiles"
        ]
      }
    } else {
      return {
        icon: "🚀",
        title: "¡Regístrate Gratis!",
        subtitle: "Desbloquea el poder de la IA",
        urgency: "✨ Transforma tu forma de estudiar",
        backgroundColor: "from-emerald-600 to-cyan-600",
        benefits: [
          "🧠 Análisis inteligente con IA",
          "📊 Seguimiento completo de progreso",
          "🎯 Recomendaciones personalizadas",
          "🔥 Sistema de rachas motivacional",
          "📱 Acceso desde cualquier dispositivo"
        ]
      }
    }
  }, [isCompleted, score, totalQuestions, attempt, currentQuestion, timeLeft])

  if (!isOpen) return null

  const content = getModalContent()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className={`text-white p-6 rounded-t-2xl bg-gradient-to-r ${content.backgroundColor}`}>
          <div className="text-center">
            <div className="text-4xl mb-2">{content.icon}</div>
            <h2 className="text-xl font-bold mb-2">{content.title}</h2>
            <p className="text-sm opacity-90">{content.subtitle}</p>
            
            {/* Progress bar */}
            <div className="mt-4 bg-white bg-opacity-20 rounded-full h-2">
              <div 
                className="bg-white h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / totalQuestions) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs mt-1">{currentQuestion + 1}/{totalQuestions} preguntas</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          
          {/* Urgency message */}
          <div className={`text-center p-3 rounded-lg mb-4 ${
            attempt >= 3 
              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700' 
              : attempt >= 2 
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700' 
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
          }`}>
            <p className="font-bold text-sm">{content.urgency}</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3 mb-4">
              <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                💡 Tip: Asegúrate de permitir popups para este sitio
              </p>
            </div>
          )}

          {/* Benefits */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-center">
              🎁 ¿Qué obtienes GRATIS?
            </h3>
            <ul className="space-y-2">
              {content.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start text-sm">
                  <span className="mr-2 mt-0.5 text-green-600 dark:text-green-400">✅</span>
                  <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            
            {/* Google login button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className={`w-full text-white py-4 px-6 rounded-lg font-bold text-lg transition-all disabled:opacity-50 flex items-center justify-center space-x-3 shadow-lg bg-gradient-to-r ${content.backgroundColor} ${
                loading ? 'cursor-not-allowed' : 'hover:shadow-xl transform hover:scale-[1.02]'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <div className="bg-white rounded-full p-1">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <span>
                    {isCompleted ? "💾 Guardar Resultado" :
                     attempt >= 3 ? "🚀 Registrarse Ahora" :
                     "🚀 Registrarse con Google"}
                  </span>
                </>
              )}
            </button>

            {/* Skip button */}
            <button
              onClick={handleSkip}
              disabled={loading}
              className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors text-sm border disabled:opacity-50 ${
                attempt >= 3 
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 border-red-200 dark:border-red-700' 
                  : attempt >= 2 
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 border-yellow-200 dark:border-yellow-700' 
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600'
              }`}
            >
              {attempt >= 3 ? "Continuar sin registrarse" : "Continuar sin guardar"}
            </button>
          </div>

          {/* Privacy note */}
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
            🔒 Solo login seguro con Google. Sin spam ni emails no deseados.
          </p>
        </div>
      </div>
    </div>
  )
}