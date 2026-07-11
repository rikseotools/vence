// lib/api/laws-configurator/queries.ts - Queries para configurador de leyes
// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getLawsConfDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { questions, articles, laws } from '@/db/schema'
import { eq, sql, and, isNotNull } from 'drizzle-orm'
import { articleInPositionScopeExists } from '@/lib/api/_shared/topicScopeSql'
import { emitFireAndForget } from '@/lib/observability/emit'
import type { GetAllLawsResponse, LawData } from './schemas'

// ============================================
// OBTENER TODAS LAS LEYES CON ESTADÍSTICAS
// ============================================

export async function getAllLawsWithStats(positionType?: string | null): Promise<GetAllLawsResponse> {
  try {
    const db = getLawsConfDb()

    // 🎯 Filtro por oposición: si se pasa positionType, solo cuenta preguntas de
    // ARTÍCULOS que están en su topic_scope (su temario), no la ley entera. Así el
    // conteo que ve el usuario coincide con el test acotado que recibe, y una ley
    // sin artículos en su temario desaparece de la lista. Sin positionType → todas
    // (descubrimiento/anónimo). Misma semántica de scope que isLawOnlyMode/modo tema.
    const positionFilter = positionType
      ? articleInPositionScopeExists({ lawId: articles.lawId, articleNumber: articles.articleNumber, positionType })
      : undefined

    // Query con joins: questions -> articles -> laws
    // Cuenta preguntas activas por ley
    const result = await db
      .select({
        lawShortName: laws.shortName,
        lawName: laws.name,
        totalQuestions: sql<number>`count(distinct ${questions.id})::int`,
        articlesWithQuestions: sql<number>`count(distinct ${articles.id})::int`
      })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(and(
        eq(questions.isActive, true),
        eq(laws.isActive, true),
        isNotNull(laws.shortName),
        positionFilter
      ))
      .groupBy(laws.shortName, laws.name)
      .orderBy(sql`count(distinct ${questions.id}) desc`)

    // Transformar resultados
    const lawsData: LawData[] = result
      .filter(r => r.lawShortName && r.totalQuestions > 0)
      .map(r => ({
        lawShortName: r.lawShortName!,
        lawName: r.lawName || r.lawShortName!,
        totalQuestions: r.totalQuestions,
        articlesWithQuestions: r.articlesWithQuestions
      }))

    // Calcular totales
    const totalQuestions = lawsData.reduce((sum, law) => sum + law.totalQuestions, 0)

    // 🔭 Detección: se pidió acotado a una oposición y NO hay NINGUNA ley con preguntas
    // en su temario. Es el caso que deja al usuario en el callejón "Sin leyes disponibles"
    // (oposición catalogada sin contenido / valor stale). Lo emitimos para cazarlo
    // proactivamente y saber CON QUÉ oposición pasa, sin depender de que el usuario avise.
    if (positionType && lawsData.length === 0) {
      emitFireAndForget({
        source: 'fargate',
        severity: 'warn',
        eventType: 'laws_configurator_empty_scope',
        endpoint: '/api/laws-configurator',
        metadata: { positionType },
      })
    }

    console.log(`📚 [LawsConfigurator] Leyes cargadas: ${lawsData.length}, Total preguntas: ${totalQuestions}`)

    return {
      success: true,
      data: lawsData,
      totalLaws: lawsData.length,
      totalQuestions
    }

  } catch (error) {
    console.error('❌ [LawsConfigurator] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}
