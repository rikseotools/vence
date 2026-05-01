// lib/api/v2/answer-and-save/queries.ts
// Lógica server-side: validar respuesta + guardar + actualizar score
import { getDb } from '@/db/client'
import { tests, userProfiles, questions, articles, laws, psychometricQuestions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { insertTestAnswer } from '@/lib/api/test-answers'
import { invalidateProfileCache } from '@/lib/api/profile'
import type { SaveAnswerRequest } from '@/lib/api/test-answers'
import type { AnswerAndSaveRequest, AnswerAndSaveResponse } from './schemas'
import { resolveTemaByQuestionIdFast } from '@/lib/api/tema-resolver/queries'
import { ALL_OPOSICION_IDS } from '@/lib/config/oposiciones'
import type { OposicionId } from '@/lib/api/tema-resolver/schemas'

// ============================================
// VALIDATION CACHE (tag: 'questions', TTL 1h)
// ============================================
// La respuesta correcta + explicación + metadata de ley/artículo es estática
// para una pregunta dada. Cacheamos: hit ratio altísimo porque una pregunta
// popular se valida miles de veces (N users × M tests).
//
// Verificado empíricamente (30 runs):
//   - Sin cache: ~63-67ms por hit (1 round-trip Vercel→Supabase)
//   - Con cache hit: <1ms (memoria)
//   - Mejora: ~60ms por hit que ya esté en cache
//
// TTL 1 hora como red de seguridad: si admin edita una pregunta y olvida
// invalidar el tag, el cache se autorefresca en máximo 1h. NO usamos
// revalidate:false porque las correcciones de preguntas (tras feedback /
// disputes) deben propagarse rápidamente — datos viejos PERMANENTES sería
// problemático funcionalmente (users responden contra correct_option mal).
//
// Invalidación inmediata cuando admin edita:
//   revalidateTag('questions') tras UPDATE en endpoint admin, o
//   curl POST /api/admin/revalidate -d '{"tag":"questions"}'
//
// Follow-up: identificar endpoints admin que editan preguntas
// (correct_option, explanation, etc.) y añadir revalidateTag('questions')
// tras UPDATE OK para invalidación instantánea (vs esperar al TTL).

interface QuestionValidation {
  correctOption: number | null
  explanation: string | null
  articleNumber: string | null
  lawShortName: string | null
  lawName: string | null
}

async function getQuestionValidationInternal(
  questionId: string,
): Promise<QuestionValidation | null> {
  const db = getDb()

  // 1. Probar tabla questions con JOIN articles+laws (preguntas legislativas)
  const result = await db
    .select({
      correctOption: questions.correctOption,
      explanation: questions.explanation,
      articleNumber: articles.articleNumber,
      lawShortName: laws.shortName,
      lawName: laws.name,
    })
    .from(questions)
    .leftJoin(articles, eq(questions.primaryArticleId, articles.id))
    .leftJoin(laws, eq(articles.lawId, laws.id))
    .where(eq(questions.id, questionId))
    .limit(1)

  if (result[0]) return result[0]

  // 2. Fallback: psychometric_questions
  const psyResult = await db
    .select({
      correctOption: psychometricQuestions.correctOption,
      explanation: psychometricQuestions.explanation,
    })
    .from(psychometricQuestions)
    .where(eq(psychometricQuestions.id, questionId))
    .limit(1)

  if (psyResult[0]) {
    return {
      correctOption: psyResult[0].correctOption,
      explanation: psyResult[0].explanation,
      articleNumber: null,
      lawShortName: null,
      lawName: null,
    }
  }

  return null
}

const getQuestionValidationCached = unstable_cache(
  getQuestionValidationInternal,
  ['question-validation-v1'],
  { revalidate: 3600, tags: ['questions'] }, // 1 hora — red de seguridad
)

// ============================================
// VALIDAR + GUARDAR (operación principal)
// ============================================

/**
 * Determina si debe lanzarse el fast-path del resolver de tema.
 *
 * El resolver solo se ejecuta cuando:
 *   1. El cliente mandó tema=0 (test-personalizado, test global, tests de
 *      oposición sin tema asignado, etc.).
 *   2. La pregunta es legislativa (no psicotécnica — las psico tienen su
 *      propio sistema de categorías y no pasan por topic_scope).
 *   3. El questionId parece UUID (las preguntas AI-generated con IDs
 *      sintéticos no están en la tabla questions y el resolver no les sirve).
 */
function shouldResolveTema(params: AnswerAndSaveRequest): boolean {
  if (params.tema !== 0) return false
  if (params.questionType === 'psychometric') return false
  // UUID regex rápido (no estricto, solo para filtrar IDs sintéticos obvios)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.questionId)
}

export async function validateAndSaveAnswer(
  params: AnswerAndSaveRequest,
  userId: string,
): Promise<AnswerAndSaveResponse> {
  const db = getDb()

  // 1. VALIDAR RESPUESTA + (en paralelo) RESOLVER TEMA
  //
  // Performance: cuando el cliente manda tema=0 (test personalizado u
  // oposición ancha), antes el servidor resolvía el tema DESPUÉS de validar
  // via 4 queries secuenciales en resolveTemaByArticle (~180ms + round-trips
  // = 2-3s en prod). Ahora lanzamos el resolver FAST PATH en paralelo con
  // la query de validación, eliminando N round-trips secuenciales.
  //
  // Cuando el cliente ya envía tema > 0 (test de un tema específico), no
  // ejecutamos el resolver — el path es idéntico al anterior y añade 0ms.
  let correctOption: number | null = null
  let explanation: string | null = null
  let articleNumber: string | null = null
  let lawShortName: string | null = null
  let lawName: string | null = null

  // Normalizar oposicionId a un valor conocido (fallback en memoria, sin query)
  const resolvedOposicionId: OposicionId =
    (params.oposicionId && ALL_OPOSICION_IDS.includes(params.oposicionId))
      ? (params.oposicionId as OposicionId)
      : 'auxiliar_administrativo_estado'

  const shouldResolve = shouldResolveTema(params)

  // Validation cacheada (tag 'questions', TTL 1h). Hit ratio altísimo:
  // todos los users que respondan la misma pregunta comparten cache.
  // Invalidación inmediata cuando se resuelve una dispute (cf. resolveDispute
  // en lib/api/v2/dispute/queries.ts).
  const [validation, preResolvedTema] = await Promise.all([
    getQuestionValidationCached(params.questionId),
    shouldResolve
      ? resolveTemaByQuestionIdFast(params.questionId, resolvedOposicionId)
      : Promise.resolve<number | null>(null),
  ])

  if (validation) {
    correctOption = validation.correctOption
    explanation = validation.explanation
    articleNumber = validation.articleNumber
    lawShortName = validation.lawShortName
    lawName = validation.lawName
  }

  if (correctOption === null) {
    return {
      success: false,
      isCorrect: false,
      correctAnswer: 0,
      explanation: null,
      newScore: params.currentScore,
      saveAction: 'save_failed',
    }
  }

  // Respuestas en blanco: isBlank=true → isCorrect=false (no suma score ni
  // se marca como acierto). Se guarda con was_blank=true en test_questions
  // para distinguirlas visualmente en stats (correctas/falladas/blancas).
  const isBlank = !!params.isBlank
  const isCorrect = !isBlank && params.userAnswer === correctOption
  const newScore = isCorrect ? params.currentScore + 1 : params.currentScore

  // Si el resolver encontró tema, lo usamos. Si no, caemos al valor
  // original (probablemente 0), y insertTestAnswer lo dejará en 0.
  // No volvemos a llamar al resolver secuencial — ya tuvo su oportunidad.
  const effectiveTema =
    preResolvedTema !== null && preResolvedTema > 0 ? preResolvedTema : params.tema

  // 2. GUARDAR EN test_questions (reusar insertTestAnswer existente)
  const saveRequest: SaveAnswerRequest = {
    sessionId: params.sessionId,
    questionData: {
      id: params.questionId,
      question: params.questionText,
      options: params.options,
      tema: effectiveTema,
      questionType: params.questionType,
      article: params.article,
      metadata: params.metadata,
      explanation: params.explanation,
    },
    answerData: {
      questionIndex: params.questionIndex,
      // Para blancas, pasamos -1 a selectedAnswer para que insertTestAnswer
      // lo interprete como "sin selección" y lo traduzca al marcador en BD.
      selectedAnswer: isBlank ? -1 : (params.userAnswer as number),
      correctAnswer: correctOption,
      isCorrect,
      timeSpent: params.timeSpent,
      wasBlank: isBlank,
    },
    tema: effectiveTema,
    confidenceLevel: params.confidenceLevel,
    interactionCount: params.interactionCount,
    questionStartTime: params.questionStartTime,
    firstInteractionTime: params.firstInteractionTime,
    interactionEvents: params.interactionEvents as unknown[],
    mouseEvents: params.mouseEvents as unknown[],
    scrollEvents: params.scrollEvents as unknown[],
    deviceInfo: params.deviceInfo,
    oposicionId: params.oposicionId,
  }

  const saveResult = await insertTestAnswer(saveRequest, userId)

  // 3. ACTUALIZAR SCORE (solo si se guardó bien)
  if (saveResult.success) {
    try {
      await db
        .update(tests)
        .set({ score: String(newScore) })
        .where(eq(tests.id, params.sessionId))
    } catch (scoreError) {
      console.error('⚠️ [answer-and-save] Error actualizando score:', scoreError)
      // No fallar por esto — la respuesta se validó y guardó
    }
  }

  const saveAction = saveResult.success
    ? (saveResult.action as 'saved_new' | 'already_saved')
    : 'save_failed'

  if (!saveResult.success) {
    console.error(`❌ [answer-and-save] save_failed questionId=${params.questionId} sessionId=${params.sessionId}: ${saveResult.error}`)
  }

  return {
    success: saveResult.success,
    isCorrect,
    correctAnswer: correctOption,
    explanation,
    articleNumber,
    lawShortName,
    lawName,
    newScore,
    saveAction,
    questionDbId: saveResult.question_id ?? null,
  }
}

// ============================================
// OPERACIONES BACKGROUND (para after())
// ============================================

export async function markActiveStudentIfFirst(userId: string): Promise<void> {
  try {
    const db = getDb()
    const result = await db
      .select({ isActiveStudent: userProfiles.isActiveStudent })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    if (result[0] && !result[0].isActiveStudent) {
      await db
        .update(userProfiles)
        .set({
          isActiveStudent: true,
          firstTestCompletedAt: new Date().toISOString(),
        })
        .where(eq(userProfiles.id, userId))
      invalidateProfileCache()
      console.log('🎯 [after] Usuario marcado como ACTIVO:', userId)
    }
  } catch (error) {
    console.warn('⚠️ [after] Error marcando is_active_student:', error)
  }
}
