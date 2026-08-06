// components/PsychometricRegistrationManager.js
'use client'
import { useState, useEffect } from 'react'
import { CAPAS } from '@/lib/ui/capas'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'

export default function PsychometricRegistrationManager({
  // Props del test
  categoria,
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
  const { user } = useAuth()
  
  // Estados internos
  const [showModal, setShowModal] = useState(false)
  const [attempt, setAttempt] = useState(1)
  const [userRejected, setUserRejected] = useState(false)

  // 🎯 MODAL AL INICIAR TEST (después de 3 segundos)
  useEffect(() => {
    if (!enabled || user || showModal || attempt !== 1 || !totalQuestions || userRejected) return
    
    console.log('🎯 Psychometric Trigger: Test iniciado sin usuario')
    const timer = setTimeout(() => {
      setShowModal(true)
    }, 15000)
    
    return () => clearTimeout(timer)
  }, [enabled, user, showModal, attempt, totalQuestions, userRejected])

  // 🎯 TRIGGERS DESPUÉS DE RESPUESTAS
  useEffect(() => {
    if (!enabled || user || !showResult || userRejected || showModal) return
    
    const shouldTrigger = (
      (currentQuestion === 1) ||                  // Después de la 2ª pregunta
      (currentQuestion === 3) ||                  // Después de la 4ª pregunta
      (currentQuestion === 5) ||                  // Después de la 6ª pregunta
      (currentQuestion === 7) ||                  // Después de la 8ª pregunta
      (currentQuestion % 2 === 1 && currentQuestion > 7) // Cada 2 preguntas después
    )
    
    if (shouldTrigger) {
      console.log('🎯 Psychometric Trigger: Pregunta', currentQuestion + 1, '- Recordatorio')
      setTimeout(() => {
        setShowModal(true)
        setAttempt(prev => prev + 1)
      }, 1500)
    }
  }, [enabled, user, showResult, currentQuestion, attempt, userRejected, showModal])

  // 🎯 TRIGGER AL COMPLETAR TEST
  useEffect(() => {
    if (!enabled || user || !isTestCompleted || userRejected) return
    
    console.log('🎯 Psychometric Trigger: Test completado sin registro')
    setTimeout(() => {
      setShowModal(true)
      setAttempt(prev => prev + 1)
    }, 2000)
  }, [enabled, user, isTestCompleted, userRejected])

  // 🎯 TRIGGER POR TIEMPO (cada 90 segundos)
  useEffect(() => {
    if (!enabled || user || showModal || userRejected) return
    
    const interval = setInterval(() => {
      console.log('🎯 Psychometric Trigger por tiempo: 90 segundos')
      setShowModal(true)
      setAttempt(prev => prev + 1)
    }, 180000) // 3 minutos
    
    return () => clearInterval(interval)
  }, [enabled, user, showModal, userRejected])

  // 🎯 TRIGGER POR INACTIVIDAD (25 segundos sin responder)
  useEffect(() => {
    if (!enabled || user || showResult || showModal || userRejected) return
    
    const timer = setTimeout(() => {
      console.log('🎯 Psychometric Trigger por inactividad')
      setShowModal(true)
      setAttempt(prev => prev + 1)
    }, 45000)
    
    return () => clearTimeout(timer)
  }, [enabled, user, showResult, showModal, currentQuestion, userRejected])

  // Manejadores
  const handleRegistrationSkip = () => {
    setShowModal(false)
    if (attempt >= 6) {
      // Si ya es "última oportunidad", marcar como rechazado permanentemente
      setUserRejected(true)
      console.log('🚫 Usuario rechazó definitivamente el registro psicotécnico')
    } else {
      setAttempt(prev => prev + 1)
      console.log('👋 Usuario saltó registro psicotécnico, attempt:', attempt + 1)
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
          attempt <= 2 ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200' :
          attempt <= 5 ? 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-300' :
          'bg-gradient-to-r from-red-50 to-pink-50 border-red-400 animate-pulse'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">
                {attempt <= 2 ? '🧠' :
                 attempt <= 5 ? '⚠️' : '🚨'}
              </span>
              <div>
                <div className={`font-bold ${
                  attempt <= 2 ? 'text-purple-800' :
                  attempt <= 5 ? 'text-orange-800' :
                  'text-red-800'
                }`}>
                  {attempt <= 2 ? 'Test psicotécnico sin registro' :
                   attempt <= 5 ? '¡Estás perdiendo tu progreso psicotécnico!' :
                   '🚨 ¡TU PROGRESO SE PERDERÁ!'}
                </div>
                <div className={`text-sm ${
                  attempt <= 2 ? 'text-purple-600' :
                  attempt <= 5 ? 'text-orange-600' :
                  'text-red-600'
                }`}>
                  {attempt <= 2 ? '🎯 Perderte las estadísticas adaptativas y el seguimiento personalizado' :
                   attempt <= 5 ? `📊 Ya tienes ${answeredQuestions.length} respuestas que se perderán` :
                   `🔥 ${answeredQuestions.length} respuestas + ${formatTime(Math.floor((Date.now() - startTime) / 1000))} de trabajo SE PERDERÁN`}
                </div>
              </div>
            </div>
            <button
              onClick={triggerManual}
              className={`text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-all ${
                attempt <= 2 ? 'bg-gradient-to-r from-purple-500 to-indigo-500' :
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

      {/* Modal de registro progresivo para psicotécnicos */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: CAPAS.modal }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="text-6xl mb-4">
              {attempt <= 2 ? '🧠' :
               attempt <= 5 ? '⚠️' : '🚨'}
            </div>
            
            <h2 className={`text-2xl font-bold mb-4 ${
              attempt <= 2 ? 'text-purple-800' :
              attempt <= 5 ? 'text-orange-800' :
              'text-red-800'
            }`}>
              {attempt <= 2 ? '¡Registra tu progreso psicotécnico!' :
               attempt <= 5 ? '¡No pierdas tu progreso!' :
               '🚨 ¡ÚLTIMA OPORTUNIDAD!'}
            </h2>
            
            {/* Progreso actual */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {score}/{currentQuestion + 1}
              </div>
              <div className="text-sm text-gray-600">
                {Math.round((score / Math.max(currentQuestion + 1, 1)) * 100)}% de aciertos
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {formatTime(Math.floor((Date.now() - startTime) / 1000))} invertido
              </div>
            </div>
            
            <p className={`mb-6 ${
              attempt <= 2 ? 'text-gray-600' :
              attempt <= 5 ? 'text-orange-600' :
              'text-red-600 font-medium'
            }`}>
              {attempt <= 2 ? 
                'Registra tu cuenta para guardar estadísticas, aprovechar la selección adaptativa y seguir tu progreso.' :
               attempt <= 5 ? 
                '¡Ya has invertido tiempo valioso! No dejes que se pierda tu progreso.' :
                '🔥 Si cierras ahora, TODO tu progreso se perderá para siempre. ¡Regístrate en 30 segundos!'}
            </p>
            
            <div className="space-y-3">
              <Link 
                href="/login"
                className={`block w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity ${
                  attempt <= 2 ? 'bg-gradient-to-r from-purple-600 to-indigo-600' :
                  attempt <= 5 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                  'bg-gradient-to-r from-red-600 to-pink-600 animate-pulse'
                }`}
              >
                {attempt <= 2 ? '✨ Crear Cuenta Gratis' :
                 attempt <= 5 ? '💾 ¡Salvar Progreso!' :
                 '🆘 ¡RESCATAR AHORA!'}
              </Link>
              <Link 
                href="/login"
                className="block w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Ya tengo cuenta
              </Link>
              <button
                onClick={handleRegistrationSkip}
                className="block w-full text-gray-500 text-sm hover:text-gray-700 transition-colors mt-4"
              >
                {attempt <= 2 ? 'Continuar sin registro' :
                 attempt <= 5 ? 'Continuar perdiendo progreso' :
                 'Perder todo y continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}