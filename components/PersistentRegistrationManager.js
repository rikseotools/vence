// components/PersistentRegistrationManager.js
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import ProgressiveRegistrationModal from './ProgressiveRegistrationModal'

import { getSupabaseClient } from '../lib/supabase'
const supabase = getSupabaseClient()

export default function PersistentRegistrationManager({
  // Props del test
  tema,
  testNumber,
  currentQuestion,
  totalQuestions,
  answeredQuestions,
  showResult,
  score,
  startTime,
  isTestCompleted,

  // Props de control
  enabled = true,
  externalUser = undefined,
  externalAuthLoading = undefined,
  children
}) {
  // Hook de router
  const router = useRouter()

  // Estados internos
  // Si se pasa externalUser, usar ese (más fiable, viene de AuthContext con refresh token)
  const [internalUser, setInternalUser] = useState(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(externalUser === undefined)
  const [showModal, setShowModal] = useState(false)
  const [attempt, setAttempt] = useState(1)
  const [userRejected, setUserRejected] = useState(false)

  // Usar externalUser si disponible, sino internalUser
  const user = externalUser !== undefined ? externalUser : internalUser

  // Verificar usuario solo si NO se pasa externalUser
  useEffect(() => {
    // Si tenemos externalUser, no necesitamos verificar por nuestra cuenta
    if (externalUser !== undefined) {
      setIsCheckingAuth(externalAuthLoading ?? false)
      return
    }

    const checkUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) {
          console.log('🔍 No hay sesión activa, usuario no registrado')
          setInternalUser(null)
        } else {
          console.log('✅ Usuario encontrado:', user?.email || 'sin email')
          setInternalUser(user)
        }
      } catch (error) {
        console.log('🔍 Error verificando usuario (normal en localhost):', error.message)
        setInternalUser(null)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 Auth change:', event, session?.user?.email || 'no user')
        setInternalUser(session?.user || null)
        if (session?.user) {
          setShowModal(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [externalUser, externalAuthLoading])

  // 🎯 MODAL AL INICIAR TEST (después de 10 segundos)
  useEffect(() => {
    // No iniciar timer hasta que sepamos si hay usuario
    if (!enabled || user || showModal || attempt !== 1 || !totalQuestions || userRejected || isCheckingAuth) return

    console.log('🎯 Trigger: Test iniciado sin usuario')
    const timer = setTimeout(() => {
      setShowModal(true)
    }, 10000) // Reducido de 15s a 10s

    return () => clearTimeout(timer)
  }, [enabled, user, showModal, attempt, totalQuestions, userRejected, isCheckingAuth])

  // 🎯 TRIGGERS PROGRESIVOS: cada 2 preguntas, luego cada pregunta
  useEffect(() => {
    console.log('🔍 DEBUG Trigger:', {
      enabled,
      user: !!user,
      showResult,
      userRejected,
      showModal,
      currentQuestion,
      attempt
    })

    if (!enabled || user || !showResult || userRejected || showModal) return

    const questionNum = currentQuestion + 1

    // Lógica progresiva más agresiva:
    // - Preguntas 1-6: cada 2 preguntas (2, 4, 6)
    // - Preguntas 7+: cada pregunta
    const shouldTrigger = (
      (questionNum <= 6 && questionNum % 2 === 0) ||  // Cada 2 preguntas hasta la 6
      (questionNum > 6)                                 // Cada pregunta después de la 6
    )

    console.log('🎯 Should trigger?', shouldTrigger, 'Pregunta:', questionNum)

    if (shouldTrigger) {
      console.log('🎯 Trigger progresivo: Pregunta', questionNum, '- Intento', attempt)
      setTimeout(() => {
        setShowModal(true)
        setAttempt(prev => prev + 1)
      }, 1000) // Reducido de 1500ms a 1000ms
    }
  }, [enabled, user, showResult, currentQuestion, attempt, userRejected, showModal])

  // 🎯 TRIGGER AL COMPLETAR TEST
  useEffect(() => {
    if (!enabled || user || !isTestCompleted || userRejected) return
    
    console.log('🎯 Trigger: Test completado sin registro')
    setTimeout(() => {
      setShowModal(true)
      setAttempt(prev => prev + 1)
    }, 2000)
  }, [enabled, user, isTestCompleted, userRejected])

  // 🚫 TRIGGERS POR TIEMPO DESACTIVADOS (menos agresivo)
  // Solo se activa cada 3 preguntas y al completar test

  // Manejadores
  const handleRegistrationSuccess = () => {
    setShowModal(false)
    console.log('✅ Usuario registrado exitosamente')
  }

  const handleRegistrationSkip = () => {
    setShowModal(false)
    // Nunca dejar de mostrar - el popup aparecerá siempre hasta que se registre
    setAttempt(prev => prev + 1)
    console.log('👋 Usuario saltó registro, attempt:', attempt + 1)
  }

  // Función para trigger manual desde el banner
  const triggerManual = () => {
    // En lugar de abrir modal, ir directamente a login
    router.push('/login')
  }

  // Función para formatear tiempo
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs} segundo${secs !== 1 ? 's' : ''}`
    if (secs === 0) return `${mins} minuto${mins !== 1 ? 's' : ''}`
    return `${mins}m ${secs}s`
  }

  if (!enabled) return children

  return (
    <>
      {/* Banner persistente y molesto - solo mostrar después de verificar auth */}
      {!user && !userRejected && !isCheckingAuth && (
        <div className={`border rounded-lg p-4 mb-6 ${
          attempt <= 2 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200' :
          attempt <= 5 ? 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-300' :
          'bg-gradient-to-r from-red-50 to-pink-50 border-red-400 animate-pulse'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">
                {attempt <= 2 ? '👤' :
                 attempt <= 5 ? '⚠️' : '🚨'}
              </span>
              <div>
                <div className={`font-bold ${
                  attempt <= 2 ? 'text-yellow-800' :
                  attempt <= 5 ? 'text-orange-800' :
                  'text-red-800'
                }`}>
                  {attempt <= 2 ? 'No estás registrado' :
                   attempt <= 5 ? '¡Estás perdiendo tu progreso!' :
                   '🚨 ¡TU PROGRESO SE PERDERÁ!'}
                </div>
                <div className={`text-sm ${
                  attempt <= 2 ? 'text-yellow-600' :
                  attempt <= 5 ? 'text-orange-600' :
                  'text-red-600'
                }`}>
                  {attempt <= 2 ? '⚠️ Tu progreso detallado no se guardará' :
                   attempt <= 5 ? `📊 Ya tienes ${answeredQuestions.length} respuestas que se perderán` :
                   `🔥 ${answeredQuestions.length} respuestas + ${formatTime(Math.floor((Date.now() - startTime) / 1000))} de trabajo SE PERDERÁN`}
                </div>
              </div>
            </div>
            <button
              onClick={triggerManual}
              className={`text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-all ${
                attempt <= 2 ? 'bg-gradient-to-r from-emerald-500 to-blue-500' :
                attempt <= 5 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                'bg-gradient-to-r from-red-600 to-pink-600 animate-pulse'
              }`}>
              {attempt <= 2 ? '🚀 Registrarse Gratis' :
               attempt <= 5 ? '💾 ¡Salvar Progreso!' :
               '🆘 ¡RESCATAR AHORA!'}
            </button>
          </div>
        </div>
      )}

      {/* Contenido del test */}
      {children}

      {/* Modal de registro progresivo */}
      <ProgressiveRegistrationModal
        isOpen={showModal}
        onClose={handleRegistrationSkip}
        onRegister={handleRegistrationSuccess}
        currentQuestion={currentQuestion}
        totalQuestions={totalQuestions}
        tema={tema}
        testNumber={testNumber}
        attempt={attempt}
        score={score}
        isCompleted={isTestCompleted}
        isInitialPrompt={attempt === 1}
        isQuestionPrompt={attempt === 2}
      />
    </>
  )
}