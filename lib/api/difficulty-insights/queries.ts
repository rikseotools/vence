// lib/api/difficulty-insights/queries.ts
import { getDb, getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type {
  GetDifficultyInsightsResponse,
  DifficultyMetrics,
  PersonalBreakdown,
  QuestionResult,
  ProgressTrends,
  Recommendation,
} from './schemas'
import {
  getMetricsV2,
  getStrugglingQuestionsV2,
  getMasteredQuestionsV2,
  getPersonalBreakdownV2,
  getProgressTrendsV2,
} from './queriesV2'
import { evaluarFasesNombradas, UMBRAL_LENTA_MS } from '@/lib/observability/fasesLentas'
import { emitFireAndForget } from '@/lib/observability/emit'
import { INSTANCE_ID } from '@/lib/observability/instanceId'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

/**
 * Cronómetro por consulta (T-319).
 *
 * Este endpoint falla el **4,6%** de sus peticiones y estuvo 14 días así sin que nadie lo supiera.
 * Cuando por fin se miró, su evento de error solo guardaba `host`, `method` y `errorRef`: saber
 * cuál de las 7 consultas se comía los 12 segundos exigió reconstruirlo A MANO contra producción
 * —planes, `EXPLAIN`, medir en frío y en caliente—. Con esto, la próxima vez se lee en el panel.
 *
 * No cambia el comportamiento: envuelve la promesa y anota cuánto tardó. Si la consulta falla, el
 * tiempo se registra igual y el error sigue su curso (los `.catch()` de fallback siguen mandando).
 */
async function cronometrar<T>(nombre: string, marcas: Record<string, number>, p: Promise<T>): Promise<T> {
  const t0 = Date.now()
  try {
    return await p
  } finally {
    marcas[nombre] = Date.now() - t0
  }
}

// Feature flag: % de usuarios que leen de user_question_history_v2 (lookup PK)
// en lugar de las RPCs viejas (que escanean test_questions y timeoutean para
// heavy users como Nila 33k+ filas). Hash determinístico de userId → cada
// usuario siempre cae en el mismo bucket dentro de la misma config.
//
// Rollout: 0 (default) → todos en v1. Subir progresivamente 1 → 10 → 50 → 100.
// Si v2 falla en alguna query, automáticamente cae al fallback v1.
//
// Validación previa: shadow comparation 1h tráfico real, v2 = ground truth
// EXACTAMENTE en 10/10 heavy users. Documentado ARCHITECTURE_ROADMAP §"Memo
// user_question_stats — caso Nila".
function shouldUseV2(userId: string): boolean {
  // Default 100: v2 validado shadow contra ground truth (10/10 heavy users
  // exactos). Fallback automático a v1 vía .catch() en cada sub-query si v2
  // fallara en runtime. Para rollback total: USE_UQH_V2_PCT=0 sin redeploy.
  const pct = parseInt(process.env.USE_UQH_V2_PCT || '100', 10)
  if (pct <= 0) return false
  if (pct >= 100) return true
  // Hash simple del userId → bucket 0-99
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 100 < pct
}

export async function getDifficultyInsights(userId: string): Promise<GetDifficultyInsightsResponse> {
  // FUERA del try a propósito: la petición que MÁS interesa explicar es la que falla, y si estas
  // marcas vivieran dentro, un rechazo de `Promise.all` se llevaría por delante el desglose justo
  // en ese caso. Se emite en los dos caminos (éxito y error) desde el `finally`.
  const tInicio = Date.now()
  const marcas: Record<string, number> = {}
  let useV2 = false
  try {
    useV2 = shouldUseV2(userId)
    // v2 usa read replica para evitar serialización por max:1 del primary pool.
    // Las 6 queries en Promise.all SÍ se paralelizan en la replica (pool propio).
    // v1 sigue usando primary (legacy) — esa ruta no se mejoró, solo se mantiene
    // como fallback.
    const db = useV2 ? getReadDb() : getDb()

    // Ejecutar las 6 queries en paralelo. v2 usa user_question_history_v2
    // (lookup PK, <50ms incluso para heavy users 33k+ filas). v1 usa RPCs
    // antiguas que escanean test_questions (5-8s para heavy users → timeout).
    // Cronometradas una a una: van en paralelo, así que la SUMA excede el total y eso es correcto
    // (lo que interesa es cuál es la más larga, no repartir el reloj de pared).
    const [
      metricsResult,
      personalBreakdownResult,
      strugglingResult,
      masteredResult,
      trendsResult,
      recommendationsResult,
    ] = await Promise.all([
      cronometrar('metrics', marcas, useV2 ? getMetricsV2(db, userId).catch(() => getMetrics(db, userId)) : getMetrics(db, userId)),
      cronometrar('desglose', marcas, useV2 ? getPersonalBreakdownV2(db, userId).catch(() => getPersonalBreakdown(db, userId)) : getPersonalBreakdown(db, userId)),
      cronometrar('dificiles', marcas, useV2 ? getStrugglingQuestionsV2(db, userId, 5).catch(() => getStrugglingQuestions(db, userId, 5)) : getStrugglingQuestions(db, userId, 5)),
      cronometrar('dominadas', marcas, useV2 ? getMasteredQuestionsV2(db, userId, 5).catch(() => getMasteredQuestions(db, userId, 5)) : getMasteredQuestions(db, userId, 5)),
      cronometrar('tendencias', marcas, useV2 ? getProgressTrendsV2(db, userId).catch(() => getProgressTrends(db, userId)) : getProgressTrends(db, userId)),
      // La ÚNICA sin v2: sigue leyendo test_questions (5,6 GB) y es la sospechosa número uno — medida
      // en 9.227 ms en frío frente a 400 ms en caliente para un usuario de 35k filas. Ver T-319.
      cronometrar('recomendaciones', marcas, getRecommendations(db, userId)),
    ])

    // Enriquecer preguntas con datos de ley/artículo para hacerlas accionables
    const allQuestionIds = [
      ...strugglingResult.map(q => q.questionId),
      ...masteredResult.map(q => q.questionId),
    ]
    const enrichment = allQuestionIds.length > 0
      ? await cronometrar('enriquecer', marcas, getQuestionEnrichment(db, allQuestionIds))
      : new Map<string, { lawSlug: string; lawName: string; articleNumber: string }>()

    const enrich = (questions: QuestionResult[]) =>
      questions.map(q => ({
        ...q,
        ...(enrichment.get(q.questionId) || {}),
      }))

    return {
      success: true,
      data: {
        metrics: metricsResult,
        personalBreakdown: personalBreakdownResult,
        strugglingQuestions: enrich(strugglingResult),
        masteredQuestions: enrich(masteredResult),
        progressTrends: trendsResult,
        recommendations: recommendationsResult,
      },
    }
  } catch (error) {
    console.error('Error obteniendo difficulty insights:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  } finally {
    // Desglose SOLO si fue lenta, pero entonces al 100%. `request_completed` va muestreado al 10% y
    // ese sesgo es justo el que no se puede permitir aquí: la petición que se estrella contra los
    // 12 s es la que NO puede perderse. El desglose de una de 90 ms no informaría de nada.
    //
    // En el `finally` para cubrir también el camino de error, que es el interesante. Va envuelto:
    // un fallo emitiendo observabilidad JAMÁS puede tumbar la respuesta del usuario.
    try {
      const totalMs = Date.now() - tInicio
      const veredicto = evaluarFasesNombradas(marcas, totalMs)
      if (veredicto.lenta) {
        emitFireAndForget({
          source: 'vercel', severity: 'warn', eventType: 'difficulty_insights_lento',
          endpoint: '/api/v2/difficulty-insights', durationMs: totalMs,
          metadata: {
            ...marcas,
            totalMs,
            dominante: veredicto.dominante,
            pctDominante: veredicto.pctDominante,
            noExplicadoMs: veredicto.noExplicadoMs,
            umbralMs: UMBRAL_LENTA_MS,
            usaV2: useV2,
            // Cuántas de las 7 llegaron a MEDIRSE (una que falla también deja su tiempo). Si
            // faltan, la petición murió antes de llegar a ellas, y eso ya dice dónde se quedó.
            consultasMedidas: Object.keys(marcas).length,
            instanceId: INSTANCE_ID,
          },
        })
      }
    } catch { /* la observabilidad nunca rompe el camino crítico */ }
  }
}

// Métricas globales del usuario
async function getMetrics(db: ReturnType<typeof getDb>, userId: string): Promise<DifficultyMetrics> {
  try {
    const result = await db.execute(
      sql`SELECT * FROM get_user_difficulty_metrics(${userId}::uuid)`
    )
    const row = (result as Record<string, unknown>[])[0]
    if (!row) return emptyMetrics()

    return {
      totalQuestionsAttempted: Number(row.total_questions_attempted) || 0,
      questionsMastered: Number(row.questions_mastered) || 0,
      questionsStruggling: Number(row.questions_struggling) || 0,
      avgPersonalDifficulty: Number(row.avg_personal_difficulty) || 0,
      accuracyTrend: parseTrend(row.accuracy_trend as string),
    }
  } catch (error) {
    console.warn('⚠️ RPC get_user_difficulty_metrics error, using fallback:', error)
    return await getMetricsFallback(db, userId)
  }
}

// Fallback si la RPC no existe: calcular desde test_questions
async function getMetricsFallback(db: ReturnType<typeof getDb>, userId: string): Promise<DifficultyMetrics> {
  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT tq.question_id)::int AS total_questions_attempted,
      COUNT(DISTINCT tq.question_id) FILTER (
        WHERE tq.question_id IN (
          SELECT tq2.question_id FROM test_questions tq2
          -- JOIN tests eliminado
          WHERE tq2.user_id = ${userId}::uuid
          GROUP BY tq2.question_id
          HAVING AVG(CASE WHEN tq2.is_correct THEN 1.0 ELSE 0.0 END) >= 0.8
        )
      )::int AS questions_mastered,
      COUNT(DISTINCT tq.question_id) FILTER (
        WHERE tq.question_id IN (
          SELECT tq2.question_id FROM test_questions tq2
          -- JOIN tests eliminado
          WHERE tq2.user_id = ${userId}::uuid
          GROUP BY tq2.question_id
          HAVING AVG(CASE WHEN tq2.is_correct THEN 1.0 ELSE 0.0 END) < 0.4
        )
      )::int AS questions_struggling
    FROM test_questions tq
    -- JOIN tests eliminado: usar tq.user_id directamente
    WHERE tq.user_id = ${userId}::uuid
  `)

  const row = (result as Record<string, unknown>[])[0]
  return {
    totalQuestionsAttempted: Number(row?.total_questions_attempted) || 0,
    questionsMastered: Number(row?.questions_mastered) || 0,
    questionsStruggling: Number(row?.questions_struggling) || 0,
    avgPersonalDifficulty: 0,
    accuracyTrend: 'stable',
  }
}

// Preguntas con peor rendimiento
async function getStrugglingQuestions(db: ReturnType<typeof getDb>, userId: string, limit: number): Promise<QuestionResult[]> {
  try {
    const result = await db.execute(
      sql`SELECT * FROM get_struggling_questions(${userId}::uuid, ${limit})`
    )
    return mapQuestionResults(result as Record<string, unknown>[])
  } catch {
    return await getStrugglingFallback(db, userId, limit)
  }
}

async function getStrugglingFallback(db: ReturnType<typeof getDb>, userId: string, limit: number): Promise<QuestionResult[]> {
  const result = await db.execute(sql`
    SELECT
      tq.question_id,
      q.question_text,
      COUNT(*)::int AS total_attempts,
      ROUND(AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) * 100, 1) AS success_rate,
      ROUND((1 - AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END)) * 100, 1) AS personal_difficulty
    FROM test_questions tq
    -- JOIN tests eliminado: usar tq.user_id directamente
    INNER JOIN questions q ON tq.question_id = q.id
    WHERE tq.user_id = ${userId}::uuid
    GROUP BY tq.question_id, q.question_text
    HAVING COUNT(*) >= 2 AND AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) < 0.4
    ORDER BY AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) ASC
    LIMIT ${limit}
  `)
  return mapQuestionResults(result as Record<string, unknown>[])
}

// Preguntas dominadas
async function getMasteredQuestions(db: ReturnType<typeof getDb>, userId: string, limit: number): Promise<QuestionResult[]> {
  try {
    const result = await db.execute(
      sql`SELECT * FROM get_mastered_questions(${userId}::uuid, ${limit})`
    )
    return mapQuestionResults(result as Record<string, unknown>[])
  } catch {
    return await getMasteredFallback(db, userId, limit)
  }
}

async function getMasteredFallback(db: ReturnType<typeof getDb>, userId: string, limit: number): Promise<QuestionResult[]> {
  const result = await db.execute(sql`
    SELECT
      tq.question_id,
      q.question_text,
      COUNT(*)::int AS total_attempts,
      ROUND(AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) * 100, 1) AS success_rate,
      ROUND((1 - AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END)) * 100, 1) AS personal_difficulty
    FROM test_questions tq
    -- JOIN tests eliminado: usar tq.user_id directamente
    INNER JOIN questions q ON tq.question_id = q.id
    WHERE tq.user_id = ${userId}::uuid
    GROUP BY tq.question_id, q.question_text
    HAVING COUNT(*) >= 2 AND AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) >= 0.8
    ORDER BY AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) DESC
    LIMIT ${limit}
  `)
  return mapQuestionResults(result as Record<string, unknown>[])
}

// Tendencias de progreso
async function getProgressTrends(db: ReturnType<typeof getDb>, userId: string): Promise<ProgressTrends> {
  try {
    const result = await db.execute(
      sql`SELECT * FROM get_user_progress_trends(${userId}::uuid)`
    )
    const row = (result as Record<string, unknown>[])[0]
    return {
      improving: Number(row?.improving) || 0,
      declining: Number(row?.declining) || 0,
      stable: Number(row?.stable) || 0,
      total: Number(row?.total) || 0,
    }
  } catch {
    return { improving: 0, declining: 0, stable: 0, total: 0 }
  }
}

// Techo interno SOLO para esta consulta (T-319 paso 1 del diseño decidido: "degradar la
// respuesta"). Es la ÚNICA de las 6 que no se migró a user_question_history_v2 y la que en frío
// llega a tardar 9-19 s en usuarios pesados — con el timeout de 12 s aplicado al conjunto entero
// (`withDbTimeout` en la ruta), esos 9-19 s se llevaban por delante las otras 5 consultas, que
// resuelven en milisegundos. Cortarla aquí, por separado, deja que el resto de la pantalla
// responda igual y solo esta pestaña se sirva vacía. No cancela la query en Postgres (misma
// limitación conocida de `withDbTimeout`: el statement_timeout de 30 s es quien la mata de
// verdad), pero libera la respuesta al usuario.
//
// Leído del entorno EN CADA LLAMADA (no una constante de módulo): mismo patrón que
// `waitMsFromEnv` de `renderSemaphore.ts` — permite bajarlo en tests sin esperar segundos reales
// y ajustarlo en producción sin redeploy si la medición de T-319 pide otro valor.
export function recommendationsTimeoutMsFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.DIFFICULTY_INSIGHTS_RECS_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 6000
}

// Recomendaciones personalizadas
async function getRecommendations(db: ReturnType<typeof getDb>, userId: string): Promise<Recommendation[]> {
  const timeoutMs = recommendationsTimeoutMsFromEnv()
  try {
    const result = await withDbTimeout(
      () => db.execute(sql`SELECT * FROM get_personalized_recommendations(${userId}::uuid)`),
      timeoutMs,
    )
    return (result as Record<string, unknown>[]).map(row => ({
      priority: parsePriority(row.priority as string),
      title: String(row.title || ''),
      description: String(row.description || '').trim(),
      actionType: String(row.action_type || ''),
    }))
  } catch (error) {
    // Degradado silencioso a propósito (mismo contrato de antes: la pestaña de recomendaciones
    // se sirve vacía en vez de tumbar las otras 5). Lo nuevo es DISTINGUIR el motivo: un timeout
    // aquí es la fuga que esta ficha persigue, y sin marcarlo aparte quedaba mezclado con
    // cualquier otro fallo de RPC en el mismo catch-all silencioso.
    if (isDbTimeoutError(error)) {
      try {
        emitFireAndForget({
          source: 'vercel', severity: 'warn', eventType: 'difficulty_insights_recomendaciones_degradadas',
          endpoint: '/api/v2/difficulty-insights',
          metadata: { userId, timeoutMs, instanceId: INSTANCE_ID },
        })
      } catch { /* la observabilidad nunca rompe el camino crítico */ }
    }
    return []
  }
}

// Desglose por dificultad personal (clasificación por success rate del usuario)
async function getPersonalBreakdown(db: ReturnType<typeof getDb>, userId: string): Promise<PersonalBreakdown> {
  try {
    const result = await db.execute(sql`
      WITH question_stats AS (
        SELECT
          tq.question_id,
          AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) AS success_rate
        FROM test_questions tq
        -- JOIN tests eliminado: usar tq.user_id directamente
        WHERE tq.user_id = ${userId}::uuid
        GROUP BY tq.question_id
        HAVING COUNT(*) >= 2
      )
      SELECT
        COUNT(*) FILTER (WHERE success_rate >= 0.8)::int AS easy,
        COUNT(*) FILTER (WHERE success_rate >= 0.6 AND success_rate < 0.8)::int AS medium,
        COUNT(*) FILTER (WHERE success_rate >= 0.4 AND success_rate < 0.6)::int AS hard,
        COUNT(*) FILTER (WHERE success_rate < 0.4)::int AS extreme,
        COUNT(*)::int AS total
      FROM question_stats
    `)
    const row = (result as Record<string, unknown>[])[0]
    return {
      easy: Number(row?.easy) || 0,
      medium: Number(row?.medium) || 0,
      hard: Number(row?.hard) || 0,
      extreme: Number(row?.extreme) || 0,
      total: Number(row?.total) || 0,
    }
  } catch (error) {
    console.warn('⚠️ Error calculando personal breakdown:', error)
    return { easy: 0, medium: 0, hard: 0, extreme: 0, total: 0 }
  }
}

// Enriquecer preguntas con ley y artículo (una sola query batch)
async function getQuestionEnrichment(
  db: ReturnType<typeof getDb>,
  questionIds: string[]
): Promise<Map<string, { lawSlug: string; lawName: string; articleNumber: string }>> {
  const map = new Map<string, { lawSlug: string; lawName: string; articleNumber: string }>()
  if (questionIds.length === 0) return map

  try {
    // Usar IN con sql.join para compatibilidad con Drizzle (no ANY con array)
    const idList = sql.join(questionIds.map(id => sql`${id}::uuid`), sql`, `)
    const result = await db.execute(sql`
      SELECT q.id AS question_id, a.article_number, l.slug AS law_slug, l.short_name AS law_name
      FROM questions q
      INNER JOIN articles a ON q.primary_article_id = a.id
      INNER JOIN laws l ON a.law_id = l.id
      WHERE q.id IN (${idList})
    `)

    for (const row of result as Record<string, unknown>[]) {
      map.set(String(row.question_id), {
        lawSlug: String(row.law_slug || ''),
        lawName: String(row.law_name || ''),
        articleNumber: String(row.article_number || ''),
      })
    }
  } catch (error) {
    console.warn('⚠️ Error enriqueciendo preguntas:', error)
  }

  return map
}

// Helpers
function emptyMetrics(): DifficultyMetrics {
  return {
    totalQuestionsAttempted: 0,
    questionsMastered: 0,
    questionsStruggling: 0,
    avgPersonalDifficulty: 0,
    accuracyTrend: 'stable',
  }
}

function mapQuestionResults(rows: Record<string, unknown>[]): QuestionResult[] {
  return (rows || []).map(row => ({
    questionId: String(row.question_id || ''),
    questionText: String(row.question_text || ''),
    totalAttempts: Number(row.total_attempts) || 0,
    successRate: (Number(row.success_rate) || 0) / 100, // Normalizar a 0-1
    personalDifficulty: Number(row.personal_difficulty) || 0,
    trend: String(row.trend || 'stable'),
  }))
}

function parseTrend(value: string): 'improving' | 'declining' | 'stable' {
  if (value === 'improving' || value === 'declining') return value
  return 'stable'
}

function parsePriority(value: string): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'medium'
}
