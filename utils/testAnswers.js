// utils/testAnswers.js - ACTUALIZADO CON FIX ANTI-DUPLICADOS Y SISTEMA DE REINTENTOS
import { getSupabaseClient } from '../lib/supabase'
import { getDeviceInfo } from './testSession'
import { TestBackupSystem } from './testBackup'

const supabase = getSupabaseClient()

// 🛡️ CACHE DE USUARIO (evitar múltiples llamadas a getUser)
let cachedUser = null
let userCacheTime = 0
const USER_CACHE_TTL = 60000 // 1 minuto

// 🆕 CACHE DE PERFIL DE USUARIO (para obtener oposición)
let cachedUserProfile = null
let userProfileCacheTime = 0

async function getCachedUser() {
  const now = Date.now()
  if (cachedUser && (now - userCacheTime) < USER_CACHE_TTL) {
    return cachedUser
  }

  const { data: { user }, error } = await supabase.auth.getUser()
  if (!error && user) {
    cachedUser = user
    userCacheTime = now
  }
  return user
}

// 🆕 OBTENER PERFIL CON CACHE (para oposición objetivo)
async function getCachedUserProfile(userId) {
  const now = Date.now()
  if (cachedUserProfile && cachedUserProfile.id === userId && (now - userProfileCacheTime) < USER_CACHE_TTL) {
    return cachedUserProfile
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, target_oposicion')
    .eq('id', userId)
    .single()

  if (!error && profile) {
    cachedUserProfile = profile
    userProfileCacheTime = now
  }
  return profile
}

// 🆕 RESOLVER TEMA VIA API CENTRALIZADA (lib/api/tema-resolver)
async function resolveTemaViaAPI(questionData, oposicionId) {
  try {
    const params = new URLSearchParams()

    // Añadir parámetros disponibles
    if (questionData?.id) {
      params.set('questionId', questionData.id)
    }
    if (questionData?.article?.id) {
      params.set('articleId', questionData.article.id)
    }
    if (questionData?.article?.number) {
      params.set('articleNumber', questionData.article.number)
    }
    if (questionData?.article?.law_id) {
      params.set('lawId', questionData.article.law_id)
    }
    if (questionData?.article?.law_short_name) {
      params.set('lawShortName', questionData.article.law_short_name)
    }
    params.set('oposicionId', oposicionId || 'auxiliar_administrativo_estado')

    const response = await fetch(`/api/tema-resolver?${params.toString()}`)
    const result = await response.json()

    if (result.success && result.temaNumber) {
      console.log('🎯 [TemaResolver API] Tema resuelto:', result.temaNumber, 'via', result.resolvedVia)
      return result.temaNumber
    }

    console.log('⚠️ [TemaResolver API] No se pudo resolver tema:', result.reason || result.error)
    return null
  } catch (error) {
    console.warn('⚠️ [TemaResolver API] Error:', error.message)
    return null
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

// 🛡️ GUARDAR RESPUESTA (SIMPLIFICADO Y PROFESIONAL)
export const saveDetailedAnswer = async (sessionId, questionData, answerData, tema, confidenceLevel, interactionCount, questionStartTime, firstInteractionTime, interactionEvents, mouseEvents, scrollEvents) => {
  try {
    console.log('💾 Guardando respuesta...', {
      sessionId,
      questionIndex: answerData.questionIndex,
      questionOrder: (answerData.questionIndex || 0) + 1,
      isCorrect: answerData.isCorrect
    })

    if (!sessionId || !questionData || !answerData) {
      console.error('❌ No se puede guardar: datos faltantes')
      return { success: false, error: 'Datos faltantes' }
    }

    // 🎯 CALCULAR TEMA ANTES DE USAR
    let calculatedTema = parseInt(questionData?.tema || tema) || 0

    // 🆕 Si el tema es 0, intentar resolverlo via API centralizada
    if (calculatedTema === 0 && questionData) {
      try {
        const user = await getCachedUser()
        if (user) {
          const profile = await getCachedUserProfile(user.id)
          const oposicionId = profile?.target_oposicion || 'auxiliar_administrativo_estado'
          const foundTema = await resolveTemaViaAPI(questionData, oposicionId)
          if (foundTema) {
            calculatedTema = foundTema
            console.log('🎯 [TemaFix] Tema asignado automáticamente:', calculatedTema)
          }
        }
      } catch (error) {
        console.warn('⚠️ [TemaFix] Error resolviendo tema:', error.message)
      }
    }

    const hesitationTime = firstInteractionTime ?
      Math.max(0, firstInteractionTime - questionStartTime) : 0

    // ✅ USAR ID REAL DE LA BASE DE DATOS O GENERAR COMO FALLBACK
    const questionId = questionData.id || generateQuestionId(questionData, tema, answerData.questionIndex)
    const articleId = questionData.article?.id || generateArticleId(questionData, tema)

    // ✅ OBTENER USUARIO (CON CACHE)
    const user = await getCachedUser()
    if (!user) {
      console.error('❌ No se puede obtener usuario autenticado')
      throw new Error('Usuario no autenticado')
    }
        
    // ✅ OBTENER INFO DE DISPOSITIVO CORRECTAMENTE
    const deviceInfo = getDeviceInfo()

    // ✅ DATOS CON NOMBRES EXACTOS DE LA BD Y CORRECCIONES
    const insertData = {
          // Campos obligatorios
          test_id: sessionId,
          question_order: (answerData.questionIndex || 0) + 1,
          question_text: questionData.question || 'Pregunta sin texto',
          user_answer: answerData.selectedAnswer === -1
            ? String.fromCharCode(65 + ((answerData.correctAnswer + 1) % 4)) // 🆕 Respuesta incorrecta para no respondidas
            : String.fromCharCode(65 + (answerData.selectedAnswer || 0)),
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
          browser_language: 'es',
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
      // ✅ MANEJAR ERROR DE CONSTRAINT ÚNICO
      if (error.code === '23505') { // unique constraint violation
        console.warn('⚠️ Respuesta duplicada (ya guardada):', {
          test_id: sessionId,
          question_order: insertData.question_order,
          constraint: error.constraint
        })
        // Devolver success=true porque la respuesta YA está guardada
        return {
          success: true,
          question_id: questionId,
          action: 'already_saved'
        }
      }

      console.error('❌ Error guardando respuesta:', {
        error_code: error.code,
        error_message: error.message,
        error_details: error.details,
        error_hint: error.hint,
        test_id: sessionId,
        question_order: insertData.question_order,
        full_error: error
      })

      // 🔍 LOG DETALLADO DE LOS DATOS QUE INTENTAMOS INSERTAR
      console.error('📋 Datos que intentamos insertar:', {
        question_id: insertData.question_id,
        article_id: insertData.article_id,
        user_answer: insertData.user_answer,
        correct_answer: insertData.correct_answer,
        confidence_level: insertData.confidence_level,
        device_type: insertData.device_type,
        full_question_context_keys: Object.keys(insertData.full_question_context || {}),
        user_behavior_data_keys: Object.keys(insertData.user_behavior_data || {}),
        learning_analytics_keys: Object.keys(insertData.learning_analytics || {})
      })

      // Guardar en localStorage para retry posterior
      try {
        const backupKey = `failed_save_${sessionId}_${insertData.question_order}`
        localStorage.setItem(backupKey, JSON.stringify(insertData))
        console.log('💾 Respuesta guardada en localStorage para retry')
      } catch (e) {
        console.warn('⚠️ No se pudo guardar backup en localStorage')
      }

      throw error
    }

    console.log('✅ Respuesta guardada exitosamente')

    // 🔥 Notificar al Header para refrescar la racha
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('refreshUserStreak'))
    }

    return {
      success: true,
      question_id: questionId,
      action: 'saved_new'
    }

  } catch (error) {
    console.error('❌ Error en saveDetailedAnswer:', error)
    return {
      success: false,
      error: error.message,
      action: 'error'
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

// 🔄 NUEVA FUNCIÓN: Guardar con reintentos automáticos
export const saveDetailedAnswerWithRetry = async (params, maxRetries = 3) => {
  const {
    sessionId,
    questionData,
    answerData,
    tema,
    confidenceLevel,
    interactionCount,
    questionStartTime,
    firstInteractionTime,
    interactionEvents,
    mouseEvents,
    scrollEvents
  } = params;

  let attempts = 0;
  let lastError = null;
  let testBackup = null;

  // Inicializar sistema de backup si tenemos un sessionId
  if (sessionId && typeof window !== 'undefined') {
    testBackup = new TestBackupSystem(sessionId);

    // Guardar en local primero (como respaldo)
    const backupData = {
      questionData,
      answerData,
      tema,
      confidenceLevel,
      interactionCount,
      timeData: {
        questionStartTime,
        firstInteractionTime
      }
    };

    testBackup.saveLocally(answerData.questionIndex + 1, backupData);
    console.log('💾 Respuesta guardada localmente como respaldo');
  }

  while (attempts < maxRetries) {
    try {
      const result = await saveDetailedAnswer(
        sessionId,
        questionData,
        answerData,
        tema,
        confidenceLevel,
        interactionCount,
        questionStartTime,
        firstInteractionTime,
        interactionEvents,
        mouseEvents,
        scrollEvents
      );

      if (result.success === true) {
        // Marcar como sincronizado en el backup local
        if (testBackup) {
          testBackup.markAsSynced(answerData.questionIndex + 1);
        }
        console.log('✅ Respuesta guardada exitosamente en intento', attempts + 1);
        return result;
      }

      // Si es duplicado, no reintentar
      if (result.action === 'prevented_duplicate') {
        console.warn('⚠️ Respuesta duplicada detectada, no se reintentará');
        return result;
      }

      lastError = result;
      attempts++;

      if (attempts < maxRetries) {
        // Backoff exponencial: 1s, 2s, 4s
        const delay = Math.pow(2, attempts - 1) * 1000;
        console.log(`🔄 Reintentando guardado (${attempts}/${maxRetries}) en ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

    } catch (error) {
      lastError = error;
      attempts++;
      console.error(`❌ Error en intento ${attempts}:`, error);

      if (attempts < maxRetries) {
        const delay = Math.pow(2, attempts - 1) * 1000;
        console.log(`🔄 Reintentando después de error (${attempts}/${maxRetries}) en ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Si todos los reintentos fallan
  console.error('❌ Todos los reintentos fallaron después de', attempts, 'intentos');
  return {
    success: false,
    error: lastError,
    attempts: attempts,
    action: 'all_retries_failed',
    hasLocalBackup: testBackup !== null
  };
}

// 🔄 NUEVA FUNCIÓN: Sincronizar respuestas pendientes desde backup local
export const syncPendingAnswers = async (sessionId) => {
  if (typeof window === 'undefined' || !sessionId) {
    return { success: false, error: 'No se puede sincronizar en el servidor' };
  }

  const testBackup = new TestBackupSystem(sessionId);
  const stats = testBackup.getStats();

  if (stats.unsynced === 0) {
    console.log('✅ No hay respuestas pendientes de sincronizar');
    return { success: true, synced: 0 };
  }

  console.log(`🔄 Sincronizando ${stats.unsynced} respuestas pendientes...`);

  const results = await testBackup.syncPending(async (answer) => {
    // Reconstruir los parámetros desde el backup
    return await saveDetailedAnswer(
      sessionId,
      answer.questionData,
      answer.answerData,
      answer.tema,
      answer.confidenceLevel,
      answer.interactionCount,
      answer.timeData?.questionStartTime,
      answer.timeData?.firstInteractionTime,
      [], // No tenemos eventos guardados
      [],
      []
    );
  });

  console.log(`✅ Sincronización completa: ${results.success} exitosas, ${results.failed} fallidas`);

  if (results.failed > 0) {
    console.warn('⚠️ Algunas respuestas no pudieron sincronizarse:', results.errors);
  }

  return results;
}