// app/api/exam/validate/route.ts
// API para validar todas las respuestas de un examen de forma segura
// La respuesta correcta SOLO se revela después de que el usuario envía sus respuestas
// 🔴 FIX: Ahora también marca el test como completado para evitar "exámenes fantasma"

import { NextRequest, NextResponse } from 'next/server'

// Exámenes batch pueden tener 100+ preguntas, dar tiempo suficiente
export const maxDuration = 60

import { getDb } from '@/db/client'
import { questions, tests, testQuestions } from '@/db/schema'
import { inArray, eq, and, sql } from 'drizzle-orm'
import { z } from 'zod/v3'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { incrementDailyCount } from '@/lib/api/dailyLimit'
import { getSink } from '@/lib/observability/sink'
import {
  summarizeDbScore,
  overlayResultsWithDb,
  indexDbRowsByQuestionId,
  scoreDivergence,
  type DbAnswerRow,
} from '@/lib/api/exam/reconcile'
// Trazo anti-cosecha (auditoría 27/07/2026). Este endpoint revela clave +
// explicación de cualquier questionId, y cuando la llamada NO trae testId no
// persiste nada → hasta ahora una cosecha por aquí no dejaba NINGÚN rastro.
// No bloquea ni cambia la UX: solo cuenta y traza. Ver lib/api/exam/validateShape.ts.
import { classifyValidateCall } from '@/lib/api/exam/validateShape'
import { MAX_QUESTIONS_PER_REQUEST } from '@/lib/api/filtered-questions/schemas'
import { emit } from '@/lib/observability/emit'
import { getClientIp } from '@/lib/api/rateLimit'
import { getDeviceIdFromRequest, getHwFingerprintFromRequest, registerAndCheckDevice } from '@/lib/api/deviceLimit'
import { isSyntheticRequest } from '@/lib/api/syntheticRequest'
import { verifyAuthOptional } from '@/lib/api/auth/verifyAuth'
import { isCaptchaEnabled } from '@/lib/security/captcha'
import {
  gateSubjects,
  recordServedForSubjects,
} from '@/lib/security/challengePolicy/questionsServed'
import { getTestOwnerId } from '@/lib/api/exam'
import { requireDuenoDelRecurso } from '@/lib/api/shared/auth'

const ENDPOINT = '/api/exam/validate'
// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const examAnswerSchema = z.object({
  questionId: z.string().uuid('ID de pregunta inválido'),
  userAnswer: z.string().length(1).nullable(), // 'a', 'b', 'c', 'd' o null
  // Campos de enriquecimiento OPCIONALES (additivos): el cliente los manda para
  // que validate persista las filas de test_questions en bloque (fiable) en vez
  // de depender de ~50 saves fire-and-forget durante el examen. Si no llegan, el
  // servidor rellena lo que puede desde la tabla questions.
  questionOrder: z.number().int().min(1).optional(),
  questionText: z.string().optional(),
  articleId: z.string().uuid().nullable().optional(),
  articleNumber: z.string().nullable().optional(),
  lawName: z.string().nullable().optional(),
  temaNumber: z.number().int().nullable().optional(),
  difficulty: z.string().nullable().optional(),
})

const validateExamRequestSchema = z.object({
  testId: z.string().uuid('ID de test inválido').optional(), // 🔴 FIX: Ahora acepta testId para marcar como completado
  // TOPE DE LOTE (27/07/2026). Antes solo había `.min(1)`: una sola petición podía
  // pedir la corrección —clave + explicación— de decenas de miles de preguntas.
  // El tope es el MISMO que el de generación (MAX_QUESTIONS_PER_REQUEST): más de
  // lo que se puede generar no puede venir de un examen real, y atarlos a una
  // única constante impide que diverjan y acaben rechazando exámenes legítimos.
  answers: z.array(examAnswerSchema)
    .min(1, 'Debe haber al menos una respuesta')
    .max(MAX_QUESTIONS_PER_REQUEST, `Un examen no puede tener más de ${MAX_QUESTIONS_PER_REQUEST} preguntas`)
})

type ExamAnswer = z.infer<typeof examAnswerSchema>

// ============================================
// FUNCIÓN PARA MARCAR TEST COMO COMPLETADO
// ============================================

async function markTestAsCompleted(testId: string, score: number, totalQuestions: number) {
  try {
    const db = getDb()

    await db
      .update(tests)
      .set({
        isCompleted: true,
        completedAt: new Date().toISOString(),
        score: score.toString(),
        totalQuestions: totalQuestions
      })
      .where(eq(tests.id, testId))

    console.log('✅ [API/exam/validate] Test marcado como completado:', testId)
    return true
  } catch (error) {
    console.error('❌ [API/exam/validate] Error marcando test como completado:', error)
    return false
  }
}

// ============================================
// PERSISTENCIA EN BLOQUE DE test_questions
// ============================================
//
// Escribe TODAS las preguntas del examen (respondidas + en blanco) en una sola
// query UPSERT. Idempotente vía constraint (test_id, question_order): si los
// saves en tiempo real (resume) ya escribieron alguna fila, se actualiza.
//
// Robustez: si esto falla, se loguea pero NO se aborta validate — el usuario
// debe ver su nota igualmente (score/results vienen de memoria del servidor).
// La pérdida de filas degradaría solo el detalle por-pregunta de /revisar.
type ValidatedResult = {
  questionId: string
  userAnswer: string | null
  correctAnswer: string
  correctIndex: number
  isCorrect: boolean
}
type QuestionMeta = {
  correct: number
  explanation: string | null
  questionText: string
  difficulty: string | null
  primaryArticleId: string | null
}

async function persistExamQuestions(
  testId: string,
  answers: ExamAnswer[],
  results: ValidatedResult[],
  metaMap: Map<string, QuestionMeta>
): Promise<{ userId: string | null; nuevasRespondidas: number }> {
  try {
    const db = getDb()

    // userId del test (para poblar test_questions.user_id como hacen los saves directos)
    const testRow = await db
      .select({ userId: tests.userId })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)
    const userId = testRow[0]?.userId ?? null

    // Construir filas. Se omiten preguntas no encontradas en BD (correctIndex -1):
    // son edge-cases (preguntas retiradas) y no tienen metadatos válidos.
    const rows = results
      .map((r, i) => {
        if (r.correctIndex < 0) return null
        const meta = metaMap.get(r.questionId)
        if (!meta) return null
        // Campos de enriquecimiento del cliente (additivos); fallback al servidor.
        const clientAnswer = answers[i]
        const answered = r.userAnswer != null && r.userAnswer !== ''
        return {
          testId,
          userId,
          questionId: r.questionId,
          articleId: clientAnswer?.articleId ?? meta.primaryArticleId ?? null,
          questionOrder: clientAnswer?.questionOrder ?? i + 1,
          questionText: clientAnswer?.questionText || meta.questionText || '',
          userAnswer: r.userAnswer ?? '',
          correctAnswer: r.correctAnswer,
          isCorrect: r.isCorrect,
          articleNumber: clientAnswer?.articleNumber ?? null,
          lawName: clientAnswer?.lawName ?? null,
          temaNumber: clientAnswer?.temaNumber ?? null,
          difficulty: clientAnswer?.difficulty ?? meta.difficulty ?? null,
          wasBlank: !answered,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (rows.length === 0) return { userId, nuevasRespondidas: 0 }

    // CUPO (T-450): se cuenta ANTES del upsert cuántas de las respuestas que entran
    // estrenan fila —o rellenan una que estaba en blanco—, porque ese es el mismo criterio
    // que usa `answer-and-save` para cobrar: se cobra lo que se PERSISTE por primera vez.
    // Medirlo antes es lo que da la idempotencia sin tabla extra: un `validate` reenviado
    // encuentra las filas ya respondidas y cobra 0. Es exactamente la condición que el
    // propio UPSERT de abajo aplica para decidir si escribe, leída un instante antes.
    const ordenesConRespuesta = rows.filter((r) => !r.wasBlank).map((r) => r.questionOrder)
    let nuevasRespondidas = 0
    if (ordenesConRespuesta.length > 0) {
      const yaRespondidas = await db
        .select({ questionOrder: testQuestions.questionOrder })
        .from(testQuestions)
        .where(and(
          eq(testQuestions.testId, testId),
          inArray(testQuestions.questionOrder, ordenesConRespuesta),
          sql`${testQuestions.userAnswer} IS NOT NULL AND ${testQuestions.userAnswer} <> ''`,
        ))
      nuevasRespondidas = ordenesConRespuesta.length - yaRespondidas.length
    }

    // UPSERT en bloque sobre la constraint única (test_id, question_order).
    //
    // NO-DESTRUCTIVO: si la fila ya tiene una respuesta NO blanca (la escribió un
    // save realtime, que empareja questionId↔respuesta en el servidor y es fiable
    // por construcción), se CONSERVA — el batch va indexado por posición y puede
    // venir desalineado (caso Isabel 16/06: batch 0/71 con la BD en 62/71). El
    // batch solo RELLENA filas en blanco (o inexistentes → INSERT). `correct_answer`
    // se refresca siempre: es la clave del servidor, nunca depende del cliente.
    await db
      .insert(testQuestions)
      .values(rows)
      .onConflictDoUpdate({
        target: [testQuestions.testId, testQuestions.questionOrder],
        set: {
          userAnswer: sql`CASE WHEN ${testQuestions.userAnswer} IS NULL OR ${testQuestions.userAnswer} = '' THEN excluded.user_answer ELSE ${testQuestions.userAnswer} END`,
          correctAnswer: sql`excluded.correct_answer`,
          isCorrect: sql`CASE WHEN ${testQuestions.userAnswer} IS NULL OR ${testQuestions.userAnswer} = '' THEN excluded.is_correct ELSE ${testQuestions.isCorrect} END`,
          wasBlank: sql`CASE WHEN ${testQuestions.userAnswer} IS NULL OR ${testQuestions.userAnswer} = '' THEN excluded.was_blank ELSE ${testQuestions.wasBlank} END`,
        },
      })

    console.log(`✅ [API/exam/validate] ${rows.length} filas persistidas en test_questions (bulk) para test ${testId} · ${nuevasRespondidas} respuesta(s) nuevas a efectos de cupo`)
    return { userId, nuevasRespondidas }
  } catch (error) {
    // No abortamos validate: el usuario debe ver su nota igualmente.
    console.error('❌ [API/exam/validate] Error persistiendo test_questions en bloque:', error)
    // Si no se ha podido persistir, NO se cobra: nunca se le cobra al usuario cupo por
    // respuestas que no han quedado guardadas (misma regla que `save_failed`).
    return { userId: null, nuevasRespondidas: 0 }
  }
}

// ============================================
// FUNCIÓN DE VALIDACIÓN
// ============================================

async function validateExamAnswers(answers: ExamAnswer[], testId?: string) {
  try {
    const db = getDb()

    // Obtener IDs de preguntas
    const questionIds = answers
      .map(a => a.questionId)
      .filter((id): id is string => id !== null)

    if (questionIds.length === 0) {
      return {
        success: false,
        error: 'No hay preguntas válidas para validar'
      }
    }

    // Consultar respuestas correctas de la BD (+ campos core para persistir
    // test_questions de forma fiable en bloque al final del examen)
    const dbQuestions = await db
      .select({
        id: questions.id,
        correctOption: questions.correctOption,
        explanation: questions.explanation,
        questionText: questions.questionText,
        difficulty: questions.difficulty,
        primaryArticleId: questions.primaryArticleId
      })
      .from(questions)
      .where(inArray(questions.id, questionIds))

    // Crear mapa de respuestas correctas (+ metadatos core de cada pregunta)
    const correctAnswersMap = new Map<string, {
      correct: number
      explanation: string | null
      questionText: string
      difficulty: string | null
      primaryArticleId: string | null
    }>()
    for (const q of dbQuestions) {
      correctAnswersMap.set(q.id, {
        correct: q.correctOption,
        explanation: q.explanation,
        questionText: q.questionText,
        difficulty: q.difficulty,
        primaryArticleId: q.primaryArticleId
      })
    }

    // Validar cada respuesta
    const results: Array<{
      questionId: string
      userAnswer: string | null
      correctAnswer: string
      correctIndex: number
      isCorrect: boolean
      explanation: string | null
    }> = []

    let totalCorrect = 0
    let totalAnswered = 0

    for (const answer of answers) {
      const questionData = correctAnswersMap.get(answer.questionId)

      if (!questionData) {
        // Pregunta no encontrada - marcar como incorrecta
        results.push({
          questionId: answer.questionId,
          userAnswer: answer.userAnswer,
          correctAnswer: '?',
          correctIndex: -1,
          isCorrect: false,
          explanation: null
        })
        continue
      }

      const correctIndex = questionData.correct
      const correctLetter = String.fromCharCode(97 + correctIndex) // 0='a', 1='b', etc.
      const isCorrect = answer.userAnswer?.toLowerCase() === correctLetter

      if (answer.userAnswer) {
        totalAnswered++
      }

      if (isCorrect) {
        totalCorrect++
      }

      results.push({
        questionId: answer.questionId,
        userAnswer: answer.userAnswer,
        correctAnswer: correctLetter,
        correctIndex: correctIndex,
        isCorrect,
        explanation: questionData.explanation
      })
    }

    const totalQuestions = answers.length
    const percentage = totalQuestions > 0
      ? Math.round((totalCorrect / totalQuestions) * 100)
      : 0

    console.log('✅ [API/exam/validate] Examen validado:', {
      totalQuestions,
      totalAnswered,
      totalCorrect,
      percentage,
      testId: testId || 'no proporcionado'
    })

    // 🔴 Persistencia autoritativa: validate recibe TODAS las respuestas de una
    // vez, así que escribe las filas de test_questions en bloque (1 query) en vez
    // de depender de ~50 saves fire-and-forget durante el examen (poco fiables
    // bajo carga → filas perdidas, bug 30/40 exámenes 08/06). markTestAsCompleted
    // fija score/total DESPUÉS, con la vista completa.
    //
    // La nota mostrada y el detalle por-pregunta se derivan de la BD (fuente
    // autoritativa), NO del batch indexado por posición que puede desalinearse.
    if (testId) {
      const persistencia = await persistExamQuestions(testId, answers, results, correctAnswersMap)

      // ── CUPO DIARIO (T-450) — LA RED, no el cobro principal ────────────────────────
      // El modo examen NO pasa por `answer-and-save`, que es quien cobra el cupo desde el
      // 29/07. Al mover el cobro del cliente al servidor —con razón: cobrar desde el
      // cliente lo desacoplaba del guardado y no era idempotente— este camino se quedó
      // SIN NADIE QUE COBRE, y un free pasó a tener barra libre por exámenes. Medido:
      // 10.181 respuestas en 7 días sin llegar al contador, y un usuario con 489 en 4
      // días mientras el contador marcaba ~65.
      //
      // ⚠️ EL COBRO PRINCIPAL DEL EXAMEN NO ESTÁ AQUÍ: está en `/api/exam/answer`, que es
      // quien persiste cada respuesta EN VIVO durante el examen. Este cobro se desplegó
      // primero él solo (01/08, 08:47 UTC) y resultó INERTE: para cuando `validate` corre,
      // las respuestas ya están escritas, así que `nuevasRespondidas` es 0. Verificado con
      // el primer examen real posterior al deploy — 10 respuestas escritas entre las
      // 09:00:42 y las 09:04:30, `validate` a las 09:04:32, contador sin una sola fila.
      //
      // Lo que queda aquí es la RED, y sigue haciendo falta: `validate` es el único que ve
      // las respuestas que los saves en vivo NO consiguieron guardar (fire-and-forget, poco
      // fiables bajo carga: 30/40 exámenes con filas perdidas el 08/06). Esas son las que
      // «estrena» al persistir en bloque, y son justo las que nadie ha cobrado todavía.
      // Los dos cobros NO se solapan por construcción: la condición que decide aquí
      // —fila sin respuesta— es la negación exacta de la que decide allí.
      //
      // Se cobra con IMPORTE en una sola llamada, no una por respuesta (~50 idas y vueltas
      // en un camino donde el usuario está esperando su nota).
      //
      // Fail-silent y con `.catch`: el cobro del cupo NUNCA puede tumbar un examen que el
      // usuario ya ha terminado. Si falla, se lleva las preguntas gratis.
      if (persistencia.userId && persistencia.nuevasRespondidas > 0) {
        await incrementDailyCount(persistencia.userId, persistencia.nuevasRespondidas)
          .catch(() => {})
      }

      // Re-leer el estado autoritativo (incluye lo que escribieron los saves
      // realtime + lo que rellenó el persist) y recomputar la nota desde ahí.
      const dbRows: DbAnswerRow[] = (await db
        .select({
          questionId: testQuestions.questionId,
          userAnswer: testQuestions.userAnswer,
          isCorrect: testQuestions.isCorrect,
        })
        .from(testQuestions)
        .where(eq(testQuestions.testId, testId)))
        .map(r => ({ questionId: r.questionId, userAnswer: r.userAnswer ?? '', isCorrect: !!r.isCorrect }))

      const authSummary = summarizeDbScore(dbRows, totalQuestions)
      const authResults = overlayResultsWithDb(results, indexDbRowsByQuestionId(dbRows))
      const divergence = scoreDivergence(totalCorrect, authSummary.totalCorrect)

      const completed = await markTestAsCompleted(testId, authSummary.totalCorrect, totalQuestions)
      if (!completed) {
        console.warn('⚠️ [API/exam/validate] No se pudo marcar el test como completado, pero continuamos')
      }

      // 📡 Observabilidad: la nota que el cliente calculó (batch) diverge de la
      // autoritativa (BD) → desalineado/corrupción del estado del cliente. Es la
      // señal que habría cazado el caso Isabel (pantalla 0, BD 62). Resiliente:
      // el sink nunca propaga errores.
      if (divergence.diverged) {
        console.warn('⚠️ [API/exam/validate] Divergencia de nota batch vs BD:', {
          testId, payloadCorrect: totalCorrect, dbCorrect: authSummary.totalCorrect, delta: divergence.delta,
        })
        await getSink().emit({
          source: 'vercel',
          severity: 'warn',
          eventType: 'exam_score_divergence',
          endpoint: '/api/exam/validate',
          deployVersion: process.env.GIT_COMMIT_SHA?.slice(0, 8) ?? null,
          metadata: {
            testId,
            payloadCorrect: totalCorrect,
            dbCorrect: authSummary.totalCorrect,
            delta: divergence.delta,
            payloadAnswered: totalAnswered,
            dbAnswered: authSummary.totalAnswered,
            totalQuestions,
          },
        })
      }

      return {
        success: true,
        results: authResults,
        summary: {
          totalQuestions: authSummary.totalQuestions,
          totalAnswered: authSummary.totalAnswered,
          totalCorrect: authSummary.totalCorrect,
          totalIncorrect: authSummary.totalQuestions - authSummary.totalCorrect,
          percentage: authSummary.percentage,
        },
      }
    }

    // Sin testId (anónimo / sin sesión): no hay BD autoritativa, se devuelve la
    // validación del batch tal cual (comportamiento previo).
    return {
      success: true,
      results,
      summary: {
        totalQuestions,
        totalAnswered,
        totalCorrect,
        totalIncorrect: totalQuestions - totalCorrect,
        percentage
      }
    }

  } catch (error) {
    console.error('❌ [API/exam/validate] Error:', error)
return {
      success: false,
      error: 'Error interno validando examen'
    }
  }
}

// ============================================
// TRAZO ANTI-COSECHA
// ============================================
//
// Este endpoint entrega clave + explicación de cada pregunta del lote. Es el
// activo caro y hasta ahora se podía pedir sin dejar huella (sin `testId` no se
// escribe ni una fila). Aquí NO se bloquea nada — se hace visible:
//
//   1. `observable_events`: un evento por llamada, con el sujeto (usuario/IP/
//      dispositivo) y la FORMA de la llamada (ver validateShape.ts). Es el
//      rastro que antes no existía.
//   2. Contador de servidas: alimenta el MISMO gate anti-scraping que ya
//      protege /api/questions/filtered, en vez de montar un contador aparte.
//      Sin coste para el usuario real: el gate solo reta por encima de 500/día
//      y el examen más grande son 110 preguntas.
//
// `await` en el emit a propósito: es un trazo de seguridad y no puede ser
// lossy. `emitFireAndForget` dentro de un flujo que awaita otras operaciones
// perdía eventos (incidente 47% del 26/05/2026, ver lib/observability/emit.ts).
//
// Pero el `await` va ACOTADO: el sink ya corta a 5s y nunca lanza, y aun así 5s
// colgados en el camino por el que un opositor recibe su nota son inaceptables.
// Con el tope de abajo, el peor caso que puede añadir el trazo es TRACE_BUDGET_MS
// (el emit sigue en segundo plano y normalmente acaba entrando igual).
const TRACE_BUDGET_MS = 1_500

async function traceValidateCall(
  request: NextRequest,
  args: { batchSize: number; answeredCount: number; testId?: string; rejected?: string },
): Promise<void> {
  try {
    const ip = getClientIp(request)
    const deviceId = getDeviceIdFromRequest(request)
    const synthetic = isSyntheticRequest(request)
    let userId: string | null = null
    try {
      userId = (await verifyAuthOptional(request, '/api/exam/validate'))?.userId ?? null
    } catch { /* el trazo nunca depende de que la auth resuelva */ }

    // La identidad se resuelve ANTES de clasificar: sin saber si hay sesión, un
    // examen anónimo (que no puede traer testId) era indistinguible de un cliente
    // logueado que se lo salta. Ver la nota de calibración en validateShape.ts.
    const shape = classifyValidateCall({
      batchSize: args.batchSize,
      answeredCount: args.answeredCount,
      hasTestId: Boolean(args.testId),
      authenticated: Boolean(userId),
    })
    // Petición RECHAZADA (payload inválido, o lote por encima del tope). Antes esto
    // solo dejaba un `request_completed` de severidad info —que además está en la
    // lista de señales benignas del panel—, así que las peticiones MÁS agresivas
    // eran las peor trazadas. Ahora tienen evento propio y severidad real.
    const eventType = args.rejected ? 'exam_validate_rejected' : 'exam_validate_served'
    const severity = args.rejected
      ? (args.batchSize > MAX_QUESTIONS_PER_REQUEST ? 'error' : 'warn')
      : shape.severity

    const emitted = emit({
      source: 'vercel',
      severity,
      eventType,
      endpoint: '/api/exam/validate',
      userId: userId ?? undefined,
      metadata: {
        shape: args.rejected ? 'rejected' : shape.shape,
        rejectedReason: args.rejected ?? null,
        reasons: shape.reasons,
        batchSize: args.batchSize,
        answeredCount: args.answeredCount,
        hasTestId: Boolean(args.testId),
        ip,
        deviceId: deviceId ?? null,
        authenticated: Boolean(userId),
        synthetic,
      },
    })
    let budget: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      emitted.finally(() => { if (budget) clearTimeout(budget) }),
      new Promise<void>((resolve) => { budget = setTimeout(resolve, TRACE_BUDGET_MS) }),
    ])

    // Canaries/smoke fuera del contador (mismo criterio que /api/questions/filtered:
    // es monitorización interna, no consumo real).
    //
    // NO se guarda por `isCaptchaEnabled()`: ese flag apaga el RETO al usuario, no
    // la medición. Compartir interruptor significaba que un rollback de la capa de
    // captcha dejaba la detección de cosecha ciega sin que nadie se enterara.
    //
    // Y NUNCA en el path de rechazo: ahí no se sirvió ni una pregunta. Contarlas
    // inflaría `daily_questions_served` con intentos fallidos y corrompería el
    // ratio respondidas/servidas del que vive el detector de cosecha — un lote
    // rechazado de 5.000 falsearía el denominador de golpe.
    if (!args.rejected && !synthetic && args.batchSize > 0) {
      recordServedForSubjects(gateSubjects(userId, deviceId, ip), args.batchSize).catch(() => {})

      // [T-454] REGISTRAR el dispositivo, que es lo único que este camino no hacía.
      //
      // De los cuatro endpoints por los que se responde una pregunta, tres llaman a
      // `registerAndCheckDevice` y este no: leía el `device_id` para el contador de arriba
      // y lo tiraba. Resultado: quien solo hace exámenes **no existe** en `user_devices`
      // —39 usuarios en 7 días, uno con 70 respuestas en un minuto— y con él se quedan
      // ciegos el sweep de fraude, el límite de dispositivos y el anti-autoreferido.
      //
      // ⚠️ Se REGISTRA pero NO se hace cumplir el límite: el veredicto `allowed` se ignora
      // a propósito. En los otros caminos bloquear es aceptable porque se corrige pregunta
      // a pregunta; aquí `validate` es el FINAL de un examen entero, y cortar en este punto
      // le tiraría al opositor el trabajo de una hora. Es la misma separación que ya hace
      // `resolverAnclaDispositivo` con el ancla derivada de la huella: ganar visibilidad no
      // puede costarle el servicio a nadie.
      //
      // Va dentro del `try` del trazo y con `.catch()`: esta función existe bajo la regla de
      // que la observabilidad degradada nunca rompe la nota del opositor.
      if (userId) {
        registerAndCheckDevice(userId, deviceId, request.headers.get('user-agent'), getHwFingerprintFromRequest(request))
          .catch(() => {})
      }
    }
  } catch (err) {
    // Observabilidad degradada NUNCA rompe la nota del opositor.
    console.warn('⚠️ [API/exam/validate] trazo no registrado:', (err as Error)?.message)
  }
}

// ============================================
// ENDPOINT POST
// ============================================

async function _POST(request: NextRequest) {
  const startTime = Date.now()
  let body: Record<string, unknown> | undefined

  try {
    body = await request.json()

    // Validar request con Zod
    const validation = validateExamRequestSchema.safeParse(body)

    if (!validation.success) {
      console.error('❌ [API/exam/validate] Validación fallida:', validation.error.flatten())
      // El rechazo TAMBIÉN deja rastro. `answers` puede no ser array (payload
      // basura), así que el tamaño se lee a la defensiva.
      const rawAnswers = (body as { answers?: unknown } | undefined)?.answers
      await traceValidateCall(request, {
        batchSize: Array.isArray(rawAnswers) ? rawAnswers.length : 0,
        answeredCount: 0,
        rejected: validation.error.issues[0]?.code ?? 'invalid_payload',
      })
return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validation.error.flatten()
        },
        { status: 400 }
      )
    }

    // Trazo ANTES de revelar: si la corrección peta a mitad, el intento ya
    // quedó registrado. El coste es un INSERT por examen (no por pregunta).
    await traceValidateCall(request, {
      batchSize: validation.data.answers.length,
      answeredCount: validation.data.answers.filter(a => a.userAnswer != null).length,
      testId: validation.data.testId,
    })

    // [T-565]: con `testId`, esto persistía las respuestas en bloque, marcaba el test
    // como completado y subía el cupo diario del DUEÑO DEL TEST (`persistExamQuestions`
    // lo lee de la fila) — sin comprobar que quien llama sea ese dueño. Con solo el
    // UUID de un test ajeno se podía forzar su corrección, completarlo y gastarle cupo.
    // Sin testId (examen sin persistir) no hay recurso ajeno que proteger.
    if (validation.data.testId) {
      const testOwnerId = await getTestOwnerId(validation.data.testId)
      const identidad = await requireDuenoDelRecurso(request, ENDPOINT, testOwnerId)
      if (!identidad.ok) return identidad.response
    }

    // Validar examen y marcar como completado si se proporcionó testId
    const result = await validateExamAnswers(validation.data.answers, validation.data.testId)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 400 }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/exam/validate] Error:', error)
return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

// Bloquear GET para evitar exposición accidental
async function _GET() {
  return NextResponse.json(
    { error: 'Método no permitido. Usa POST.' },
    { status: 405 }
  )
}

export const POST = withErrorLogging('/api/exam/validate', _POST)
export const GET = withErrorLogging('/api/exam/validate', _GET)
