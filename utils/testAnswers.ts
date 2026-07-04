// utils/testAnswers.ts - ACTUALIZADO CON FIX ANTI-DUPLICADOS Y SISTEMA DE REINTENTOS
import { auth } from '../lib/auth'
import type { AuthUser } from '../lib/auth/types'
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

// 🛡️ CACHE DE USUARIO (evitar múltiples llamadas a getUser)
let cachedUser: AuthUser | null = null
let userCacheTime: number = 0
const USER_CACHE_TTL = 60000 // 1 minuto

// 🆕 CACHE DE PERFIL DE USUARIO (para obtener oposición)
let cachedUserProfile: UserProfile | null = null
let userProfileCacheTime: number = 0

async function getCachedUser(): Promise<AuthUser | null> {
  const now = Date.now()
  if (cachedUser && (now - userCacheTime) < USER_CACHE_TTL) {
    return cachedUser
  }

  const user = await auth.getUser()
  if (user) {
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

  // Lee la oposición objetivo vía endpoint server-side (RDS/Drizzle, agnóstico).
  // El userId lo impone el token en el servidor; el arg sirve solo para la cache.
  try {
    const session = await auth.getSession()
    const accessToken = session?.accessToken
    if (!accessToken) return null
    const res = await fetch('/api/v2/oposicion/target', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data?.success) {
      const profile: UserProfile = { id: userId, target_oposicion: data.target_oposicion ?? null }
      cachedUserProfile = profile
      userProfileCacheTime = now
      return profile
    }
  } catch {
    // best-effort — si falla, el servidor resuelve el tema igualmente
  }
  return null
}

// 🛡️ GUARDAR RESPUESTA — delega en el endpoint server-side (saveDetailedAnswerV2 →
// POST /api/test/save-answer, RDS/Drizzle, agnóstico de proveedor). ANTES hacía un
// INSERT directo a Supabase (test_questions); ahora es un wrapper para que NADA del
// cliente toque Supabase. La firma posicional se conserva (la usan
// saveDetailedAnswerWithRetry y syncPendingAnswers).
export const saveDetailedAnswer = async (
  sessionId: string,
  questionData: QuestionDataInput,
  answerData: AnswerDataInput,
  tema: number | string,
  confidenceLevel: string,
  interactionCount: number,
  questionStartTime: number | null,
  firstInteractionTime: number | null,
  interactionEvents: unknown[],
  mouseEvents: unknown[],
  scrollEvents: unknown[],
): Promise<SaveResult> => {
  return saveDetailedAnswerV2({
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
    scrollEvents,
  })
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
      const refreshed = await auth.refreshSession()
      accessToken = refreshed?.accessToken
    } catch {
      // refreshSession puede fallar si no hay red — fallback a getSession
    }
    if (!accessToken) {
      console.warn('⚠️ [V2] refreshSession falló, fallback a getSession')
      const fallbackSession = await auth.getSession()
      accessToken = fallbackSession?.accessToken
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
        const retryRefresh = await auth.refreshSession()
        if (retryRefresh?.accessToken) {
          const retryResponse = await fetch('/api/test/save-answer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${retryRefresh.accessToken}`
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
      // Intentar V2 (API server-side) primero, fallback a V1 (ya server-side, RDS)
      const useV2 = attempts === 0; // Primer intento siempre V2
      let result: SaveResult;

      if (useV2) {
        console.log('💾 Intentando guardar via API (V2)...');
        result = await saveDetailedAnswerV2(params);

        // Si sesión expirada, NO hacer fallback — devolver para que el UI muestre el modal
        if (!result.success && result.action === 'session_expired') {
          console.error('🔒 Sesión expirada — no se reintenta, devolviendo para mostrar modal');
          return result;
        }

        // Si V2 falla por error de red, fallback a V1 (ya server-side, RDS)
        if (!result.success && result.action === 'error') {
          console.warn('⚠️ V2 falló por error de red, intentando V1 (ya server-side, RDS)...');
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
