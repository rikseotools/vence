// utils/testAnswers.ts - ACTUALIZADO CON FIX ANTI-DUPLICADOS Y SISTEMA DE REINTENTOS
import type { User, SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabase'
import { getDeviceInfo } from './testSession'
import { TestBackupSystem } from './testBackup'
import type { BackupAnswerData, SyncResults } from './testBackup'

// --- Types ---

interface QuestionArticle {
  id?: string | null
  number?: string | null
  law_id?: string | null
  law_short_name?: string | null
  law_name?: string | null
  full_text?: string | null
}

interface QuestionDataInput {
  id?: string | null
  question?: string
  question_text?: string
  options?: (string | undefined)[]
  tema?: number | string
  question_type?: string
  explanation?: string | null
  difficulty?: string | null
  article?: QuestionArticle | null
  metadata?: Record<string, unknown> | null
  [key: string]: unknown
}

interface AnswerDataInput {
  questionIndex: number
  selectedAnswer: number
  correctAnswer: number
  isCorrect: boolean
  timeSpent: number
  questionData?: QuestionDataInput | null
  confidence?: string | null
  interactions?: number
  timestamp?: string
}

interface SaveResult {
  success: boolean
  question_id?: string | null
  action: string
  error?: string | unknown
  attempts?: number
  hasLocalBackup?: boolean
}

interface SaveAnswerParams {
  sessionId: string
  questionData: QuestionDataInput
  answerData: AnswerDataInput
  tema: number | string
  confidenceLevel: string
  interactionCount: number
  questionStartTime: number | null
  firstInteractionTime: number | null
  interactionEvents: unknown[]
  mouseEvents: unknown[]
  scrollEvents: unknown[]
}

interface UserProfile {
  id: string
  target_oposicion: string | null
}

type ConfidenceLevel = 'very_sure' | 'sure' | 'unsure' | 'guessing'

// --- Module state ---

const supabase: SupabaseClient = getSupabaseClient()

// 🛡️ CACHE DE USUARIO (evitar múltiples llamadas a getUser)
let cachedUser: User | null = null
let userCacheTime: number = 0
const USER_CACHE_TTL = 60000 // 1 minuto

// 🆕 CACHE DE PERFIL DE USUARIO (para obtener oposición)
let cachedUserProfile: UserProfile | null = null
let userProfileCacheTime: number = 0

async function getCachedUser(): Promise<User | null> {
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
async function getCachedUserProfile(userId: string): Promise<UserProfile | null> {
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
    cachedUserProfile = profile as UserProfile
    userProfileCacheTime = now
  }
  return profile as UserProfile | null
}

// 🆕 RESOLVER TEMA VIA API CENTRALIZADA (lib/api/tema-resolver)
async function resolveTemaViaAPI(questionData: QuestionDataInput, oposicionId: string): Promise<number | null> {
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
  } catch (error: unknown) {
    console.warn('⚠️ [TemaResolver API] Error:', error instanceof Error ? error.message : String(error))
    return null
  }
}

// 🔧 FUNCIÓN PARA GENERAR question_id CONSISTENTE
const generateQuestionId = (questionData: QuestionDataInput, tema: number | string, questionOrder: number): string => {
  // Si ya tiene ID en metadata, usarlo
  if (questionData.metadata?.id) {
    return questionData.metadata.id as string
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
const generateArticleId = (questionData: QuestionDataInput, tema: number | string): string => {
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
export const saveDetailedAnswer = async (sessionId: string, questionData: QuestionDataInput, answerData: AnswerDataInput, tema: number | string, confidenceLevel: string, interactionCount: number, questionStartTime: number | null, firstInteractionTime: number | null, interactionEvents: unknown[], mouseEvents: unknown[], scrollEvents: unknown[]): Promise<SaveResult> => {
  try {
    console.log('💾 Guardando respuesta...', {
      sessionId,
      questionIndex: answerData.questionIndex,
      questionOrder: (answerData.questionIndex || 0) + 1,
      isCorrect: answerData.isCorrect
    })

    if (!sessionId || !questionData || !answerData) {
      console.error('❌ No se puede guardar: datos faltantes')
      return { success: false, error: 'Datos faltantes', action: 'error' }
    }

    // 🎯 CALCULAR TEMA ANTES DE USAR
    let calculatedTema = parseInt(String(questionData?.tema || tema)) || 0

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
      } catch (error: unknown) {
        console.warn('⚠️ [TemaFix] Error resolviendo tema:', error instanceof Error ? error.message : String(error))
      }
    }

    const hesitationTime = firstInteractionTime ?
      Math.max(0, firstInteractionTime - (questionStartTime || 0)) : 0

    // ✅ USAR ID REAL DE LA BASE DE DATOS O GENERAR COMO FALLBACK
    const questionId = questionData.id || generateQuestionId(questionData, tema, answerData.questionIndex)
    // For article_id, only use valid UUIDs (from question data or null for psychometric questions)
    const articleId = questionData.article?.id || null

    // ✅ OBTENER USUARIO (CON CACHE)
    const user = await getCachedUser()
    if (!user) {
      console.error('❌ No se puede obtener usuario autenticado')
      throw new Error('Usuario no autenticado')
    }

    // ✅ OBTENER INFO DE DISPOSITIVO CORRECTAMENTE
    const deviceInfo = getDeviceInfo()

    // Detectar si es pregunta psicotécnica
    const isPsychometric = questionData.question_type === 'psychometric'

    // ✅ DATOS CON NOMBRES EXACTOS DE LA BD Y CORRECCIONES
    const insertData: Record<string, unknown> = {
          // Campos obligatorios
          test_id: sessionId,
          question_order: (answerData.questionIndex || 0) + 1,
          question_text: questionData.question || 'Pregunta sin texto',
          user_answer: answerData.selectedAnswer === -1
            ? String.fromCharCode(65 + ((answerData.correctAnswer + 1) % 4)) // 🆕 Respuesta incorrecta para no respondidas
            : String.fromCharCode(65 + (answerData.selectedAnswer || 0)),
          correct_answer: String.fromCharCode(65 + (answerData.correctAnswer || 0)),
          is_correct: answerData.isCorrect || false,

          // ✅ CAMPOS DE IDENTIFICACIÓN - Usar columna correcta según tipo
          question_id: isPsychometric ? null : questionId,
          psychometric_question_id: isPsychometric ? questionId : null,
          article_id: articleId,
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
          device_type: deviceInfo?.device_model || 'unknown',
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
            interaction_events: (interactionEvents as unknown[] || []).slice(-10),
            mouse_activity: (mouseEvents as unknown[] || []).length,
            scroll_activity: (scrollEvents as unknown[] || []).length,
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
          constraint: error.message
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
        full_question_context_keys: Object.keys(insertData.full_question_context as object || {}),
        user_behavior_data_keys: Object.keys(insertData.user_behavior_data as object || {}),
        learning_analytics_keys: Object.keys(insertData.learning_analytics as object || {})
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

  } catch (error: unknown) {
    console.error('❌ Error en saveDetailedAnswer:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      action: 'error'
    }
  }
}

// Calcular confianza basada en tiempo e interacciones
export const calculateConfidence = (timeToDecide: number, interactionCount: number): ConfidenceLevel => {
  return timeToDecide < 10000 && interactionCount === 0 ? 'very_sure' :
         timeToDecide < 20000 && interactionCount <= 1 ? 'sure' :
         timeToDecide < 40000 && interactionCount <= 2 ? 'unsure' : 'guessing'
}

// Crear objeto de respuesta detallada
export const createDetailedAnswer = (currentQuestion: number, answerIndex: number, correctAnswer: number, isCorrect: boolean, timeSpent: number, questionData: QuestionDataInput | null, confidence: string | null, interactions: number): AnswerDataInput => {
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

// 🆕 V2: Guardar respuesta via API server-side (mas fiable que insert directo)
export const saveDetailedAnswerV2 = async (params: SaveAnswerParams): Promise<SaveResult> => {
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
  } = params

  try {
    if (!sessionId || !questionData || !answerData) {
      return { success: false, error: 'Datos faltantes', action: 'error' }
    }

    // Nivel 1: Refresh proactivo antes de usar el token
    let accessToken: string | undefined
    try {
      const { data: refreshData } = await supabase.auth.refreshSession()
      accessToken = refreshData?.session?.access_token
    } catch {
      // refreshSession puede fallar si no hay red — fallback a getSession
    }
    if (!accessToken) {
      console.warn('⚠️ [V2] refreshSession falló, fallback a getSession')
      const { data: { session: fallbackSession } } = await supabase.auth.getSession()
      accessToken = fallbackSession?.access_token
    }
    if (!accessToken) {
      console.error('❌ [V2] No hay sesion activa después de refresh')
      return { success: false, error: 'Sesión expirada', action: 'session_expired' }
    }

    // Recoger device info del navegador
    const deviceInfo = typeof window !== 'undefined' ? {
      userAgent: navigator.userAgent || 'unknown',
      screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      deviceType: /Mobile|Android|iPhone/.test(navigator.userAgent) ? 'mobile' :
                  /Tablet|iPad/.test(navigator.userAgent) ? 'tablet' : 'desktop',
      browserLanguage: navigator.language || 'es',
      timezone: Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || 'Europe/Madrid'
    } : undefined

    // Obtener oposicionId del perfil para evitar query extra en el servidor
    let oposicionId: string | null = null
    try {
      const user = await getCachedUser()
      if (user) {
        const profile = await getCachedUserProfile(user.id)
        oposicionId = profile?.target_oposicion || null
      }
    } catch {
      // No bloquear el guardado si falla
    }

    // Construir body
    const body = {
      sessionId,
      questionData: {
        id: questionData.id || null,
        question: questionData.question || '',
        options: questionData.options || [],
        tema: parseInt(String(questionData.tema || tema)) || 0,
        questionType: questionData.question_type === 'psychometric' ? 'psychometric' : 'legislative',
        article: questionData.article || null,
        metadata: questionData.metadata || null,
        explanation: questionData.explanation || null
      },
      answerData: {
        questionIndex: answerData.questionIndex || 0,
        selectedAnswer: answerData.selectedAnswer ?? -1,
        correctAnswer: answerData.correctAnswer || 0,
        isCorrect: answerData.isCorrect || false,
        timeSpent: answerData.timeSpent || 0
      },
      tema: parseInt(String(questionData.tema || tema)) || 0,
      confidenceLevel: confidenceLevel || 'unknown',
      interactionCount: interactionCount || 1,
      questionStartTime: questionStartTime || 0,
      firstInteractionTime: firstInteractionTime || 0,
      interactionEvents: (interactionEvents || []).slice(-10),
      mouseEvents: (mouseEvents || []).slice(-50),
      scrollEvents: (scrollEvents || []).slice(-50),
      deviceInfo,
      oposicionId
    }

    console.log('💾 [V2] Guardando respuesta via API...', {
      sessionId,
      questionIndex: answerData.questionIndex,
      isCorrect: answerData.isCorrect
    })

    const response = await fetch('/api/test/save-answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    })

    // Nivel 2: Si recibimos 401, intentar refresh + retry una vez
    if (response.status === 401) {
      console.warn('⚠️ [V2] 401 recibido, intentando refresh + retry...')
      try {
        const { data: retryRefresh } = await supabase.auth.refreshSession()
        if (retryRefresh?.session?.access_token) {
          const retryResponse = await fetch('/api/test/save-answer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${retryRefresh.session.access_token}`
            },
            body: JSON.stringify(body)
          })
          const retryResult = await retryResponse.json()
          if (retryResult.success) {
            console.log('✅ [V2] Respuesta guardada tras retry:', retryResult.action)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('refreshUserStreak'))
            }
          }
          return {
            success: retryResult.success,
            question_id: retryResult.question_id || null,
            action: retryResult.action || 'error',
            error: retryResult.error
          }
        }
      } catch {
        // Refresh falló completamente
      }
      console.error('🔒 [V2] Sesión expirada — refresh falló')
      return { success: false, error: 'Sesión expirada', action: 'session_expired' }
    }

    const result = await response.json()

    if (result.success) {
      console.log('✅ [V2] Respuesta guardada:', result.action)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('refreshUserStreak'))
      }
    } else {
      console.error('❌ [V2] Error del servidor:', result.error)
    }

    return {
      success: result.success,
      question_id: result.question_id || null,
      action: result.action || 'error',
      error: result.error
    }
  } catch (error: unknown) {
    console.error('❌ [V2] Error de red:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      action: 'error'
    }
  }
}

// 🔄 Guardar con reintentos automaticos (usa V2 API → fallback a V1 directo)
export const saveDetailedAnswerWithRetry = async (params: SaveAnswerParams, maxRetries: number = 3): Promise<SaveResult> => {
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
  let lastError: SaveResult | unknown = null;
  let testBackup: TestBackupSystem | null = null;

  // Inicializar sistema de backup si tenemos un sessionId
  if (sessionId && typeof window !== 'undefined') {
    testBackup = new TestBackupSystem(sessionId);

    // Guardar en local primero (como respaldo)
    const backupData: BackupAnswerData = {
      questionData: questionData as unknown as Record<string, unknown>,
      answerData: answerData as unknown as Record<string, unknown>,
      tema: parseInt(String(tema)) || 0,
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
      // Intentar V2 (API server-side) primero, fallback a V1 (Supabase directo)
      const useV2 = attempts === 0; // Primer intento siempre V2
      let result: SaveResult;

      if (useV2) {
        console.log('💾 Intentando guardar via API (V2)...');
        result = await saveDetailedAnswerV2(params);

        // Si sesión expirada (Nivel 2 agotado), no reintentar
        if (!result.success && result.action === 'session_expired') {
          console.error('🔒 Sesión expirada — no se puede recuperar')
          return { ...result, hasLocalBackup: testBackup !== null }
        }

        // Si V2 falla por error de red, intentar V1 en el mismo intento
        if (!result.success && result.action === 'error') {
          console.warn('⚠️ V2 fallo, intentando V1 (Supabase directo)...');
          result = await saveDetailedAnswer(
            sessionId, questionData, answerData, tema,
            confidenceLevel, interactionCount, questionStartTime,
            firstInteractionTime, interactionEvents, mouseEvents, scrollEvents
          );
        }
      } else {
        // Reintentos posteriores usan V1 directo (mas simple)
        result = await saveDetailedAnswer(
          sessionId, questionData, answerData, tema,
          confidenceLevel, interactionCount, questionStartTime,
          firstInteractionTime, interactionEvents, mouseEvents, scrollEvents
        );
      }

      if (result.success === true) {
        // Marcar como sincronizado en el backup local
        if (testBackup) {
          testBackup.markAsSynced(answerData.questionIndex + 1);
        }
        console.log('✅ Respuesta guardada exitosamente en intento', attempts + 1);
        return result;
      }

      // Si es duplicado, no reintentar
      if (result.action === 'prevented_duplicate' || result.action === 'already_saved') {
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

    } catch (error: unknown) {
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
export const syncPendingAnswers = async (sessionId: string): Promise<SyncResults | { success: boolean; error?: string; synced?: number }> => {
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
      answer.questionData as unknown as QuestionDataInput,
      answer.answerData as unknown as AnswerDataInput,
      answer.tema,
      answer.confidenceLevel,
      answer.interactionCount,
      answer.timeData?.questionStartTime || 0,
      answer.timeData?.firstInteractionTime || 0,
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

// Export types for consumers
export type { QuestionDataInput, AnswerDataInput, SaveResult, SaveAnswerParams, ConfidenceLevel }
