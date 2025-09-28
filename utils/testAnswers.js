// utils/testAnswers.js - ACTUALIZADO CON FIX ANTI-DUPLICADOS
import { getSupabaseClient } from '../lib/supabase'
import { getDeviceInfo } from './testSession.js'

const supabase = getSupabaseClient()

// 🛡️ INICIALIZAR MAP GLOBAL PARA TRACKEAR SAVES
if (typeof window !== 'undefined') {
  if (!window.activeSaves) {
    window.activeSaves = new Map()
  }
}

// 🔧 FUNCIÓN PARA GENERAR question_id CONSISTENTE
const generateQuestionId = (questionData, tema, questionOrder) => {
  // Si ya tiene ID en metadata, usarlo
  if (questionData.metadata?.id) {
    return questionData.metadata.id
  }
  
  // ✅ GENERAR ID CONSISTENTE basado en contenido (sin timestamp ni random)
  // Esto asegura que la misma pregunta siempre tenga el mismo ID
  
  // Hash del texto completo para identificar la pregunta específica
  const fullText = (questionData.question || '').trim() + 
                  (questionData.options?.join('') || '') + 
                  (questionData.article?.number || '') + 
                  (questionData.article?.law_short_name || '')
  
  // Crear hash simple pero consistente del contenido
  let hash = 0
  for (let i = 0; i < fullText.length; i++) {
    const char = fullText.charCodeAt(i)
    hash = ((hash << 5) - hash + char) & 0xffffffff
  }
  
  // Convertir a string positivo
  const contentHash = Math.abs(hash).toString(36)
  
  // ID consistente basado en contenido + tema + artículo
  const baseId = `tema-${tema}-art-${questionData.article?.number || 'unknown'}-${questionData.article?.law_short_name || 'unknown'}`
  
  return `${baseId}-${contentHash}`
}

// 🔧 FUNCIÓN PARA GENERAR article_id ÚNICO
const generateArticleId = (questionData, tema) => {
  // Si ya tiene ID en article, usarlo
  if (questionData.article?.id) {
    return questionData.article.id
  }
  
  // Si no, generar basado en datos del artículo
  if (questionData.article?.number && questionData.article?.law_short_name) {
    return `${questionData.article.law_short_name}-art-${questionData.article.number}`
  }
  
  // Fallback: usar tema
  return `tema-${tema}-article-unknown`
}

// 🛡️ GUARDAR RESPUESTA CON PROTECCIÓN ANTI-DUPLICADOS
export const saveDetailedAnswer = async (sessionId, questionData, answerData, tema, confidenceLevel, interactionCount, questionStartTime, firstInteractionTime, interactionEvents, mouseEvents, scrollEvents) => {
  try {
    // ✅ CREAR CLAVE ÚNICA PARA ESTA RESPUESTA
    const saveKey = `${sessionId}-${answerData.questionIndex}-${answerData.selectedAnswer}-${answerData.timeSpent}`
    
    // ✅ VERIFICAR SI YA SE ESTÁ GUARDANDO ESTA RESPUESTA
    if (typeof window !== 'undefined' && window.activeSaves?.has(saveKey)) {
      console.log('🚫 DUPLICADO BLOQUEADO: Ya guardando', saveKey)
      return window.activeSaves.get(saveKey) // Devolver la promise existente
    }
    
    console.log('💾 [PROTEGIDO] Guardando respuesta única...', {
      saveKey,
      sessionId,
      questionIndex: answerData.questionIndex,
      selectedAnswer: answerData.selectedAnswer,
      isCorrect: answerData.isCorrect
    })
    
    if (!sessionId || !questionData || !answerData) {
      console.error('❌ No se puede guardar: datos faltantes')
      return { success: false, error: 'Datos faltantes' }
    }
    
    // ✅ CREAR PROMISE DE GUARDADO
    // 🎯 CALCULAR TEMA ANTES DE USAR
    const calculatedTema = parseInt(questionData?.tema || tema) || 0
    
    const savePromise = (async () => {
      try {
        const hesitationTime = firstInteractionTime ? 
          Math.max(0, firstInteractionTime - questionStartTime) : 0
        
        // ✅ USAR ID REAL DE LA BASE DE DATOS O GENERAR COMO FALLBACK
        const questionId = questionData.id || generateQuestionId(questionData, tema, answerData.questionIndex)
        const articleId = questionData.article?.id || generateArticleId(questionData, tema)
        
        
        // ✅ OBTENER INFO DE DISPOSITIVO CORRECTAMENTE
        const deviceInfo = getDeviceInfo()
        
        // ✅ DATOS CON NOMBRES EXACTOS DE LA BD Y CORRECCIONES
        const insertData = {
          // Campos obligatorios
          test_id: sessionId,
          question_order: (answerData.questionIndex || 0) + 1,
          question_text: questionData.question || 'Pregunta sin texto',
          user_answer: String.fromCharCode(65 + (answerData.selectedAnswer || 0)),
          correct_answer: String.fromCharCode(65 + (answerData.correctAnswer || 0)),
          is_correct: answerData.isCorrect || false,
          
          // ✅ CAMPOS DE IDENTIFICACIÓN - NUNCA NULL
          question_id: questionId, // ✅ GARANTIZADO NO NULL
          article_id: articleId,   // ✅ GARANTIZADO NO NULL
          article_number: questionData.article?.number || 'unknown',
          law_name: questionData.article?.law_short_name || 'unknown',
          tema_number: calculatedTema,
          
          // Campos de respuesta y tiempo
          confidence_level: confidenceLevel || 'unknown',
          time_spent_seconds: answerData.timeSpent || 0,
          time_to_first_interaction: hesitationTime,
          time_hesitation: Math.max(0, (answerData.timeSpent || 0) - hesitationTime),
          interaction_count: interactionCount || 1,
          
          // Metadatos de pregunta
          difficulty: questionData.metadata?.difficulty === 'auto' ? 'medium' : 
             (questionData.metadata?.difficulty || 'medium'),
          question_type: questionData.metadata?.question_type || 'single',
          tags: questionData.metadata?.tags || [],
          
          // Campos de aprendizaje (opcionales por ahora)
          previous_attempts_this_article: 0,
          historical_accuracy_this_article: 0,
          knowledge_retention_score: null,
          learning_efficiency_score: null,
          
          // ✅ DATOS DE DISPOSITIVO - CORREGIDOS
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          screen_resolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'unknown',
          device_type: deviceInfo?.device_type || deviceInfo?.type || deviceInfo?.model || 'unknown',
          browser_language: typeof navigator !== 'undefined' ? navigator.language : 'es',
          timezone: typeof Intl !== 'undefined' ? 
            Intl.DateTimeFormat().resolvedOptions().timeZone : 'Europe/Madrid',
          
          // ✅ DATOS JSON (JSONB)
          full_question_context: {
            options: questionData.options || [],
            explanation: questionData.explanation || '',
            article_full: questionData.article || {},
            difficulty_meta: questionData.metadata || {},
            generated_ids: {
              question_id: questionId,
              article_id: articleId,
              generation_method: questionData.metadata?.id ? 'metadata' : 'generated'
            }
          },
          
          user_behavior_data: {
            interaction_events: (interactionEvents || []).slice(-10),
            mouse_activity: (mouseEvents || []).length,
            scroll_activity: (scrollEvents || []).length,
            confidence_evolution: confidenceLevel || 'unknown',
            answer_changes: Math.max(0, (interactionCount || 1) - 1)
          },
          
          learning_analytics: {
            response_pattern: answerData.isCorrect ? 'correct' : 'incorrect',
            time_efficiency: (answerData.timeSpent || 0) <= 30 ? 'fast' : 
                            (answerData.timeSpent || 0) <= 60 ? 'normal' : 'slow',
            confidence_accuracy_match: ((confidenceLevel === 'very_sure' || confidenceLevel === 'sure') === answerData.isCorrect),
            hesitation_pattern: hesitationTime > 10 ? 'high' : hesitationTime > 5 ? 'medium' : 'low',
            interaction_pattern: (interactionCount || 1) > 2 ? 'hesitant' : 
                                (interactionCount || 1) === 1 ? 'decisive' : 'normal'
          }
        }

        const { error } = await supabase
          .from('test_questions')
          .insert(insertData)

        if (error) {
          // ✅ MANEJAR ERROR DE CONSTRAINT ÚNICO (AHORA CON MÁS DETALLE)
          if (error.code === '23505') { // unique constraint violation
            console.warn('⚠️ CONSTRAINT ÚNICO VIOLADO - Respuesta duplicada detectada:', {
              question_id: questionId,
              saveKey,
              error_detail: error.details,
              constraint: error.constraint
            })
            return { 
              success: false, // ❌ CAMBIAR A FALSE para detectar problema
              question_id: questionId, 
              action: 'prevented_duplicate',
              error: 'Duplicate constraint violation'
            }
          }
          
          console.error('❌ Error guardando respuesta:', {
            error_code: error.code,
            error_message: error.message,
            error_details: error.details,
            saveKey,
            question_id: questionId
          })
          throw error
        }
        
        console.log('✅ [PROTEGIDO] Respuesta única guardada exitosamente')
        console.log('🎯 question_id asignado:', questionId)
        console.log('🎯 Trigger debería ejecutarse automáticamente...')
        
        return {
          success: true,
          question_id: questionId,
          action: 'saved_new'
        }

      } catch (error) {
        console.error('❌ Error en savePromise:', error)
        return { 
          success: false, 
          error: error.message,
          action: 'error'
        }
      } finally {
        // ✅ LIMPIAR DEL MAP DESPUÉS DE 2 SEGUNDOS
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.activeSaves?.delete(saveKey)
            console.log('🧹 Limpiado save key:', saveKey)
          }
        }, 2000)
      }
    })()
    
    // ✅ GUARDAR LA PROMISE EN EL MAP PARA EVITAR DUPLICADOS
    if (typeof window !== 'undefined') {
      window.activeSaves?.set(saveKey, savePromise)
    }
    
    return savePromise

  } catch (error) {
    console.error('❌ Error en saveDetailedAnswer:', error)
    return { 
      success: false, 
      error: error.message,
      action: 'outer_error'
    }
  }
}

// Calcular confianza basada en tiempo e interacciones
export const calculateConfidence = (timeToDecide, interactionCount) => {
  return timeToDecide < 10000 && interactionCount === 0 ? 'very_sure' :
         timeToDecide < 20000 && interactionCount <= 1 ? 'sure' :
         timeToDecide < 40000 && interactionCount <= 2 ? 'unsure' : 'guessing'
}

// Crear objeto de respuesta detallada
export const createDetailedAnswer = (currentQuestion, answerIndex, correctAnswer, isCorrect, timeSpent, questionData, confidence, interactions) => {
  return {
    questionIndex: currentQuestion,
    selectedAnswer: answerIndex,
    correctAnswer: correctAnswer,
    isCorrect: isCorrect,
    timeSpent: timeSpent,
    timestamp: new Date().toISOString(),
    questionData: questionData,
    confidence: confidence,
    interactions: interactions
  }
}