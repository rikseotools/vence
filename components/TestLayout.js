// components/TestLayout.js - FIX COMPLETO ANTI-DUPLICADOS
'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import PersistentRegistrationManager from './PersistentRegistrationManager'
import { usePathname } from 'next/navigation'
import QuestionEvolution from './QuestionEvolution'
import QuestionDispute from './QuestionDispute'


// Imports modularizados
import { 
  getDeviceInfo, 
  createUserSession, 
  createDetailedTestSession, 
  updateTestScore 
} from '../utils/testSession.js'
import { 
  saveDetailedAnswer, 
  calculateConfidence, 
  createDetailedAnswer 
} from '../utils/testAnswers.js'
import { 
  completeDetailedTest, 
  formatTime 
} from '../utils/testAnalytics.js'
import { testTracker } from '../utils/testTracking.js'
import { useTestCompletion } from '../hooks/useTestCompletion'

export default function TestLayout({
  tema,
  testNumber,
  config,
  questions,
  children
}) {
  const { user, loading: authLoading, supabase } = useAuth()
  const { notifyTestCompletion } = useTestCompletion()

  // Estados del test básicos
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState([])
  const [startTime, setStartTime] = useState(Date.now())
  
  // Estado del modo adaptativo
  const [isAdaptiveMode, setIsAdaptiveMode] = useState(false)
  
  // Estados de tracking avanzado
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [firstInteractionTime, setFirstInteractionTime] = useState(null)
  const [interactionCount, setInteractionCount] = useState(0)
  const [confidenceLevel, setConfidenceLevel] = useState(null)
  const [detailedAnswers, setDetailedAnswers] = useState([])
  
  // Estados de sesión - SIMPLIFICADOS
  const [currentTestSession, setCurrentTestSession] = useState(null)
  const [userSession, setUserSession] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null)
  
  // Control explícito de finalización
  const [isExplicitlyCompleted, setIsExplicitlyCompleted] = useState(false)
  
  // Estado para notificación de guardado exitoso
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  
  // Estados para hot articles
  const [hotArticleInfo, setHotArticleInfo] = useState(null)
  const [showHotAlert, setShowHotAlert] = useState(false)
  
  // 🧠 Estados para modo adaptativo
  const [adaptiveMode, setAdaptiveMode] = useState(false)
  const [activeQuestions, setActiveQuestions] = useState([])
  const [questionPool, setQuestionPool] = useState([])
  const [currentDifficulty, setCurrentDifficulty] = useState('medium')
  const [showCuriosityDetails, setShowCuriosityDetails] = useState(false)
  const [currentQuestionUuid, setCurrentQuestionUuid] = useState(null)

  // Estados anti-duplicados
  const [processingAnswer, setProcessingAnswer] = useState(false)
  const [lastProcessedAnswer, setLastProcessedAnswer] = useState(null)

  // Refs para tracking y control
  const pageLoadTime = useRef(Date.now())
  const explanationRef = useRef(null)
  const questionHeaderRef = useRef(null)
  const sessionCreationRef = useRef(new Set())
  const registrationProcessingRef = useRef(new Set())

  // Hook para obtener la URL actual
  const pathname = usePathname()
  
  // Detectar si estamos en /test-oposiciones/ para desactivar modal de registro
  const isTestOposicionesSection = pathname?.startsWith('/test-oposiciones/')

  // ✅ MOVER CÁLCULO DE ESTADOS DERIVADOS DESPUÉS DE DECLARACIONES
  // Estados calculados - MOVIDO AQUÍ PARA EVITAR ERRORES DE ORDEN  
  const effectiveQuestions = adaptiveMode ? activeQuestions : questions
  const isTestCompleted = isExplicitlyCompleted || (currentQuestion === effectiveQuestions?.length - 1 && showResult)
  const currentQ = effectiveQuestions?.[currentQuestion]

  // Validación de props al inicio
  useEffect(() => {

    if (!questions || questions.length === 0) {
      console.error('❌ TestLayout: No hay preguntas disponibles')
      return
    }

    // ✅ CORRECCIÓN: Validar tema puede ser 0 (válido para artículos dirigidos)
    if (tema === null || tema === undefined || !testNumber || !config) {
      console.error('❌ TestLayout: Props obligatorias faltantes:', { tema, testNumber, config })
      return
    }

    // 🧠 Inicializar modo adaptativo si detectado
    if (questions.isAdaptive) {
      console.log('🧠 Modo adaptativo disponible (pool cargado)')
      setAdaptiveMode(true)
      setIsAdaptiveMode(false) // 🔥 NO MOSTRAR INDICADOR AL INICIO
      setActiveQuestions(questions.activeQuestions)
      setQuestionPool(questions.questionPool)
      setCurrentDifficulty('medium') // Empezar en nivel medio
      console.log('🧠 Pool cargado:', questions.questionPool.length, 'preguntas')
    } else {
      // Modo normal
      setAdaptiveMode(false)
      setIsAdaptiveMode(false)
      setActiveQuestions(questions)
      setQuestionPool([])
    }

  }, [tema, testNumber, config, questions])

  // 🧠 Detectar automáticamente si debe activarse el modo adaptativo
  useEffect(() => {
    if (!adaptiveMode && user && answeredQuestions.length >= 2) {
      // Calcular porcentaje de aciertos en TODO el test hasta ahora
      const correctAnswers = answeredQuestions.filter(q => q.correct).length
      const accuracy = correctAnswers / answeredQuestions.length
      
      // 🧠 SMART LOGIC: Activar indicador cuando detecta bajo rendimiento
      if (accuracy < 0.6 && !isAdaptiveMode && answeredQuestions.length >= 2) {
        console.log(`🧠 Detectado rendimiento bajo (${Math.round(accuracy * 100)}%), ACTIVANDO indicador adaptativo`)
        setIsAdaptiveMode(true) // 🔥 MOSTRAR: Necesita adaptación
        
        // Mostrar mensaje temporal
        setSuccessMessage(`✨ Adaptando las preguntas a tu nivel (${Math.round(accuracy * 100)}% aciertos)`)
        setShowSuccessMessage(true)
        setTimeout(() => setShowSuccessMessage(false), 4000)
      } else if (accuracy >= 0.65 && isAdaptiveMode && answeredQuestions.length >= 3) {
        // 🎯 OCULTAR: Si accuracy mejora significativamente
        console.log(`🎯 Accuracy mejorada a ${Math.round(accuracy * 100)}%, ocultando indicador adaptativo`)
        setIsAdaptiveMode(false) // 🔥 OCULTAR: Ya no necesita adaptación
      }
    }
  }, [answeredQuestions, adaptiveMode, user, isAdaptiveMode])

  // Guardar respuestas previas al registrarse
  const savePreviousAnswersOnRegistration = async (userId, previousAnswers) => {
    try {
      
      if (previousAnswers.length === 0) {
        return true
      }
      
      // Protección: Verificar que no haya sesión de test ya creada
      if (currentTestSession) {
        console.log('⚠️ Ya existe sesión de test, cancelando guardado de respuestas previas')
        return true
      }
      
      // Protección: Crear sesión SOLO UNA VEZ
      const sessionKey = `${userId}-${tema}-${testNumber}-${startTime}`
      
      if (sessionCreationRef.current.has(sessionKey)) {
        console.log('🚫 SESIÓN YA EN CREACIÓN:', sessionKey)
        return false
      }
      
      sessionCreationRef.current.add(sessionKey)
      
      try {
        // Crear sesión de test
        const session = await createDetailedTestSession(userId, tema, testNumber, questions, config, startTime, pageLoadTime.current)
        if (!session) {
          console.error('❌ No se pudo crear sesión para respuestas previas')
          return false
        }
        
        setCurrentTestSession(session)
        console.log('✅ Sesión de test creada para respuestas previas:', session.id)
        
        // Guardar todas las respuestas previas
        let savedCount = 0
        for (const answer of previousAnswers) {
          // Verificar que no sea una respuesta duplicada por tiempo
          const existingAnswer = previousAnswers.filter(a => 
            a.questionIndex === answer.questionIndex && 
            a.selectedAnswer === answer.selectedAnswer
          )
          
          if (existingAnswer.length > 1) {
            console.log('🚫 Respuesta duplicada detectada, omitiendo...')
            continue
          }
          
          const success = await saveDetailedAnswer(
            session.id, 
            answer.questionData, 
            answer, 
            tema, 
            answer.confidence, 
            answer.interactions, 
            questionStartTime, 
            firstInteractionTime, 
            testTracker.interactionEvents,
            testTracker.mouseEvents,
            testTracker.scrollEvents
          )
          if (success && success.action !== 'prevented_duplicate') {
            savedCount++
          }
        }
        
        // Actualizar puntuación
        await updateTestScore(session.id, score)
        
        console.log(`✅ Guardadas ${savedCount}/${previousAnswers.length} respuestas previas únicas`)
        
        // Mostrar notificación de éxito
        if (savedCount > 0) {
          setSuccessMessage(`¡Tu progreso anterior (${savedCount} respuestas) ha sido guardado!`)
          setShowSuccessMessage(true)
          
          // Auto-ocultar después de 5 segundos
          setTimeout(() => {
            setShowSuccessMessage(false)
          }, 5000)
        }
        
        return true
        
      } finally {
        sessionCreationRef.current.delete(sessionKey)
      }
      
    } catch (error) {
      console.error('❌ Error guardando respuestas previas:', error)
      return false
    }
  }

  // Función para verificar artículos hot
  const checkHotArticle = async (articleId, userId, isOfficialExam = false) => {
    if (!articleId || !userId) return
    
    try {
      
      const { data, error } = await supabase.rpc('check_hot_article_for_current_user', {
        article_id_param: articleId,
        user_id_param: userId
      })
      
      if (error) {
        console.error('Error verificando artículo:', error)
        return
      }
      
      console.log('🔥 Resultado check hot article:', data)
      
      if (data && data.length > 0 && data[0].is_hot) {
        const hotData = data[0]
        console.log('🔥 [DEBUG] Datos del hot article:', hotData)
        console.log('🔥 [DEBUG] isOfficialExam:', isOfficialExam)
        console.log('🔥 [DEBUG] Estados ANTES:', { showHotAlert, hotArticleInfo })
        
        // Diferentes notificaciones según tipo
        if (isOfficialExam) {
          // Pregunta oficial
          setHotArticleInfo({
            ...hotData,
            type: 'official_question',
            hot_message: `🏛️ PREGUNTA DE EXAMEN OFICIAL\n${hotData.hot_message}`,
            display_title: '¡Esta pregunta apareció en un examen oficial!'
          })
        } else {
          // Artículo hot
          setHotArticleInfo({
            ...hotData,
            type: 'hot_article',
            display_title: '¡Artículo súper importante para memorizar!'
          })
        }
        
        setShowHotAlert(true)
        setShowCuriosityDetails(false)
      }
      
    } catch (error) {
      console.error('Error en checkHotArticle:', error)
    }
  }

  // Función para hacer scroll suave al resultado
  const scrollToResult = () => {
    setTimeout(() => {
      if (explanationRef.current) {
        const element = explanationRef.current
        const offsetTop = element.offsetTop - 100
        window.scrollTo({ 
          top: offsetTop, 
          behavior: 'smooth' 
        })
      }
    }, 150)
  }

  // Manejar respuesta con protección anti-duplicados
  const handleAnswerClick = async (answerIndex) => {
    if (showResult || processingAnswer) return
    
    console.log('🎯 Respuesta seleccionada:', answerIndex)
    
    if (!effectiveQuestions || !effectiveQuestions[currentQuestion]) {
      console.error('❌ No hay pregunta actual disponible')
      return
    }

    const currentQ = effectiveQuestions[currentQuestion]
    
    // Crear clave única para esta respuesta específica
    const answerKey = `${currentQuestion}-${answerIndex}-${Date.now()}`
    
    // Verificar si ya procesamos esta respuesta
    if (lastProcessedAnswer === answerKey) {
      console.log('🚫 RESPUESTA YA PROCESADA:', answerKey)
      return
    }
    
    // Marcar como en proceso
    setProcessingAnswer(true)
    setLastProcessedAnswer(answerKey)
    
    console.log('🔒 PROCESANDO RESPUESTA ÚNICA:', answerKey)

    if (!firstInteractionTime) {
      setFirstInteractionTime(Date.now())
      testTracker.trackInteraction('first_answer_click', { selected_option: answerIndex }, currentQuestion)
    } else {
      testTracker.trackInteraction('answer_change', { 
        from_option: selectedAnswer, 
        to_option: answerIndex 
      }, currentQuestion)
    }
    
    setSelectedAnswer(answerIndex)
    setInteractionCount(prev => prev + 1)
    
    const timeToDecide = Date.now() - questionStartTime
    const newConfidence = calculateConfidence(timeToDecide, interactionCount)
    setConfidenceLevel(newConfidence)
    
    setTimeout(async () => {
      try {
        setShowResult(true)
        scrollToResult()
        
        const isCorrect = answerIndex === currentQ.correct
        const newScore = isCorrect ? score + 1 : score
        const timeSpent = Math.round((Date.now() - questionStartTime) / 1000)
        
        if (isCorrect) {
          setScore(newScore)
          testTracker.trackInteraction('answer_correct', { 
            time_spent: timeSpent,
            confidence: newConfidence 
          }, currentQuestion)
        } else {
          testTracker.trackInteraction('answer_incorrect', { 
            time_spent: timeSpent,
            confidence: newConfidence,
            correct_answer: currentQ.correct
          }, currentQuestion)
        }
        
        const detailedAnswer = createDetailedAnswer(
          currentQuestion, 
          answerIndex, 
          currentQ.correct, 
          isCorrect, 
          timeSpent, 
          currentQ, 
          newConfidence, 
          interactionCount
        )
        
        const newAnsweredQuestions = [...answeredQuestions, {
          question: currentQuestion,
          selectedAnswer: answerIndex,
          correct: isCorrect,
          timestamp: new Date().toISOString()
        }]
        
        const newDetailedAnswers = [...detailedAnswers, detailedAnswer]
        
        setAnsweredQuestions(newAnsweredQuestions)
        setDetailedAnswers(newDetailedAnswers)
        
        // 🧠 Lógica adaptativa: evaluar % de aciertos
        if (adaptiveMode) {
          // Calcular % de aciertos actual
          const totalAnswered = newAnsweredQuestions.length
          const totalCorrect = newAnsweredQuestions.filter(q => q.correct).length
          const currentAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 100
          
          console.log(`🧠 Accuracy actual: ${currentAccuracy.toFixed(1)}% (${totalCorrect}/${totalAnswered})`)
          
          // 🧠 SMART LOGIC: Mostrar indicador solo cuando está adaptando activamente
          if (currentAccuracy < 60 && totalAnswered >= 3) { // Mínimo 3 respuestas para evaluar
            console.log('🧠 Accuracy < 60%, adaptando a preguntas más fáciles...')
            setIsAdaptiveMode(true) // 🔥 MOSTRAR: Se está adaptando
            adaptDifficulty('easier')
          } else if (currentAccuracy > 70 && totalAnswered >= 5) { // Mínimo 5 respuestas
            console.log('🧠 Accuracy > 70%, volviendo a dificultad normal...')
            setIsAdaptiveMode(true) // 🔥 MOSTRAR: Se está adaptando
            adaptDifficulty('harder')
          } else if (currentAccuracy >= 65 && totalAnswered >= 3 && isAdaptiveMode) {
            // 🎯 OCULTAR: Si accuracy se estabiliza en buen nivel (65%+)
            console.log(`🎯 Accuracy estable en ${currentAccuracy.toFixed(1)}%, ocultando indicador adaptativo`)
            setIsAdaptiveMode(false) // 🔥 OCULTAR: Ya no necesita adaptación
          }
        }
        
        // Guardado con protección mejorada
        if (user) {
          
          let session = currentTestSession
          
          // Proteger creación de sesión con ref
          if (!session) {
            const sessionKey = `${user.id}-${tema}-${testNumber}`
            
            if (sessionCreationRef.current.has(sessionKey)) {
              console.log('🚫 SESIÓN YA EN CREACIÓN, ESPERANDO...', sessionKey)
              // Esperar a que termine la creación existente
              let attempts = 0
              while (!currentTestSession && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 100))
                attempts++
              }
              session = currentTestSession
            } else {
              console.log('🔄 Creando nueva sesión PROTEGIDA...')
              sessionCreationRef.current.add(sessionKey)
              
              try {
                session = await createDetailedTestSession(user.id, tema, testNumber, effectiveQuestions, config, startTime, pageLoadTime.current)
                if (session) {
                  setCurrentTestSession(session)
                  console.log('✅ Nueva sesión PROTEGIDA creada:', session.id)
                }
              } finally {
                sessionCreationRef.current.delete(sessionKey)
              }
            }
          }
          
          if (session) {
            console.log('💾 Guardando respuesta ÚNICA en sesión:', session.id)
            const saveSuccess = await saveDetailedAnswer(
              session.id, 
              currentQ, 
              detailedAnswer, 
              tema, 
              newConfidence, 
              interactionCount, 
              questionStartTime, 
              firstInteractionTime, 
              testTracker.interactionEvents,
              testTracker.mouseEvents,
              testTracker.scrollEvents
            )
            if (saveSuccess && saveSuccess.question_id) {
              setCurrentQuestionUuid(saveSuccess.question_id)
              // Guardar en localStorage para detección de feedback
              try {
                localStorage.setItem('currentQuestionId', saveSuccess.question_id)
              } catch (e) {
                console.warn('⚠️ No se pudo guardar question_id en localStorage:', e)
              }
              await updateTestScore(session.id, newScore)
              console.log('✅ Respuesta ÚNICA guardada y puntuación actualizada')
            } else {
              console.error('❌ Error guardando respuesta')
            }
          } else {
            console.error('❌ No se pudo crear/obtener sesión de test')
          }
          
          if (!userSession) {
            console.log('🔄 Creando sesión de usuario...')
            const newUserSession = await createUserSession(user.id)
            if (newUserSession) {
              setUserSession(newUserSession)
            }
          }
        } else {
          console.log('👤 Usuario no autenticado, guardado omitido')
        }
        
        // Lógica de finalización existente...
        if (currentQuestion === effectiveQuestions.length - 1) {
          console.log('🏁 Última pregunta completada')
          setIsExplicitlyCompleted(true)
          
          if (user && currentTestSession) {
            setSaveStatus('saving')
            console.log('💾 Completando test final...')
            const result = await completeDetailedTest(
              currentTestSession.id, 
              newScore, 
              newDetailedAnswers, 
              questions, 
              startTime, 
              testTracker.interactionEvents, 
              userSession
            )
            setSaveStatus(result.status)
            console.log('✅ Test completado en BD:', result.status)
            
            // 🔓 NOTIFICAR COMPLETION PARA SISTEMA DE DESBLOQUEO
            if (result.status === 'success' && tema && typeof tema === 'number') {
              const accuracy = Math.round((newScore / effectiveQuestions.length) * 100)
              console.log(`🔄 Notificando completion para desbloqueo: Tema ${tema}, ${accuracy}% accuracy`)
              
              try {
                await notifyTestCompletion(tema, accuracy, effectiveQuestions.length)
                console.log('✅ Sistema de desbloqueo notificado correctamente')
              } catch (unlockError) {
                console.error('❌ Error notificando sistema de desbloqueo:', unlockError)
              }
            }
          }
        }

        if (currentQuestion >= effectiveQuestions.length - 1) {
          console.log('🚨 FORZANDO FINALIZACIÓN - Detectado índice fuera de rango')
          setIsExplicitlyCompleted(true)
        }

        // Hot article check
        if (user && currentQ.primary_article_id) {
          await checkHotArticle(currentQ.primary_article_id, user.id, currentQ.is_official_exam || currentQ.metadata?.is_official_exam)


        }
        
      } catch (error) {
        console.error('❌ Error en flujo de respuesta:', error)
      } finally {
        // Liberar el lock después de 1 segundo
        setTimeout(() => {
          setProcessingAnswer(false)
          console.log('🔓 RESPUESTA PROCESADA, LIBERANDO LOCK')
        }, 1000)
      }
    }, 200)
  }

  // Navegación a siguiente pregunta con scroll específico
  const handleNextQuestion = () => {
    // Prevenir navegación si ya está completado
    if (isExplicitlyCompleted) {
      console.warn('⚠️ Test ya completado, ignorando navegación')
      return
    }
    
    if (currentQuestion < effectiveQuestions.length - 1) {
      testTracker.trackInteraction('next_question', { 
        completed_question: currentQuestion + 1,
        was_correct: selectedAnswer === effectiveQuestions[currentQuestion].correct
      }, currentQuestion)
      
      console.log('📍 Navegando a pregunta:', currentQuestion + 2, '/', effectiveQuestions.length)
      
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setQuestionStartTime(Date.now())
      setFirstInteractionTime(null)
      setInteractionCount(0)
      setConfidenceLevel(null)
      setCurrentQuestionUuid(null) 
      
      // Limpiar localStorage al cambiar de pregunta
      try {
        localStorage.removeItem('currentQuestionId')
      } catch (e) {
        console.warn('⚠️ No se pudo limpiar question_id de localStorage:', e)
      }
      
      // Ocultar alerta hot al cambiar de pregunta
      setShowHotAlert(false)
      setHotArticleInfo(null)
      setShowCuriosityDetails(false)
      
      // Scroll específico al header de la nueva pregunta
      setTimeout(() => {
        if (questionHeaderRef.current) {
          const headerTop = questionHeaderRef.current.offsetTop - 100
          window.scrollTo({ 
            top: headerTop, 
            behavior: 'smooth' 
          })
        }
      }, 150)
    } else {
      console.warn('⚠️ Intentando navegar más allá de la última pregunta')
      setIsExplicitlyCompleted(true)
    }
  }

  // Función para calcular estadísticas compactas
  const calculateCompactStats = () => {
    const totalTime = Math.floor((Date.now() - startTime) / 1000)
    const avgTimePerQuestion = Math.round(totalTime / effectiveQuestions.length)
    const percentage = Math.round((score / effectiveQuestions.length) * 100)
    
    // Tiempo por pregunta
    const timeStats = detailedAnswers.map(a => a.timeSpent || 0)
    const fastestTime = timeStats.length > 0 ? Math.min(...timeStats) : 0
    const slowestTime = timeStats.length > 0 ? Math.max(...timeStats) : 0
    
    // Análisis de confianza
    const confidenceStats = detailedAnswers.reduce((acc, answer) => {
      const conf = answer.confidence || 'unknown'
      acc[conf] = (acc[conf] || 0) + 1
      return acc
    }, {})
    
    // Racha de aciertos/fallos
    let currentStreak = 0
    let maxCorrectStreak = 0
    let maxIncorrectStreak = 0
    let tempIncorrectStreak = 0
    
    detailedAnswers.forEach(answer => {
      if (answer.isCorrect) {
        currentStreak++
        maxCorrectStreak = Math.max(maxCorrectStreak, currentStreak)
        tempIncorrectStreak = 0
      } else {
        tempIncorrectStreak++
        maxIncorrectStreak = Math.max(maxIncorrectStreak, tempIncorrectStreak)
        currentStreak = 0
      }
    })
    
    return {
      percentage,
      totalTime,
      avgTimePerQuestion,
      fastestTime,
      slowestTime,
      confidenceStats,
      maxCorrectStreak,
      maxIncorrectStreak,
      efficiency: avgTimePerQuestion <= 60 ? 'Alta' : avgTimePerQuestion <= 120 ? 'Media' : 'Baja'
    }
  }

  // Función para formatear tiempo
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs}s`
    if (secs === 0) return `${mins}m`
    return `${mins}m ${secs}s`
  }

  // ✅ ESCUCHAR CAMBIOS DE USUARIO CON PROTECCIÓN MEJORADA
  useEffect(() => {
    if (!user || authLoading) return

    // Protección global: Evitar ejecución múltiple
    const userRegistrationKey = `registration-${user.id}-${tema}-${testNumber}`
    
    if (registrationProcessingRef.current.has(userRegistrationKey)) {
      console.log('🚫 REGISTRO YA EN PROCESO PARA:', userRegistrationKey)
      return
    }
    
    // Marcar como en proceso
    registrationProcessingRef.current.add(userRegistrationKey)

    // Cleanup function para limpiar flags
    const cleanup = () => {
      registrationProcessingRef.current.delete(userRegistrationKey)
    }

    // Lógica simplificada: Solo crear sesión de usuario si no existe
    const handleUserRegistration = async () => {
      try {
        
        // Si ya hay sesión de test, no hacer nada más
        if (currentTestSession) {
          console.log('✅ Ya hay sesión de test, no se requiere acción')
          cleanup()
          return
        }
        
        // Si hay respuestas detalladas pero no sesión de test = usuario se registró durante test
        if (detailedAnswers.length > 0) {
          console.log('🎉 Usuario se registró durante el test, guardando respuestas previas...')
          const success = await savePreviousAnswersOnRegistration(user.id, detailedAnswers)
          if (success) {
            console.log('✅ Respuestas previas guardadas correctamente')
          }
        }
        
        // Crear sesión de usuario si no existe
        if (!userSession) {
          console.log('🔄 Creando sesión de usuario...')
          const newUserSession = await createUserSession(user.id)
          if (newUserSession) {
            setUserSession(newUserSession)
            console.log('✅ Sesión de usuario creada')
          }
        }
        
      } catch (error) {
        console.error('❌ Error en handleUserRegistration:', error)
      } finally {
        cleanup()
      }
    }

    // Ejecutar con delay para evitar race conditions
    const timeoutId = setTimeout(handleUserRegistration, 100)

    // Cleanup al desmontar
    return () => {
      clearTimeout(timeoutId)
      cleanup()
    }
  }, [user, authLoading])

  // Tracking de eventos del navegador
  useEffect(() => {
    const cleanup = testTracker.setupBrowserTracking(currentQuestion, (type, details) => {
      testTracker.trackInteraction(type, details, currentQuestion)
    })

    return cleanup
  }, [currentQuestion])

  // 🧠 Función para adaptar dificultad dinámicamente basada en accuracy
  const adaptDifficulty = (direction = 'easier') => {
    try {
      const remainingQuestions = effectiveQuestions.length - currentQuestion - 1
      if (remainingQuestions <= 0) {
        console.log('🧠 No hay preguntas restantes para adaptar')
        return
      }
      
      // Determinar nueva dificultad según dirección
      let newDifficulty = currentDifficulty
      if (direction === 'easier') {
        if (currentDifficulty === 'hard') newDifficulty = 'medium'
        else if (currentDifficulty === 'medium') newDifficulty = 'easy'
        // Si ya está en 'easy', mantener 'easy'
      } else if (direction === 'harder') {
        if (currentDifficulty === 'easy') newDifficulty = 'medium'
        else if (currentDifficulty === 'medium') newDifficulty = 'hard'
        // Si ya está en 'hard', mantener 'hard'
      }
      
      // Solo cambiar si hay diferencia
      if (newDifficulty === currentDifficulty) {
        console.log(`🧠 Ya está en ${currentDifficulty}, no se puede ${direction === 'easier' ? 'bajar' : 'subir'} más`)
        return
      }
      
      console.log(`🧠 Adaptando dificultad: ${currentDifficulty} → ${newDifficulty} (${direction})`)
      
      // Buscar preguntas de la nueva dificultad en el pool
      const targetQuestions = questionPool.filter(q => 
        q.metadata?.difficulty === newDifficulty
      )
      
      if (targetQuestions.length === 0) {
        console.log(`🧠 No hay preguntas de dificultad ${newDifficulty} disponibles`)
        return
      }
      
      // Construir nuevo array: preguntas ya respondidas + preguntas adaptadas
      const questionsAnswered = effectiveQuestions.slice(0, currentQuestion + 1)
      const questionsToReplace = Math.min(remainingQuestions, targetQuestions.length)
      const questionsToUse = targetQuestions.slice(0, questionsToReplace)
      
      const newActiveQuestions = [
        ...questionsAnswered,
        ...questionsToUse
      ]
      
      // Si no tenemos suficientes preguntas del nivel objetivo, completar con las originales restantes
      if (newActiveQuestions.length < effectiveQuestions.length) {
        const originalRemaining = effectiveQuestions.slice(
          questionsAnswered.length + questionsToUse.length
        )
        newActiveQuestions.push(...originalRemaining)
      }
      
      setActiveQuestions(newActiveQuestions)
      setCurrentDifficulty(newDifficulty)
      
      console.log(`🧠 Adaptación completada: ${questionsToUse.length} preguntas cambiadas a ${newDifficulty}`)
      
    } catch (error) {
      console.error('❌ Error en adaptación de dificultad:', error)
    }
  }

  // Verificación de datos antes de renderizar
  if (!questions || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">⚠️</span>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Sin Preguntas Disponibles</h2>
          <p className="text-gray-600 dark:text-gray-400">TestLayout no recibió preguntas válidas para mostrar.</p>
        </div>
      </div>
    )
  }

  // ✅ CORRECCIÓN: Validar tema puede ser 0 (válido para artículos dirigidos)
  if (tema === null || tema === undefined || !testNumber || !config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">⚙️</span>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Configuración Incompleta</h2>
          <p className="text-gray-600 dark:text-gray-400">TestLayout requiere tema, testNumber y config válidos.</p>
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            <p>tema: {tema}, testNumber: {testNumber}, config: {config ? 'OK' : 'MISSING'}</p>
          </div>
        </div>
      </div>
    )
  }

  // Componente de notificación hot article
  const HotArticleNotification = () => {

    if (!showHotAlert || !hotArticleInfo) return null

    // Diferentes estilos según tipo
    const isOfficialQuestion = hotArticleInfo.type === 'official_question'
    const bgColor = isOfficialQuestion 
      ? 'from-purple-600 to-blue-600 dark:from-purple-700 dark:to-blue-700'
      : 'from-orange-500 to-red-500 dark:from-orange-600 dark:to-red-600'

    return (
      <div className={`mb-6 bg-gradient-to-r ${bgColor} text-white p-4 rounded-lg shadow-lg`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Título principal según tipo */}
            <div className="font-bold mb-2 text-lg">
              {hotArticleInfo.display_title}
            </div>
            
            {/* Mensaje específico */}
            <div className="mb-2 text-sm opacity-90 whitespace-pre-line">
              {hotArticleInfo.hot_message}
            </div>
            
            {/* Botón expandible para curiosidad */}
            {hotArticleInfo.also_appears_in_other_oposiciones && hotArticleInfo.curiosity_message && (
              <div className="mt-3">
                <button 
                  onClick={() => setShowCuriosityDetails(!showCuriosityDetails)}
                  className="text-sm underline opacity-90 hover:opacity-100 transition-opacity flex items-center space-x-2"
                >
                  <span>{showCuriosityDetails ? '🔼' : '🔽'}</span>
                  <span>{showCuriosityDetails ? 'Ocultar curiosidad' : 'Ver en qué otras oposiciones aparece'}</span>
                </button>
                
                {/* Contenido expandible */}
                {showCuriosityDetails && (
                 <div className="mt-3 p-3 bg-black/20 dark:bg-black/40 rounded-lg text-sm">
                    <div className="opacity-95">
                      {hotArticleInfo.curiosity_message}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Botón cerrar */}
          <button 
            onClick={() => setShowHotAlert(false)}
            className="text-white hover:text-gray-200 dark:hover:text-gray-300 text-xl font-bold ml-4 opacity-90 hover:opacity-100"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <PersistentRegistrationManager
      tema={tema}
      testNumber={testNumber}
      currentQuestion={currentQuestion}
      totalQuestions={effectiveQuestions.length}
      answeredQuestions={answeredQuestions}
      showResult={showResult}
      score={score}
      startTime={startTime}
      isTestCompleted={isTestCompleted}
      enabled={!isTestOposicionesSection} 
    >
      {/* Fondo con dark mode */}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            
            {/* Banner de éxito con dark mode */}
            {showSuccessMessage && (
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 dark:from-green-600 dark:to-emerald-600 text-white p-4 rounded-lg mb-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <div className="font-bold">¡Progreso Guardado!</div>
                    <div className="text-sm opacity-90">{successMessage}</div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSuccessMessage(false)}
                  className="text-white hover:text-gray-200 dark:hover:text-gray-300 text-xl font-bold"
                >
                  ×
                </button>
              </div>
            )}

            {/* Header del test con dark mode */}
            <div className="text-center mb-8">
              <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-white text-sm font-semibold bg-gradient-to-r ${config.color} mb-4 shadow-lg`}>
                <span>{config.icon}</span>
                <span>{config.name}{config.description ? `: ${config.description}` : ''}</span>
                {user && currentTestSession && <span className="ml-2">💾</span>}
              </div>
              <p className="text-gray-600 dark:text-gray-400">{config.subtitle}</p>
            </div>

            {/* Barra de progreso con dark mode */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Pregunta {currentQuestion + 1} de {effectiveQuestions.length}
                  {user && currentTestSession && (
                    <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                      ✅ Guardado completo
                    </span>
                  )}
                  {/* ✨ Indicador de modo adaptativo */}
                  {isAdaptiveMode && (
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full animate-pulse">
                      ✨ Adaptándose a tu nivel
                    </span>
                  )}
                </span>
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {Math.round(((currentQuestion + (showResult ? 1 : 0)) / effectiveQuestions.length) * 100)}%
                  </span>
                  {!isTestCompleted && (
                    <button
                      onClick={() => {
                        if (config.customNavigationLinks?.backToLaw) {
                          window.location.href = config.customNavigationLinks.backToLaw.href
                        } else {
                          window.location.href = config.isLawTest ? '/leyes' : '/auxiliar-administrativo-estado/test'
                        }
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1"
                    >
                      <span>←</span>
                      <span>{config.customNavigationLinks?.backToLaw?.text || 'Volver a Tests'}</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className={`bg-gradient-to-r ${config.color} h-3 rounded-full transition-all duration-500`}
                  style={{ width: `${((currentQuestion + (showResult ? 1 : 0)) / effectiveQuestions.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Contenido principal con dark mode */}
            <div 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-gray-900/20 p-8 mb-8 border border-gray-100 dark:border-gray-700"
              data-question-id={currentQuestionUuid || questions[currentQuestion]?.id}
            >
              
              {/* Pregunta actual con dark mode */}
              <div className="mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 
                      ref={questionHeaderRef}
                      className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2"
                    >
                      Pregunta {currentQuestion + 1}
                    </h2>
                    {currentQ?.article && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        📚 {currentQ.article.display_number} - {currentQ.article.title}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="prose max-w-none dark:prose-invert">
                  <p className="text-lg text-gray-800 dark:text-gray-200 leading-relaxed">
                    {currentQ?.question}
                  </p>
                </div>
              </div>

              {/* Opciones de respuesta con dark mode */}
              <div className="space-y-3 mb-6">
                {currentQ?.options?.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => !showResult && handleAnswerClick(index)}
                    disabled={showResult}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                      showResult
                        ? index === currentQ.correct
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : index === selectedAnswer && selectedAnswer !== currentQ.correct
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        : selectedAnswer === index
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-800 dark:text-gray-200'
                    } ${!showResult ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center">
                      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold mr-3 ${
                        showResult
                          ? index === currentQ.correct
                            ? 'border-green-500 bg-green-500 text-white'
                            : index === selectedAnswer && selectedAnswer !== currentQ.correct
                            ? 'border-red-500 bg-red-500 text-white'
                            : 'border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400'
                          : selectedAnswer === index
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-400'
                      }`}>
                        {String.fromCharCode(65 + index)}
                      </span>
                      {option}
                    </span>
                    
                    {showResult && (
                      <span className="float-right">
                        {index === currentQ.correct ? (
                          <span className="text-green-600 dark:text-green-400">✅</span>
                        ) : index === selectedAnswer && selectedAnswer !== currentQ.correct ? (
                          <span className="text-red-600 dark:text-red-400">❌</span>
                        ) : null}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Botones de respuesta rápida A/B/C/D - Solo si no se ha respondido */}
              {!showResult && currentQ?.options && (
                <div className="mb-6">
                  <div className="flex justify-center space-x-4">
                    {currentQ.options.map((option, index) => (
                      <button
                        key={`quick-${index}`}
                        onClick={() => handleAnswerClick(index)}
                        className={`w-14 h-14 rounded-lg border-2 font-bold text-lg transition-all duration-200 ${
                          selectedAnswer === index
                            ? 'border-blue-600 bg-blue-600 text-white shadow-lg transform scale-110'
                            : 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800/30 text-blue-700 dark:text-blue-300 hover:shadow-lg'
                        }`}
                      >
                        {String.fromCharCode(65 + index)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Resultado y explicación con dark mode */}
              {showResult && (
                <div>
                  {/* Ref aquí - justo donde terminan las preguntas */}
                  <div ref={explanationRef}></div>
                  
                  <div className="border-t dark:border-gray-600 pt-6">
                    <div className={`p-4 rounded-lg mb-4 ${
                      selectedAnswer === currentQ.correct 
                        ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700' 
                        : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700'
                    }`}>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-2xl">
                          {selectedAnswer === currentQ.correct ? '🎉' : '😔'}
                        </span>
                        <span className={`font-bold ${
                          selectedAnswer === currentQ.correct 
                            ? 'text-green-800 dark:text-green-300' 
                            : 'text-red-800 dark:text-red-300'
                        }`}>
                          {selectedAnswer === currentQ.correct ? '¡Correcto!' : 'Incorrecto'}
                        </span>
                      </div>
                      <p className={`text-sm ${
                        selectedAnswer === currentQ.correct 
                          ? 'text-green-700 dark:text-green-400' 
                          : 'text-red-700 dark:text-red-400'
                      }`}>
                        La respuesta correcta es: <strong>{String.fromCharCode(65 + currentQ.correct)}</strong>
                      </p>
                    </div>

                    

                    {/* Explicación con dark mode */}
                    {currentQ?.explanation && (
                      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">📖 Explicación:</h4>
                        <p className="text-blue-700 dark:text-blue-400 text-sm leading-relaxed">
                          {currentQ.explanation}
                        </p>
                      </div>
                    )}

                    {/* Información de procedencia oficial */}
                      {currentQ?.metadata?.is_official_exam && (
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 mb-4">
                          <div className="flex items-start space-x-3">
                            <div className="text-2xl">🏛️</div>
                            <div className="flex-1">
                              <h4 className="font-bold text-purple-800 dark:text-purple-300 mb-2">
                                Pregunta de Examen Oficial Real
                              </h4>
                              <div className="space-y-1 text-sm text-purple-700 dark:text-purple-400">
                                {currentQ.metadata.exam_source && (
                                  <div className="flex items-center space-x-2">
                                    <span>📋</span>
                                    <span><strong>Examen:</strong> {currentQ.metadata.exam_source}</span>
                                  </div>
                                )}
                                {currentQ.metadata.exam_date && (
                                  <div className="flex items-center space-x-2">
                                    <span>📅</span>
                                    <span><strong>Año:</strong> {new Date(currentQ.metadata.exam_date).getFullYear()}</span>
                                  </div>
                                )}
                                {currentQ.metadata.exam_entity && (
                                  <div className="flex items-center space-x-2">
                                    <span>🏢</span>
                                    <span><strong>Oposición:</strong> {currentQ.metadata.exam_entity}</span>
                                  </div>
                                )}
                                <div className="mt-3 p-2 bg-purple-100 dark:bg-purple-800/30 rounded text-xs text-purple-800 dark:text-purple-300">
                                  <strong>💡 Valor especial:</strong> Esta pregunta apareció textualmente en un examen oficial. 
                                  Dominar este tipo de preguntas es crucial para tu preparación.
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 🆕 ADEMÁS - Para artículos que aparecen en exámenes (aunque esta pregunta específica no sea oficial) */}
                      {!currentQ?.metadata?.is_official_exam && currentQ?.primary_article_id && hotArticleInfo?.total_official_appearances > 0 && (
                        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4 mb-4">
                          <div className="flex items-start space-x-3">
                            <div className="text-2xl">🔥</div>
                            <div className="flex-1">
                              <h4 className="font-bold text-orange-800 dark:text-orange-300 mb-2">
                                Artículo Muy Importante para Exámenes
                              </h4>
                              <div className="space-y-1 text-sm text-orange-700 dark:text-orange-400">
                                <div className="flex items-center space-x-2">
                                  <span>📊</span>
                                  <span><strong>Apariciones en exámenes oficiales:</strong> {hotArticleInfo.total_official_appearances}</span>
                                </div>
                                {hotArticleInfo.unique_exams_count && (
                                  <div className="flex items-center space-x-2">
                                    <span>📋</span>
                                    <span><strong>Exámenes diferentes:</strong> {hotArticleInfo.unique_exams_count}</span>
                                  </div>
                                )}
                                {hotArticleInfo.last_appearance_date && (
                                  <div className="flex items-center space-x-2">
                                    <span>📅</span>
                                    <span><strong>Última aparición:</strong> {new Date(hotArticleInfo.last_appearance_date).getFullYear()}</span>
                                  </div>
                                )}
                                <div className="mt-3 p-2 bg-orange-100 dark:bg-orange-800/30 rounded text-xs text-orange-800 dark:text-orange-300">
                                  <strong>🎯 Recomendación:</strong> Este artículo ha aparecido múltiples veces en exámenes oficiales. 
                                  Asegúrate de dominarlo completamente.
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    {/*Componente de impugnación */}
                    <QuestionDispute 
                      questionId={currentQuestionUuid}
                      user={user} 
                      supabase={supabase} 
                    />

                    {/* Notificación de artículo hot */}
                    <HotArticleNotification />

                    {/* Sección de navegación y finalización actualizada */}
                      <div className="mb-6">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {confidenceLevel && (
                            <span>🎯 Confianza: {
                              confidenceLevel === 'very_sure' ? 'Muy seguro' :
                              confidenceLevel === 'sure' ? 'Seguro' :
                              confidenceLevel === 'unsure' ? 'Inseguro' :
                              'Adivinando'
                            }</span>
                          )}
                        </div>
                        
                        {/* Condición mejorada: Solo mostrar botón si NO es la última pregunta */}
                        {!isExplicitlyCompleted && currentQuestion < effectiveQuestions.length - 1 ? (
                          <button
                          onClick={handleNextQuestion}
                          className={`w-full px-6 py-4 rounded-lg font-semibold text-white transition-all bg-gradient-to-r ${config.color} hover:opacity-90 shadow-lg hover:shadow-xl text-lg`}
                        >
                          Siguiente Pregunta → ({currentQuestion + 2}/{effectiveQuestions.length})
                        </button>
                      ) : (
                        /* Pantalla de finalización con estadísticas compactas */
                        <div className="text-center w-full">

                          {/* Título de finalización */}
                          <div className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">
                            🏁 ¡Test Completado!
                          </div>
                          
                          {/* Puntuación destacada */}
                          <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                            {score}/{effectiveQuestions.length}
                          </div>
                          
                          {/* Porcentaje principal */}
                          <div className="text-xl text-gray-600 dark:text-gray-400 mb-4">
                            {Math.round((score / effectiveQuestions.length) * 100)}% de aciertos
                          </div>

                          {/* Estadísticas compactas y de valor */}
                          {(() => {
                            const stats = calculateCompactStats()
                            return (
                              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  {/* Tiempo total */}
                                  <div className="text-center">
                                    <div className="font-bold text-gray-800 dark:text-gray-200">⏱️</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Tiempo</div>
                                    <div className="font-semibold text-gray-700 dark:text-gray-300">
                                      {formatTime(stats.totalTime)}
                                    </div>
                                  </div>

                                  {/* Tiempo promedio */}
                                  <div className="text-center">
                                    <div className="font-bold text-gray-800 dark:text-gray-200">📊</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Promedio</div>
                                    <div className="font-semibold text-gray-700 dark:text-gray-300">
                                      {formatTime(stats.avgTimePerQuestion)}
                                    </div>
                                  </div>

                                  {/* Eficiencia */}
                                  <div className="text-center">
                                    <div className="font-bold text-gray-800 dark:text-gray-200">⚡</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Eficiencia</div>
                                    <div className={`font-semibold ${
                                      stats.efficiency === 'Alta' ? 'text-green-600 dark:text-green-400' :
                                      stats.efficiency === 'Media' ? 'text-yellow-600 dark:text-yellow-400' :
                                      'text-red-600 dark:text-red-400'
                                    }`}>
                                      {stats.efficiency}
                                    </div>
                                  </div>

                                  {/* Racha máxima */}
                                  <div className="text-center">
                                    <div className="font-bold text-gray-800 dark:text-gray-200">🔥</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Racha</div>
                                    <div className="font-semibold text-gray-700 dark:text-gray-300">
                                      {stats.maxCorrectStreak > 0 ? `${stats.maxCorrectStreak} ✅` : '0'}
                                    </div>
                                  </div>
                                </div>

                                {/* Detalles adicionales en una línea compacta */}
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 flex justify-center space-x-4">
                                  {stats.fastestTime > 0 && (
                                    <span>🚀 Más rápida: {formatTime(stats.fastestTime)}</span>
                                  )}
                                  {stats.slowestTime > 0 && (
                                    <span>🐌 Más lenta: {formatTime(stats.slowestTime)}</span>
                                  )}
                                  {stats.confidenceStats.very_sure > 0 && (
                                    <span>🎯 Seguras: {stats.confidenceStats.very_sure}</span>
                                  )}
                                </div>
                              </div>
                            )
                          })()}
                          
                          {/* Mensaje de guardado si aplica */}
                          {saveStatus === 'saved' && (
                            <div className="text-sm text-green-600 dark:text-green-400 mb-4 flex items-center justify-center space-x-2">
                              <span>✅</span>
                              <span>Progreso guardado en tu perfil</span>
                            </div>
                          )}
                          
                          {/* Mensaje motivacional basado en puntuación */}
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            {score === effectiveQuestions.length ? (
                              "🎉 ¡Perfecto! Dominas este tema completamente"
                            ) : score >= Math.ceil(effectiveQuestions.length * 0.8) ? (
                              "🎯 ¡Excelente! Muy buen dominio del tema"
                            ) : score >= Math.ceil(effectiveQuestions.length * 0.6) ? (
                              "👍 ¡Bien! Sigue practicando para mejorar"
                            ) : (
                              "📚 Repasa el temario y vuelve a intentarlo"
                            )}
                          </div>
                          
                          {/* Botones simplificados - solo 2 opciones */}
                          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
  
                            {/* ✅ LÓGICA CONDICIONAL PARA TESTS DE LEY vs TESTS DE TEMA */}
                            {(config?.isLawTest || tema === 0) ? (
                              // 🏛️ NAVEGACIÓN PARA TESTS DE LEY
                              <>
                                {/* Botón principal: Volver a la ley específica */}
                                {config.customNavigationLinks?.backToLaw && (
                                  <Link
                                    href={config.customNavigationLinks.backToLaw.href}
                                    className={`px-4 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-white transition-all bg-gradient-to-r ${config.color} hover:opacity-90 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-2 text-sm sm:text-base w-full sm:w-auto`}
                                  >
                                    <span>📚</span>
                                    <span className="text-center">{config.customNavigationLinks.backToLaw.label}</span>
                                  </Link>
                                )}
                                
                                {/* Botón secundario: Ir a tests por tema */}
                                {config.customNavigationLinks?.backToTests && (
                                  <Link
                                    href={config.customNavigationLinks.backToTests.href}
                                    className="px-8 py-4 rounded-lg font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-3"
                                  >
                                    <span>🗂️</span>
                                    <span>{config.customNavigationLinks.backToTests.label}</span>
                                  </Link>
                                )}
                                
                                {/* Fallback para tema = 0 sin customNavigationLinks */}
                                {tema === 0 && !config.customNavigationLinks?.backToLaw && (
                                  <Link
                                    href={config.isLawTest ? "/leyes" : "/auxiliar-administrativo-estado/test"}
                                    className={`px-8 py-4 rounded-lg font-semibold text-white transition-all bg-gradient-to-r ${config.color || 'from-blue-500 to-cyan-600'} hover:opacity-90 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-3`}
                                  >
                                    <span>📚</span>
                                    <span>{config.isLawTest ? "Volver a Leyes" : "Volver a Tests"}</span>
                                  </Link>
                                )}
                              </>
                            ) : (
                              // 🎯 NAVEGACIÓN ORIGINAL PARA TESTS DE TEMA
                              <>
                                {/* Botón principal: Volver al Tema */}
                                <Link
                                  href={`/auxiliar-administrativo-estado/test/tema/${tema}`}
                                  className={`px-8 py-4 rounded-lg font-semibold text-white transition-all bg-gradient-to-r ${config.color} hover:opacity-90 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-3`}
                                >
                                  <span>📚</span>
                                  <span>Volver al Tema {tema}</span>
                                </Link>
                                
                                {/* Botón secundario: Ir a Otros Temas */}
                                <Link
                                  href="/auxiliar-administrativo-estado/test"
                                  className="px-8 py-4 rounded-lg font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-3"
                                >
                                  <span>🗂️</span>
                                  <span>Ver Otros Temas</span>
                                </Link>
                              </>
                            )}
                            
                          </div>
                          
                          {/* Información adicional para motivar */}
                          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                              {user ? (
                                <div>💾 Tu progreso se guarda automáticamente</div>
                              ) : (
                                <div>
                                  <span>👤 </span>
                                  <button 
                                    onClick={() => window.location.href = '/login'} 
                                    className="underline hover:text-blue-600 dark:hover:text-blue-400"
                                  >
                                    Regístrate gratis
                                  </button>
                                  <span> para guardar tu progreso</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Evolución de la pregunta - sección unificada */}
                    {user && currentQuestionUuid && (
                      <>
                        {/* QuestionEvolution - Evolución compacta */}
                        <QuestionEvolution 
                          userId={user.id}
                          questionId={currentQuestionUuid}
                          currentResult={{
                            is_correct: selectedAnswer === currentQ.correct,
                            timeSpent: Math.round((Date.now() - questionStartTime) / 1000),
                            confidence: confidenceLevel
                          }}
                        />
                      </>
                    )}

                    {/* Información del artículo desplegable */}
                    {currentQ?.article?.full_text && (
                      <ArticleDropdown 
                        article={currentQ.article} 
                        currentQuestion={currentQ}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            

            {/* Children para contenido personalizado */}
            {children}
          </div>
        </main>

      </div>
    </PersistentRegistrationManager>
  )
}

// Componente para mostrar artículo desplegable con resaltado inteligente
function ArticleDropdown({ article, currentQuestion }) {
  const [isOpen, setIsOpen] = useState(false)

  // Función para extraer palabras clave de la pregunta y respuesta correcta
  const extractKeywords = (question, correctAnswer, options) => {
    const keywords = new Set()
    
    // Extraer palabras clave de la pregunta (filtrar palabras comunes)
    const questionWords = question
      ?.toLowerCase()
      .replace(/[¿?¡!,.:;]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !['tienen', 'como', 'para', 'sobre', 'entre', 'según', 'donde', 'cuando', 'cual', 'esta', 'este', 'estos', 'estas', 'pero', 'sino', 'aunque'].includes(word)
      ) || []
    
    questionWords.forEach(word => keywords.add(word))
    
    // Extraer palabras clave de la respuesta correcta
    const correctAnswerText = options?.[correctAnswer]
    if (correctAnswerText) {
      const answerWords = correctAnswerText
        .toLowerCase()
        .replace(/[,.:;]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
      
      answerWords.forEach(word => keywords.add(word))
    }
    
    return Array.from(keywords).filter(word => word.length > 2)
  }

  // Función para formatear texto plano a HTML legible con resaltado inteligente
  const formatTextContent = (content, question, correctAnswer, options) => {
    if (!content) return 'Contenido no disponible'
    
    let formattedContent = content
      // Convertir saltos de línea a <br>
      .replace(/\n/g, '<br>')
      // Convertir números de punto (1., 2., etc.) en párrafos numerados
      .replace(/(\d+\.\s)/g, '<br><strong>$1</strong>')
      // Convertir letras de punto (a), b), etc.) en sub-párrafos  
      .replace(/([a-z]\)\s)/g, '<br>&nbsp;&nbsp;<strong>$1</strong>')
      // Agregar espaciado después de puntos finales seguidos de mayúscula
      .replace(/\.\s+(?=[A-Z])/g, '.<br><br>')
      // Limpiar múltiples <br> consecutivos
      .replace(/(<br>\s*){3,}/g, '<br><br>')
      // Limpiar <br> al inicio
      .replace(/^(<br>\s*)+/, '')

    // NUEVO: Resaltar específicamente partes clave según el tipo de pregunta
    
    // Para preguntas sobre alto cargo
    if (question?.toLowerCase().includes('alto cargo') || question?.toLowerCase().includes('condición')) {
      const specificHighlights = [
        {
          pattern: /(Los órganos superiores y directivos tienen además la condición de alto cargo, excepto los Subdirectores generales y asimilados[^.]*\.)/gi,
          replacement: '<mark style="background-color: #fef3c7; padding: 3px 6px; border-radius: 4px; font-weight: bold; color: #92400e; border-left: 4px solid #f59e0b;">🎯 $1</mark>'
        },
        {
          pattern: /(excepto los Subdirectores generales y asimilados)/gi,
          replacement: '<mark style="background-color: #fee2e2; padding: 2px 4px; border-radius: 3px; font-weight: bold; color: #dc2626;">⚠️ $1</mark>'
        }
      ]
      
      specificHighlights.forEach(({ pattern, replacement }) => {
        formattedContent = formattedContent.replace(pattern, replacement)
      })
    }

    // Para preguntas sobre organización/estructura
    if (question?.toLowerCase().includes('órganos') || question?.toLowerCase().includes('organización')) {
      const organizationHighlights = [
        {
          pattern: /(Órganos superiores:[^b]*)/gi,
          replacement: '<mark style="background-color: #ddd6fe; padding: 2px 4px; border-radius: 3px; color: #5b21b6;">$1</mark>'
        },
        {
          pattern: /(Órganos directivos:[^\.]*\.)/gi,
          replacement: '<mark style="background-color: #dcfce7; padding: 2px 4px; border-radius: 3px; color: #166534;">$1</mark>'
        }
      ]
      
      organizationHighlights.forEach(({ pattern, replacement }) => {
        formattedContent = formattedContent.replace(pattern, replacement)
      })
    }

    // Resaltar términos específicos de la pregunta de forma más sutil
    const keywords = extractKeywords(question, correctAnswer, options)
    keywords.forEach(keyword => {
      if (keyword.length > 4 && !formattedContent.includes(`<mark`) && !formattedContent.includes(`style="background-color: #fef3c7`)) {
        const regex = new RegExp(`\\b(${keyword})\\b`, 'gi')
        formattedContent = formattedContent.replace(regex, (match) => {
          return `<span style="background-color: #e0f2fe; padding: 1px 2px; border-radius: 2px; color: #0277bd;">${match}</span>`
        })
      }
    })

    // Resaltar referencias a leyes y normativas
    formattedContent = formattedContent
      .replace(/(Ley\s+\d+\/\d+)/gi, '<strong style="color: #2563eb; background-color: #eff6ff; padding: 1px 3px; border-radius: 2px;">📋 $1</strong>')
      .replace(/(Real Decreto\s+\d+\/\d+)/gi, '<strong style="color: #16a34a; background-color: #f0fdf4; padding: 1px 3px; border-radius: 2px;">📜 $1</strong>')
      .replace(/(artículo\s+\d+)/gi, '<strong style="color: #9333ea; background-color: #faf5ff; padding: 1px 3px; border-radius: 2px;">📄 $1</strong>')

    return formattedContent
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg mt-4">
      {/* Header clickeable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors rounded-lg"
      >
        <div className="flex items-center space-x-2">
          <span className="text-lg">📚</span>
          <h4 className="font-bold text-gray-800 dark:text-gray-200">
            Ver Artículo Completo: {article.display_number || article.article_number}
          </h4>
          {/* Indicador de contenido relevante */}
          <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full">
            🎯 Contiene respuesta
          </span>
        </div>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Contenido desplegable con formato mejorado */}
      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600">
          
          {/* Título del artículo */}
          {article.title && (
            <div className="mt-3 mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
              <h5 className="font-bold text-blue-800 dark:text-blue-300 text-sm">
                📋 {article.title}
              </h5>
            </div>
          )}

          {/* Leyenda de colores - solo si hay resaltados */}
          {(currentQuestion?.question?.toLowerCase().includes('alto cargo') || 
            currentQuestion?.question?.toLowerCase().includes('órganos')) && (
            <div className="mt-3 mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <h6 className="font-bold text-amber-800 dark:text-amber-300 text-xs mb-2">🎯 Guía de lectura:</h6>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="flex items-center space-x-1">
                  <span style={{backgroundColor: '#fef3c7', padding: '1px 4px', borderRadius: '2px', color: '#92400e', fontWeight: 'bold'}}>■</span>
                  <span className="text-amber-700 dark:text-amber-400">Respuesta directa</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span style={{backgroundColor: '#fee2e2', padding: '1px 4px', borderRadius: '2px', color: '#dc2626', fontWeight: 'bold'}}>■</span>
                  <span className="text-amber-700 dark:text-amber-400">Excepciones clave</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span style={{backgroundColor: '#e0f2fe', padding: '1px 4px', borderRadius: '2px', color: '#0277bd'}}>■</span>
                  <span className="text-amber-700 dark:text-amber-400">Términos relacionados</span>
                </span>
              </div>
            </div>
          )}
          
          {/* Contenido del artículo con formato mejorado */}
          <div className="mt-3">
            <div 
              className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed space-y-2"
              dangerouslySetInnerHTML={{ 
                __html: formatTextContent(
                  article.full_text || article.content || 'Contenido no disponible',
                  currentQuestion?.question,
                  currentQuestion?.correct,
                  currentQuestion?.options
                ) 
              }}
            />
          </div>

          {/* Información adicional del artículo */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 dark:text-gray-400">
              <div>
                <span className="font-medium">📖 Ley:</span> LRJSP
              </div>
              <div>
                <span className="font-medium">📄 Artículo:</span> {article.article_number || article.display_number}
              </div>
            </div>
            
            {/* Tip para el usuario */}
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded text-xs text-blue-700 dark:text-blue-400">
              💡 <strong>Tip:</strong> Lee las partes resaltadas para encontrar rápidamente la respuesta. Los colores te ayudan a identificar la información clave.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function para generar ID único de pregunta
function generateQuestionId(questionData, tema, questionIndex) {
  // Genera un ID único basado en el contenido de la pregunta
  const content = questionData?.question || questionData?.question_text || ''
  const articleInfo = questionData?.article?.display_number || questionData?.primary_article_id || ''
  return `tema-${tema}-q${questionIndex}-${content.slice(0, 20).replace(/\s+/g, '-')}-${articleInfo}`.toLowerCase()
}

