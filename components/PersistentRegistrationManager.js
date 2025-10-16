// components/PersistentRegistrationManager.js
'use client'
import { useState, useEffect } from 'react'
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
  children
}) {
  // Estados internos
  const [user, setUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [attempt, setAttempt] = useState(1)
  const [userRejected, setUserRejected] = useState(false)

  // Verificar usuario
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.warn('Error verificando usuario:', error)
        setUser(null)
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null)
        if (session?.user) {
          setShowModal(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // 🎯 MODAL AL INICIAR TEST
  useEffect(() => {
    if (!enabled || user || showModal || attempt !== 1 || !totalQuestions || userRejected) return
    
    console.log('🎯 Trigger: Test iniciado sin usuario')
    const timer = setTimeout(() => {
      setShowModal(true)
    }, 15000)
    
    return () => clearTimeout(timer)
  }, [enabled, user, showModal, attempt, totalQuestions, userRejected])

  // 🎯 TRIGGERS DESPUÉS DE RESPUESTAS
  useEffect(() => {
    if (!enabled || user || !showResult || userRejected) return
    
    const shouldTrigger = (
      (currentQuestion === 1) ||                  // Después de la 2ª pregunta
      (currentQuestion === 3) ||                  // Después de la 4ª pregunta
      (currentQuestion === 5) ||                  // Después de la 6ª pregunta
      (currentQuestion === 7) ||                  // Después de la 8ª pregunta
      (currentQuestion % 2 === 1 && currentQuestion > 7) // Cada 2 preguntas después
    )
    
    if (shouldTrigger) {
      console.log('🎯 Trigger: Pregunta', currentQuestion + 1, '- Recordatorio')
      setTimeout(() => {
        setShowModal(true)
        setAttempt(prev => prev + 1)
      }, 1500)
    }
  }, [enabled, user, showResult, currentQuestion, attempt, userRejected])

  // 🎯 TRIGGER AL COMPLETAR TEST
  useEffect(() => {
    if (!enabled || user || !isTestCompleted || userRejected) return
    
    console.log('🎯 Trigger: Test completado sin registro')
    setTimeout(() => {
      setShowModal(true)
      setAttempt(prev => prev + 1)
    }, 2000)
  }, [enabled, user, isTestCompleted, userRejected])

  // 🎯 TRIGGER POR TIEMPO (cada 3 minutos)
  useEffect(() => {
    if (!enabled || user || showModal || userRejected) return
    
    const interval = setInterval(() => {
      console.log('🎯 Trigger por tiempo: 2 minutos')
      setShowModal(true)
      setAttempt(prev => prev + 1)
    }, 180000) // 3 minutos
    
    return () => clearInterval(interval)
  }, [enabled, user, showModal, userRejected])

  // 🎯 TRIGGER POR INACTIVIDAD (45 segundos sin responder)
  useEffect(() => {
    if (!enabled || user || showResult || showModal || userRejected) return
    
    const timer = setTimeout(() => {
      console.log('🎯 Trigger por inactividad')
      setShowModal(true)
      setAttempt(prev => prev + 1)
    }, 45000)
    
    return () => clearTimeout(timer)
  }, [enabled, user, showResult, showModal, currentQuestion, userRejected])

  // Manejadores
  const handleRegistrationSuccess = () => {
    setShowModal(false)
    console.log('✅ Usuario registrado exitosamente')
  }

  const handleRegistrationSkip = () => {
    setShowModal(false)
    if (attempt >= 6) {
      // Si ya es "última oportunidad", marcar como rechazado permanentemente
      setUserRejected(true)
      console.log('🚫 Usuario rechazó definitivamente el registro')
    } else {
      setAttempt(prev => prev + 1)
      console.log('👋 Usuario saltó registro, attempt:', attempt + 1)
    }
  }

  // Función para trigger manual desde el banner
  const triggerManual = () => {
    setShowModal(true)
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
      {/* Banner persistente y molesto */}
      {!user && !userRejected && (
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