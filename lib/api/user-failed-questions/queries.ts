// lib/api/user-failed-questions/queries.ts - Queries Drizzle para preguntas falladas del usuario
// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
// READ REPLICA (2026-05-17): migrado a getReadDb() — aísla la query de 5-way
// JOIN sobre test_questions del primary. Antes podía colgar el pool max:1 y
// arrastrar en cascada a daily-limit/topics/medals (cascade reproducido en
// logs 20:58-21:00 UTC del 17/05, user 8201a5d2 con Ley 39/2015). Same
// pattern as notifications/queries.ts, ranking/queries.ts, etc.
// Reversible con env USE_READ_REPLICA=false (fallback automático a primary
// vía getReadDb()).
import { getReadDb, getPoolerDb } from '@/db/client'

function getUserFailedDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getReadDb()
}
import { questions, articles, laws, testQuestions, topics, topicScope, userProfiles } from '@/db/schema'
import { eq, and, inArray, desc, gte, gt, isNull, sql } from 'drizzle-orm'
import { articleInScope } from '@/lib/api/_shared/topicScopeSql'
import type {
  GetUserFailedQuestionsRequest,
  GetUserFailedQuestionsResponse,
  FailedQuestionItem,
  FailedByTopicItem,
} from './schemas'
import { isBlankAnswer } from './blank'

// ============================================
// OBTENER PREGUNTAS FALLADAS DEL USUARIO
// ============================================
export async function getUserFailedQuestions(
  params: GetUserFailedQuestionsRequest
): Promise<GetUserFailedQuestionsResponse> {
  try {
    const db = getUserFailedDb()
    const { userId, topicNumber, selectedLaws, since } = params

    console.log(`🔍 [v2] Cargando preguntas falladas para usuario ${userId.substring(0, 8)}...`)

    // Si no hay ni tema ni leyes, no podemos filtrar (validación previa al pre-resolver)
    if (!topicNumber && (!selectedLaws || selectedLaws.length === 0)) {
      return {
        success: false,
        error: 'Debe especificar un tema o leyes para buscar preguntas falladas',
      }
    }

    // Pre-resolver article_ids de las leyes seleccionadas — preserva la
    // semántica original (filtrar por ley vigente, no por `tq.law_name`
    // denormalizado que puede tener drift histórico). El `WHERE article_id IN
    // (...)` en la query principal es índice-friendly y evita los 3 JOINs
    // que rompían al planner con LIMIT + ORDER BY.
    let allowedArticleIds: string[] | null = null
    if (selectedLaws && selectedLaws.length > 0) {
      const articleRows = await db
        .select({ id: articles.id })
        .from(articles)
        .innerJoin(laws, eq(articles.lawId, laws.id))
        .where(inArray(laws.shortName, selectedLaws))
      allowedArticleIds = articleRows.map((r) => r.id)
      if (allowedArticleIds.length === 0) {
        return { success: true, totalQuestions: 0, totalFailures: 0, questions: [] }
      }
    }

    // 🎯 Pre-resolver article_ids dentro del scope del usuario (caso Cristina
    // 26/05/2026, dispute cluster c7196843). ANTES: este endpoint solo
    // filtraba por tq.user_id + isCorrect=false + tema_number. Tras un cambio
    // de oposición (Cristina: Estado→CyL el 25/05), el histórico mantiene
    // tema_number del scope anterior y se servían IDs out-of-scope.
    //
    // Fix: resolver positionType desde user_profiles.target_oposicion y
    // computar la intersección (law_id, article_number) ∈ topic_scope del
    // positionType (filtrada por topic_number si se solicita). Si la
    // oposición no tiene scopes (celador_sescam_clm — caso Lidia 18/04),
    // fallback legacy sin filtro de scope.
    const profile = await db
      .select({ targetOposicion: userProfiles.targetOposicion })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)
    const positionType = profile[0]?.targetOposicion?.trim() || null

    let scopeArticleIds: string[] | null = null
    if (positionType) {
      const scopeConditions = [eq(topics.positionType, positionType)]
      if (topicNumber) {
        scopeConditions.push(eq(topics.topicNumber, topicNumber))
      }
      // article_number en topic_scope es text[]; en articles es text. Cross-join
      // LATERAL unnest evita el ANY() que rompía el planner (incidente
      // 2026-05-04 con Seq Scan de articles 41k rows).
      const inScope = await db
        .select({ id: articles.id })
        .from(articles)
        .innerJoin(
          topicScope,
          and(
            eq(topicScope.lawId, articles.lawId),
            // article_numbers NULL = toda la ley (helper canónico, no `= ANY` suelto)
            articleInScope(articles.articleNumber, topicScope.articleNumbers),
          ),
        )
        .innerJoin(topics, eq(topics.id, topicScope.topicId))
        .where(and(...scopeConditions))
      const ids = [...new Set(inScope.map((r) => r.id))]
      // hasScopes=false (oposición sin topic_scope configurado, p.ej. celador_sescam_clm)
      // → no filtramos por scope; preservamos comportamiento legacy.
      if (ids.length > 0) {
        scopeArticleIds = ids
      } else {
        console.warn(`⚠️ [user-failed] positionType="${positionType}"${topicNumber ? ` topic=${topicNumber}` : ''} sin topic_scope — fallback sin scope`)
      }
    }

    // Intersección selectedLaws × scope si ambos están presentes.
    if (allowedArticleIds && scopeArticleIds) {
      const scopeSet = new Set(scopeArticleIds)
      allowedArticleIds = allowedArticleIds.filter((id) => scopeSet.has(id))
      if (allowedArticleIds.length === 0) {
        return { success: true, totalQuestions: 0, totalFailures: 0, questions: [] }
      }
    } else if (!allowedArticleIds && scopeArticleIds) {
      allowedArticleIds = scopeArticleIds
    }

    // Construir condiciones de filtro sobre test_questions (user_id, law_name,
    // article_number, question_text, difficulty vienen denormalizados).
    const conditions = [
      eq(testQuestions.userId, userId),
      eq(testQuestions.isCorrect, false),
      eq(questions.isActive, true),
      // Excluir preguntas de casos prácticos (exam_case_id): el contexto narrativo
      // solo se renderiza en OfficialExamLayout. Si el usuario falló una pregunta
      // de caso práctico en el examen oficial, debe repasarla en ese contexto, no
      // como pregunta aislada sin el caso narrativo.
      isNull(questions.examCaseId),
    ]

    // El tema se acota por ARTÍCULO vía topic_scope (scopeArticleIds, derivado
    // arriba del topic_number solicitado): es cross-oposición-correcto y no
    // depende del tema. El `tema_number` GUARDADO queda congelado a la oposición
    // activa al responder, así que usarlo como filtro da FALSOS NEGATIVOS cuando
    // el usuario estudia contenido compartido bajo otra oposición (bug María
    // 30/06/2026: fallos de la UE guardados como T10-Estado no salían al repasar
    // "falladas del T1" de Cantabria, pese a que el artículo SÍ está en su T1).
    // Por eso solo se usa como fallback cuando NO hay filtro de scope por
    // artículo (oposición sin topic_scope o sin target_oposicion).
    if (topicNumber && !scopeArticleIds) {
      conditions.push(eq(testQuestions.temaNumber, topicNumber))
    }

    if (allowedArticleIds) {
      conditions.push(inArray(testQuestions.articleId, allowedArticleIds))
    }

    if (since) {
      conditions.push(gte(testQuestions.createdAt, since))
    }

    // Query principal: solo INNER JOIN con `questions` (filtro is_active).
    // El JOIN con `tests` se elimina (tq.user_id está 100% denormalizado).
    // Los JOINs con `articles`/`laws` se sustituyen por el pre-resolve de
    // arriba. LIMIT 2000 protege heavy users. Pre-fix (4 JOINs): >30s
    // statement_timeout. Post: ~800ms para user con 2.730 fallos.
    const failedAnswers = await db
      .select({
        questionId: testQuestions.questionId,
        createdAt: testQuestions.createdAt,
        timeSpentSeconds: testQuestions.timeSpentSeconds,
        questionText: testQuestions.questionText,
        difficulty: testQuestions.difficulty,
        articleNumber: testQuestions.articleNumber,
        lawShortName: testQuestions.lawName,
        userAnswer: testQuestions.userAnswer,
      })
      .from(testQuestions)
      .innerJoin(questions, eq(testQuestions.questionId, questions.id))
      .where(and(...conditions))
      .orderBy(desc(testQuestions.createdAt))
      .limit(2000)

    if (!failedAnswers || failedAnswers.length === 0) {
      return {
        success: true,
        totalQuestions: 0,
        totalFailures: 0,
        questions: [],
      }
    }

    // Procesar y agrupar las preguntas falladas
    const failedQuestionsMap = new Map<string, FailedQuestionItem>()

    for (const answer of failedAnswers) {
      const questionId = answer.questionId
      if (!questionId) continue

      if (!failedQuestionsMap.has(questionId)) {
        failedQuestionsMap.set(questionId, {
          questionId,
          questionText: answer.questionText
            ? answer.questionText.substring(0, 80) + '...'
            : 'Pregunta sin texto',
          difficulty: answer.difficulty,
          articleNumber: answer.articleNumber,
          lawShortName: answer.lawShortName,
          failedCount: 0,
          wrongCount: 0,
          blankCount: 0,
          onlyBlank: true,
          lastFailed: answer.createdAt || new Date().toISOString(),
          firstFailed: answer.createdAt || new Date().toISOString(),
          totalTime: 0,
        })
      }

      const question = failedQuestionsMap.get(questionId)!
      question.failedCount++
      // Desglose en blanco vs fallo real (la blanca sigue contando como fallada
      // para el motor de áreas débiles; esto solo permite etiquetarla aparte).
      if (isBlankAnswer(answer.userAnswer)) {
        question.blankCount = (question.blankCount ?? 0) + 1
      } else {
        question.wrongCount = (question.wrongCount ?? 0) + 1
      }
      question.onlyBlank = (question.wrongCount ?? 0) === 0
      question.totalTime += answer.timeSpentSeconds || 0

      // Actualizar fechas
      const answerDate = new Date(answer.createdAt || 0)
      if (answerDate > new Date(question.lastFailed)) {
        question.lastFailed = answer.createdAt || question.lastFailed
      }
      if (answerDate < new Date(question.firstFailed)) {
        question.firstFailed = answer.createdAt || question.firstFailed
      }
    }

    const failedQuestionsList = Array.from(failedQuestionsMap.values())

    // Totales separando fallo real de "solo en blanco" (para la UI: que el
    // opositor controle sus errores reales sin sacar las blancas del repaso).
    const totalRealFailures = failedQuestionsList.filter(q => !q.onlyBlank).length
    const totalBlankOnly = failedQuestionsList.filter(q => q.onlyBlank).length

    console.log(`✅ [v2] ${failedQuestionsList.length} preguntas falladas (${totalRealFailures} con fallo real, ${totalBlankOnly} solo en blanco; ${failedAnswers.length} apariciones)`)

    return {
      success: true,
      totalQuestions: failedQuestionsList.length,
      totalFailures: failedAnswers.length,
      totalRealFailures,
      totalBlankOnly,
      questions: failedQuestionsList,
    }
  } catch (error) {
    console.error('❌ [v2] Error obteniendo preguntas falladas:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// OBTENER CONTEOS DE FALLADAS AGRUPADOS POR TEMA
// ============================================
export async function getFailedQuestionsByTopic(
  userId: string,
  positionType: string
): Promise<{ success: boolean; topics?: FailedByTopicItem[]; error?: string }> {
  try {
    if (!positionType) {
      return { success: false, error: 'positionType es obligatorio' }
    }

    const db = getUserFailedDb()

    // NOTA: El JOIN con `topics` DEBE filtrarse por position_type porque el mismo
    // topic_number existe en 30+ oposiciones. Sin este filtro, el título devuelto
    // podía ser el de otra oposición (bug detectado abr 2026 con Tatiana Madrid
    // viendo temas de Galicia/Policía).
    // user_id viene denormalizado en test_questions — evitamos JOIN con tests.
    // Mantenemos JOIN con questions para el filtro is_active (preguntas retiradas).
    const rows = await db
      .select({
        temaNumber: testQuestions.temaNumber,
        topicTitle: topics.title,
        questionId: testQuestions.questionId,
        userAnswer: testQuestions.userAnswer,
      })
      .from(testQuestions)
      .innerJoin(questions, eq(testQuestions.questionId, questions.id))
      .leftJoin(topics, and(
        eq(topics.topicNumber, testQuestions.temaNumber),
        eq(topics.positionType, positionType)
      ))
      .where(and(
        eq(testQuestions.userId, userId),
        eq(testQuestions.isCorrect, false),
        eq(questions.isActive, true),
        // Excluir preguntas de casos prácticos (ver comentario en query principal)
        isNull(questions.examCaseId),
        gt(testQuestions.temaNumber, 0),
      ))

    // Agrupar por tema. Por pregunta guardamos si ALGUNA vez se contestó mal
    // (everWrong) → distingue "fallo real" de "solo en blanco" a nivel de tema.
    const byTopic = new Map<number, { title: string | null; everWrong: Map<string, boolean>; totalFailures: number }>()

    for (const row of rows) {
      const tema = row.temaNumber!
      if (!byTopic.has(tema)) {
        byTopic.set(tema, { title: row.topicTitle, everWrong: new Map(), totalFailures: 0 })
      }
      const entry = byTopic.get(tema)!
      if (row.questionId) {
        const wrong = !isBlankAnswer(row.userAnswer)
        entry.everWrong.set(row.questionId, (entry.everWrong.get(row.questionId) ?? false) || wrong)
      }
      entry.totalFailures++
    }

    const result: FailedByTopicItem[] = Array.from(byTopic.entries())
      .map(([topicNumber, data]) => {
        const realFailedQuestions = Array.from(data.everWrong.values()).filter(Boolean).length
        const blankQuestions = data.everWrong.size - realFailedQuestions
        return {
          topicNumber,
          topicTitle: data.title,
          failedQuestions: data.everWrong.size,
          realFailedQuestions,
          blankQuestions,
          totalFailures: data.totalFailures,
        }
      })
      .sort((a, b) => b.failedQuestions - a.failedQuestions)

    return { success: true, topics: result }
  } catch (error) {
    console.error('❌ Error obteniendo falladas por tema:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
