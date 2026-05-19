
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { getDb } from '@/db/client'
import { tests, testQuestions, psychometricUserQuestionHistory } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

/**
 * POST /api/v2/official-exams/complete
 *
 * Complete an existing official exam session (created by /init).
 * Updates the test record and test_questions with validation results.
 *
 * IMPORTANT - Scoring vs Learning History:
 *
 * 1. EXAM SCORE (shown to user):
 *    - Correct answers: add points
 *    - Incorrect answers: subtract points (typically 1/3)
 *    - Unanswered (blank): neither add nor subtract
 *    - This follows official Spanish "oposiciones" scoring rules
 *
 * 2. LEARNING HISTORY (internal tracking):
 *    - Correct answers: saved as successes
 *    - Incorrect answers: saved as failures
 *    - Unanswered (blank): saved as FAILURES
 *    - This allows users to review questions they didn't know
 *    - Blank questions appear in "repaso de fallos" for study
 *
 * Request body:
 * - testId: string (UUID) - The test session created by /init
 * - results: array of { questionOrder, isCorrect, correctAnswer, userAnswer }
 * - totalTimeSeconds: number
 *
 * Returns:
 * - success: boolean
 * - testId: string
 * - score: number (percentage of answered questions)
 * - correctCount: number
 * - answeredCount: number
 * - error: string (if failed)
 */
async function _POST(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/complete] Request received')

  try {
    // 1. Verify authentication (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/v2/official-exams/complete')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado - Token requerido' : 'No autorizado - Token inválido' },
        { status: 401 }
      )
    }
    // `user` para compatibilidad con los 11 usos de user.id en el resto del handler
    const user = { id: auth.userId, email: auth.email }

    console.log(`🔒 [API/v2/official-exams/complete] User authenticated: ${user.id}`)

    // 2. Parse request body
    const body = await request.json()
    const { testId, results, totalTimeSeconds } = body

    if (!testId || !results || !Array.isArray(results)) {
      return NextResponse.json(
        { success: false, error: 'testId y results son requeridos' },
        { status: 400 }
      )
    }

    const db = getDb()

    // 3. Verify test ownership and get metadata
    const testResult = await db
      .select({
        id: tests.id,
        userId: tests.userId,
        isCompleted: tests.isCompleted,
        detailedAnalytics: tests.detailedAnalytics,
      })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)

    if (testResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Test no encontrado' },
        { status: 404 }
      )
    }

    const test = testResult[0]

    if (test.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'No tienes acceso a este test' },
        { status: 403 }
      )
    }

    if (test.isCompleted) {
      return NextResponse.json(
        { success: false, error: 'Este test ya está completado' },
        { status: 400 }
      )
    }

    console.log(`📝 [API/v2/official-exams/complete] Completing test ${testId} (${results.length} questions)`)

    // 4. Batch UPDATE de test_questions con UPDATE ... FROM (VALUES ...).
    //
    // Refactor 2026-05-04 (incidente 504 a 300s): el patrón anterior de N
    // UPDATEs secuenciales era O(N) round-trips a Postgres. Con pool max:1
    // y un examen oficial de 100 questions: ~50ms × 100 = 5s mínimo, y bajo
    // contención de pool llegaba a 300s (timeout del endpoint). Los users
    // perdían el examen completado.
    //
    // El UPDATE batch lo hace en 1 query: Postgres planea un Hash Join
    // entre la VALUES inline (small) y test_questions filtrado por test_id
    // (índice por test_id existe). Coste estimado: 1 round-trip + ~50ms
    // server-side independiente de N (hasta el chunk_size).
    //
    // Chunking de 500: límite preventivo de parámetros Postgres (PostgREST
    // permite hasta 32k params; con 4 params/row × 500 rows = 2k params,
    // muy debajo del límite, pero deja margen para crecer y para crear el
    // SQL string sin que se vuelva enorme). Exámenes oficiales reales son
    // 50-200 questions; chunk_size=500 = 1 chunk en práctica casi siempre.
    //
    // Telemetría: log con timing para detectar regresiones.
    const startedUpdate = Date.now()
    const CHUNK_SIZE = 500
    let totalUpdated = 0

    for (let offset = 0; offset < results.length; offset += CHUNK_SIZE) {
      const chunk = results.slice(offset, offset + CHUNK_SIZE)

      const valuesSql = sql.join(
        chunk.map((r: { questionOrder: number; isCorrect?: boolean; correctAnswer?: string; userAnswer?: string; timeSpentSeconds?: number }) =>
          sql`(${r.questionOrder}::int, ${r.isCorrect || false}::boolean, ${r.correctAnswer || ''}::text, ${r.userAnswer || ''}::text, ${Math.max(0, Math.floor(r.timeSpentSeconds ?? 0))}::int)`
        ),
        sql`, `
      )

      // FIX (07-may-2026): NO sobrescribir correct_answer si el cliente lo envía
      // vacío/'?'/'x'. initOfficialExam ya guardó la letra real desde la fuente
      // (questions.correct_option o psychometric_questions.correct_option). Si la
      // ruta del cliente no la pudo resolver (timeout/null en validatePsychometric,
      // pregunta no contestada), el cliente envía placeholder; debemos preservar
      // la letra original. Además recalculamos is_correct server-side con la letra
      // FINAL (post-COALESCE) para no confiar en lo que dice el cliente.
      // Bug original: 17/19 psicotécnicas de Iván Bueno (06-may) marcadas mal.
      //
      // FIX (17-may-2026): añadir time_spent_seconds. Antes el insert en /init
      // ponía 0 hardcoded y /complete nunca lo actualizaba, así que 100% de los
      // simulacros oficiales tenían time_spent_seconds=0 (bug Nila). El cliente
      // ahora envía el tiempo real medido en su sesión. Usamos GREATEST para no
      // machacar valores reales guardados en sesiones previas (resume): si el
      // usuario respondió Q5 en sesión 1 (tracked 18s) y reanuda en sesión 2
      // sin volver a tocar Q5, el cliente envía 0 para Q5 y mantenemos los 18s.
      await db.execute(sql`
        UPDATE test_questions AS tq SET
          user_answer = u.user_answer,
          correct_answer = COALESCE(
            NULLIF(NULLIF(NULLIF(u.correct_answer, ''), '?'), 'x'),
            tq.correct_answer
          ),
          is_correct = (
            u.user_answer IS NOT NULL
            AND u.user_answer != ''
            AND u.user_answer != 'sin_respuesta'
            AND COALESCE(
              NULLIF(NULLIF(NULLIF(u.correct_answer, ''), '?'), 'x'),
              tq.correct_answer
            ) IS NOT NULL
            AND lower(u.user_answer) = lower(COALESCE(
              NULLIF(NULLIF(NULLIF(u.correct_answer, ''), '?'), 'x'),
              tq.correct_answer
            ))
          ),
          time_spent_seconds = GREATEST(u.time_spent_seconds, COALESCE(tq.time_spent_seconds, 0))
        FROM (VALUES ${valuesSql}) AS u(question_order, is_correct, correct_answer, user_answer, time_spent_seconds)
        WHERE tq.test_id = ${testId}::uuid
          AND tq.question_order = u.question_order
      `)

      totalUpdated += chunk.length
    }

    console.log(`✅ [API/v2/official-exams/complete] Batch updated ${totalUpdated} questions in ${Date.now() - startedUpdate}ms (${Math.ceil(results.length / CHUNK_SIZE)} chunk${results.length > CHUNK_SIZE ? 's' : ''})`)

    // 5. Calculate final stats — desde BD post-UPDATE, NO desde el array del cliente.
    // El SQL anterior recalculó is_correct con la letra correcta real (preservada
    // si el cliente envió basura). Si nos fiáramos del flag isCorrect del cliente,
    // tendríamos el mismo bug que reportó Iván: psicotécnicas correctas marcadas
    // mal porque validatePsychometric devolvió null y answerToLetter generó '?'.
    const dbStats = await db
      .select({
        correctCount: sql<number>`COUNT(*) FILTER (WHERE ${testQuestions.isCorrect} = true)::int`,
        answeredCount: sql<number>`COUNT(*) FILTER (WHERE ${testQuestions.userAnswer} IS NOT NULL AND ${testQuestions.userAnswer} != '' AND ${testQuestions.userAnswer} != 'sin_respuesta')::int`,
      })
      .from(testQuestions)
      .where(eq(testQuestions.testId, testId))

    const correctCount = dbStats[0]?.correctCount ?? 0
    const answeredCount = dbStats[0]?.answeredCount ?? 0
    const score = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0

    // 6. Update test record
    // totalQuestions = all questions (unanswered count as failed attempts)
    await db
      .update(tests)
      .set({
        isCompleted: true,
        completedAt: new Date().toISOString(),
        totalQuestions: results.length, // All questions, including unanswered
        score: correctCount.toString(),
        totalTimeSeconds: totalTimeSeconds || 0,
      })
      .where(eq(tests.id, testId))

    console.log(`✅ [API/v2/official-exams/complete] Test completed: ${correctCount}/${answeredCount} (${score}%)`)

    // 7. Update user history for statistics (optional but good for consistency)
    // Get question details from test_questions
    const savedQuestions = await db
      .select({
        questionId: testQuestions.questionId,
        psychometricQuestionId: testQuestions.psychometricQuestionId,
        isCorrect: testQuestions.isCorrect,
        userAnswer: testQuestions.userAnswer,
      })
      .from(testQuestions)
      .where(eq(testQuestions.testId, testId))

    // NOTA 2026-05-19: el UPSERT manual de userQuestionHistory para preguntas legislativas
    // se eliminó porque el trigger BD `trigger_update_user_question_history` (AFTER INSERT
    // OR UPDATE en test_questions) ya mantiene la tabla. Mantener ambos causaba doble
    // contabilización: +74.812 attempts inflados globalmente (medido shadow validation v2).
    // psychometric_user_question_history SÍ requiere upsert manual: no tiene trigger BD.

    // Update psychometric question history
    const psychometricAnswers = savedQuestions.filter(
      q => q.psychometricQuestionId && q.userAnswer && q.userAnswer.trim() !== ''
    )

    for (const answer of psychometricAnswers) {
      const existing = await db
        .select({ id: psychometricUserQuestionHistory.id, attempts: psychometricUserQuestionHistory.attempts, correctAttempts: psychometricUserQuestionHistory.correctAttempts })
        .from(psychometricUserQuestionHistory)
        .where(
          and(
            eq(psychometricUserQuestionHistory.userId, user.id),
            eq(psychometricUserQuestionHistory.questionId, answer.psychometricQuestionId!)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        const record = existing[0]!
        await db
          .update(psychometricUserQuestionHistory)
          .set({
            attempts: (record.attempts ?? 0) + 1,
            correctAttempts: answer.isCorrect ? (record.correctAttempts ?? 0) + 1 : (record.correctAttempts ?? 0),
            lastAttemptAt: new Date().toISOString(),
          })
          .where(eq(psychometricUserQuestionHistory.id, record.id))
      } else {
        await db.insert(psychometricUserQuestionHistory).values({
          userId: user.id,
          questionId: answer.psychometricQuestionId!,
          attempts: 1,
          correctAttempts: answer.isCorrect ? 1 : 0,
          lastAttemptAt: new Date().toISOString(),
        })
      }
    }

    // 8. Register UNANSWERED questions as FAILED in user history
    // This helps users identify questions they need to study
    // NOTA 2026-05-19: el upsert legislativo de blanks también se eliminó. Las preguntas
    // sin responder en simulacro oficial fueron INSERTed en /init con is_correct=false (ver
    // initOfficialExam línea 814). El trigger BD ya las cuenta como attempts con correct=0,
    // que es exactamente lo que hacía este bloque manualmente. Eliminar = sin pérdida de
    // funcionalidad + fix doble contabilización.

    const unansweredPsychometric = savedQuestions.filter(
      q => q.psychometricQuestionId && (!q.userAnswer || q.userAnswer.trim() === '')
    )

    for (const answer of unansweredPsychometric) {
      const existing = await db
        .select({ id: psychometricUserQuestionHistory.id, attempts: psychometricUserQuestionHistory.attempts, correctAttempts: psychometricUserQuestionHistory.correctAttempts })
        .from(psychometricUserQuestionHistory)
        .where(
          and(
            eq(psychometricUserQuestionHistory.userId, user.id),
            eq(psychometricUserQuestionHistory.questionId, answer.psychometricQuestionId!)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        const record = existing[0]!
        await db
          .update(psychometricUserQuestionHistory)
          .set({
            attempts: (record.attempts ?? 0) + 1,
            // correctAttempts stays the same (unanswered = failed)
            lastAttemptAt: new Date().toISOString(),
          })
          .where(eq(psychometricUserQuestionHistory.id, record.id))
      } else {
        await db.insert(psychometricUserQuestionHistory).values({
          userId: user.id,
          questionId: answer.psychometricQuestionId!,
          attempts: 1,
          correctAttempts: 0, // Unanswered = failed
          lastAttemptAt: new Date().toISOString(),
        })
      }
    }

    console.log(`✅ [API/v2/official-exams/complete] History updated: ${psychometricAnswers.length} psy answered, ${unansweredPsychometric.length} psy unanswered (as failed). Legislativas las mantiene trigger BD.`)

    // Invalidar cache de pending exams: el test acaba de completarse, ya no
    // debe aparecer como pendiente en el Header.
    after(async () => {
      try {
        const { invalidateMany } = await import('@/lib/cache/redis')
        await invalidateMany([
          `exam_pending:${user.id}:all:10`,
          `exam_pending:${user.id}:exam:10`,
          `exam_pending:${user.id}:practice:10`,
        ])
      } catch {
        // Si Redis falla, el TTL eventualmente refresca el valor stale
      }
    })

    return NextResponse.json({
      success: true,
      testId,
      score,
      correctCount,
      answeredCount,
    })
  } catch (error) {
    console.error('❌ [API/v2/official-exams/complete] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/v2/official-exams/complete', _POST)
