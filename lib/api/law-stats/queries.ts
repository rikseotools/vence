// lib/api/law-stats/queries.ts
// Query Drizzle para estadísticas de preguntas por ley.
// Usada directamente por server components y por la API route.
//
// CANARY self-hosted pooler (Fase 3, 2026-05-10):
// /api/questions/law-stats tuvo 3 queries lentas hoy (3.5s, 6.9s, 7.7s) contra
// Supavisor — riesgo de 503 si pasa los 8s. Lo migramos al pooler propio para
// aislar del Supavisor regional. Read-only puro, mismo patrón que ranking/medals.
import { getDb, getPoolerDb } from '@/db/client'
import { questions, articles, laws } from '@/db/schema'
import { eq, and, sql, isNull } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

export interface LawStatsResult {
  success: boolean
  lawShortName: string
  totalQuestions: number
  officialQuestions: number
  regularQuestions: number
  hasQuestions: boolean
  hasOfficialQuestions: boolean
  error?: string
}

// Canary: pooler propio si flag ON, primary si OFF (comportamiento histórico).
function getLawStatsDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

export async function queryLawStats(lawShortName: string): Promise<LawStatsResult> {
  try {
    const db = getLawStatsDb()
    const startTime = Date.now()

    const [result] = await db
      .select({
        total: sql<number>`count(*)`.as('total'),
        official: sql<number>`count(*) filter (where ${questions.isOfficialExam} = true)`.as('official'),
      })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(and(
        eq(questions.isActive, true),
        isNull(questions.examCaseId),
        eq(laws.shortName, lawShortName)
      ))

    const queryMs = Date.now() - startTime
    if (queryMs > 2000) {
      console.warn(`⚠️ [law-stats] Query lenta: ${queryMs}ms para ${lawShortName}`)
    }

    const total = Number(result?.total ?? 0)
    const official = Number(result?.official ?? 0)
    const adjustedTotal = Math.max(total, official)

    console.log(`📊 [law-stats] ${lawShortName}: ${adjustedTotal} total, ${official} oficiales (${queryMs}ms)`)

    return {
      success: true,
      lawShortName,
      totalQuestions: adjustedTotal,
      officialQuestions: official,
      regularQuestions: Math.max(0, adjustedTotal - official),
      hasQuestions: adjustedTotal > 0,
      hasOfficialQuestions: official > 0,
    }
  } catch (error) {
    console.error(`❌ [law-stats] Error para ${lawShortName}:`, error)
    return {
      success: false,
      lawShortName,
      totalQuestions: 0,
      officialQuestions: 0,
      regularQuestions: 0,
      hasQuestions: false,
      hasOfficialQuestions: false,
      error: (error as Error).message,
    }
  }
}

// ============================================
// CACHED WRAPPER (Phase 4c — tag 'law-stats')
// ============================================
// Counts dependen de questions.isActive, que es GENERATED desde
// lifecycle_state. Cambios de lifecycle invalidan el tag desde los mismos
// 3 sitios que test-config (lib/cache/law-stats.ts:invalidateLawStatsCache).
//
// TTL 6h: balance entre carga BD (queries con JOIN sobre questions/articles/
// laws) y frescura. Las invalidaciones manuales por admin propagan en <1s.
//
// Feature flag: CACHE_LAW_STATS=false → bypass al fetcher real.

const TTL_LAW_STATS = 21600 // 6h

// Variante que lanza si falla, para que unstable_cache NO cachee errores
// transitorios (un timeout de BD de 2min envenenaba el cache 6h y producía
// el bucle de feedbacks "no cargan los test" desde 27/04).
async function queryLawStatsOrThrow(lawShortName: string): Promise<LawStatsResult> {
  const result = await queryLawStats(lawShortName)
  if (!result.success) {
    throw new Error(result.error || `law-stats query failed for ${lawShortName}`)
  }
  return result
}

const _cachedQueryLawStats = unstable_cache(
  queryLawStatsOrThrow,
  ['law-stats-v1'],
  { revalidate: TTL_LAW_STATS, tags: ['law-stats'] },
)

export async function queryLawStatsCached(lawShortName: string): Promise<LawStatsResult> {
  if (process.env.CACHE_LAW_STATS === 'false') {
    return queryLawStats(lawShortName)
  }
  try {
    return await _cachedQueryLawStats(lawShortName)
  } catch (error) {
    return {
      success: false,
      lawShortName,
      totalQuestions: 0,
      officialQuestions: 0,
      regularQuestions: 0,
      hasQuestions: false,
      hasOfficialQuestions: false,
      error: (error as Error).message,
    }
  }
}
