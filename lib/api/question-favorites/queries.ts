// lib/api/question-favorites/queries.ts — preguntas marcadas como favoritas (T-261).
//
// Reutiliza el patrón del repaso de fallos (`lib/api/tests/queries.ts`
// → getFailedQuestionsForUser): mismo join questions×articles×laws y el MISMO
// shape `TestLayoutQuestion`, para que la página de repaso sea gemela y no haya
// dos formas distintas de servir un test.
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { getDb, getPoolerDb } from '@/db/client'
import { userQuestionFavorites, questions, articles, laws, topics } from '@/db/schema'
import type { TestLayoutQuestion } from '@/lib/api/tests'
import { MAX_FAVORITAS_POR_TEST } from './schemas'

// Mismo criterio de pool que el resto de lecturas user-facing.
function getFavoritesDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

export interface ToggleResult {
  isFavorite: boolean
  total: number
}

export interface FavoriteQuestionsResult {
  success: boolean
  questions: TestLayoutQuestion[]
  questionCount: number
  /**
   * Cuántas tiene guardadas EN TOTAL, que no es lo mismo que cuántas se sirven.
   *
   * Sin este dato la página no podía avisar de que estaba enseñando un subconjunto, y una
   * usuaria con 40 favoritas veía siempre las mismas 20 y dedujo lo razonable: que las
   * nuevas no se guardaban (Laura Zurdo, feedback 9527a03f, 29/07/2026). No se perdía
   * nada; se servía un trozo en silencio, que es peor porque no hay forma de notarlo.
   */
  totalGuardadas: number
  message?: string
  error?: string
}

/**
 * PURA: decide el orden de las favoritas. Fuera de la BD para poder probar el
 * criterio sin levantar nada (y para que `random` sea sustituible en test).
 *
 * `recent` → las últimas guardadas primero (lo que el usuario espera al entrar).
 * `random` → mezcladas (Fisher-Yates), para que repasar no sea siempre el mismo orden.
 */
export function ordenarFavoritas<T extends { questionId: string; createdAt: string }>(
  filas: T[],
  orderBy: 'recent' | 'random',
  rnd: () => number = Math.random,
): T[] {
  const copia = [...filas]
  if (orderBy === 'random') {
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[copia[i], copia[j]] = [copia[j], copia[i]]
    }
    return copia
  }
  return copia.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

/**
 * Marca o desmarca una pregunta. Idempotente por construcción: el INSERT lleva
 * `ON CONFLICT DO NOTHING` sobre el índice único (user_id, question_id), así que
 * un doble clic o un reintento de red no duplican ni alternan de más.
 *
 * `deseado` fija el estado final en vez de alternar a ciegas: si el cliente y el
 * servidor se desincronizan (dos pestañas), el resultado es el que pidió el usuario.
 */
export async function setFavorite(
  userId: string,
  questionId: string,
  deseado: boolean,
  contexto?: { positionType?: string | null; topicNumber?: number | null },
): Promise<ToggleResult> {
  const db = getFavoritesDb()

  if (deseado) {
    await db
      .insert(userQuestionFavorites)
      .values({
        userId,
        questionId,
        // Dónde estaba al guardarla: no es reconstruible después (ver migración
        // 20260729_user_question_favorites_contexto.sql).
        positionType: contexto?.positionType ?? null,
        topicNumber: contexto?.topicNumber ?? null,
      })
      .onConflictDoNothing()
  } else {
    await db
      .delete(userQuestionFavorites)
      .where(
        and(
          eq(userQuestionFavorites.userId, userId),
          eq(userQuestionFavorites.questionId, questionId),
        ),
      )
  }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userQuestionFavorites)
    .where(eq(userQuestionFavorites.userId, userId))

  return { isFavorite: deseado, total: Number(n) }
}

/** Ids marcados por el usuario — para pintar el corazón relleno en un test en curso. */
export async function listFavoriteIds(userId: string): Promise<string[]> {
  const db = getFavoritesDb()
  const filas = await db
    .select({ questionId: userQuestionFavorites.questionId })
    .from(userQuestionFavorites)
    .where(eq(userQuestionFavorites.userId, userId))
    .orderBy(desc(userQuestionFavorites.createdAt))
  return filas.map((f) => f.questionId)
}

/**
 * Preguntas favoritas hidratadas para `TestLayout`.
 *
 * Solo devuelve preguntas ACTIVAS: una pregunta retirada (lifecycle `retired_*`)
 * deja de servirse aunque el usuario la tuviera guardada — la marca se conserva,
 * pero no se le enseña contenido retirado.
 */
export async function getFavoriteQuestionsForUser(params: {
  userId: string
  numQuestions?: number
  orderBy?: 'recent' | 'random'
}): Promise<FavoriteQuestionsResult> {
  const { userId } = params
  const numQuestions = Math.min(params.numQuestions ?? 20, MAX_FAVORITAS_POR_TEST)
  const orderBy = params.orderBy ?? 'recent'

  try {
    const db = getFavoritesDb()

    // Total REAL de guardadas: es lo que permite decir "20 de 40" en vez de callar.
    const [{ n: totalGuardadas }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(userQuestionFavorites)
      .where(eq(userQuestionFavorites.userId, userId))

    const marcadas = await db
      .select({
        questionId: userQuestionFavorites.questionId,
        createdAt: userQuestionFavorites.createdAt,
        positionType: userQuestionFavorites.positionType,
        topicNumber: userQuestionFavorites.topicNumber,
      })
      .from(userQuestionFavorites)
      .where(eq(userQuestionFavorites.userId, userId))

    if (!marcadas.length) {
      return {
        success: true,
        questions: [],
        questionCount: 0,
        totalGuardadas,
        message: 'Todavía no has guardado ninguna pregunta',
      }
    }

    const ordenadas = ordenarFavoritas(marcadas, orderBy).slice(0, numQuestions)
    const ids = ordenadas.map((f) => f.questionId)

    const filas = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        optionE: questions.optionE,
        explanation: questions.explanation,
        correctOption: questions.correctOption,
        difficulty: questions.difficulty,
        primaryArticleId: questions.primaryArticleId,
        isOfficialExam: questions.isOfficialExam,
        examSource: questions.examSource,
        examDate: questions.examDate,
        examEntity: questions.examEntity,
        globalDifficultyCategory: questions.globalDifficultyCategory,
        articleNumber: articles.articleNumber,
        articleTitle: articles.title,
        lawName: laws.name,
        lawShortName: laws.shortName,
        lawActualSlug: laws.slug,
      })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(and(inArray(questions.id, ids), eq(questions.isActive, true)))

    if (!filas.length) {
      return {
        success: true,
        questions: [],
        questionCount: 0,
        totalGuardadas,
        message: 'Las preguntas que guardaste ya no están disponibles',
      }
    }

    // El SELECT con `IN (...)` no conserva el orden pedido: se reordena por el
    // criterio del usuario (mismo motivo documentado en el repaso de fallos).
    // Tema real del PROGRAMA del usuario. La pregunta no "tiene" tema: lo tiene la
    // combinación (oposición, número de tema) que se anotó al guardarla. Se resuelven
    // en una sola query los pares presentes, no uno por pregunta.
    const paresTema = ordenadas
      .filter((f) => f.positionType && f.topicNumber != null)
      .map((f) => `${f.positionType}#${f.topicNumber}`)
    const temasPorClave = new Map<string, { title: string; displayNumber: number | null; bloqueNumber: number | null }>()
    if (paresTema.length) {
      const positionTypes = [...new Set(ordenadas.map((f) => f.positionType).filter((v): v is string => !!v))]
      const numeros = [...new Set(ordenadas.map((f) => f.topicNumber).filter((v): v is number => v != null))]
      const filasTema = await db
        .select({
          positionType: topics.positionType,
          topicNumber: topics.topicNumber,
          title: topics.title,
          displayNumber: topics.displayNumber,
          bloqueNumber: topics.bloqueNumber,
        })
        .from(topics)
        .where(and(inArray(topics.positionType, positionTypes), inArray(topics.topicNumber, numeros)))
      for (const t of filasTema) {
        temasPorClave.set(`${t.positionType}#${t.topicNumber}`, {
          title: t.title,
          displayNumber: t.displayNumber ?? null,
          bloqueNumber: t.bloqueNumber ?? null,
        })
      }
    }
    const contextoPorPregunta = new Map(
      ordenadas.map((f) => [
        f.questionId,
        {
          positionType: f.positionType ?? null,
          topicNumber: f.topicNumber ?? null,
          tema: f.positionType && f.topicNumber != null
            ? temasPorClave.get(`${f.positionType}#${f.topicNumber}`) ?? null
            : null,
        },
      ]),
    )

    const posicion = new Map(ids.map((id, i) => [id, i]))
    const finales = [...filas].sort(
      (a, b) => (posicion.get(a.id) ?? Infinity) - (posicion.get(b.id) ?? Infinity),
    )

    const formateadas: TestLayoutQuestion[] = finales.map((q) => ({
      id: q.id,
      question: q.questionText,
      question_text: q.questionText,
      options: [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE].filter(
        (v): v is string => v != null && v !== '',
      ),
      explanation: q.explanation,
      correct_option: q.correctOption,
      difficulty: q.difficulty,
      primary_article_id: q.primaryArticleId,
      article_number: q.articleNumber,
      article_title: q.articleTitle,
      law_name: q.lawName || 'Desconocida',
      law_slug: q.lawShortName,
      law_actual_slug: q.lawActualSlug,
      is_official_exam: q.isOfficialExam || false,
      exam_source: q.examSource,
      exam_date: q.examDate,
      exam_entity: q.examEntity,
      global_difficulty_category: q.globalDifficultyCategory,
      // Contexto de dónde la guardó (T-261): permite agrupar por tema del programa
      // y por oposición en la sección de guardadas.
      favorito_position_type: contextoPorPregunta.get(q.id)?.positionType ?? null,
      favorito_topic_number: contextoPorPregunta.get(q.id)?.topicNumber ?? null,
      favorito_topic_title: contextoPorPregunta.get(q.id)?.tema?.title ?? null,
      favorito_topic_display_number: contextoPorPregunta.get(q.id)?.tema?.displayNumber ?? null,
      favorito_bloque_number: contextoPorPregunta.get(q.id)?.tema?.bloqueNumber ?? null,
    })) as (TestLayoutQuestion & Record<string, unknown>)[]

    return {
      success: true,
      questions: formateadas,
      questionCount: formateadas.length,
      totalGuardadas,
      message: `Repaso con ${formateadas.length} pregunta(s) guardada(s)`,
    }
  } catch (error) {
    console.error('❌ [question-favorites] Error cargando favoritas:', error)
    return {
      success: false,
      questions: [],
      questionCount: 0,
      totalGuardadas: 0,
      error: 'No se pudieron cargar tus preguntas guardadas',
    }
  }
}
