// lib/api/laws-configurator/queries.ts - Queries para configurador de leyes
import { getDb } from '@/db/client'
import { questions, articles, laws } from '@/db/schema'
import { eq, sql, and, isNotNull } from 'drizzle-orm'
import type { GetAllLawsResponse, LawData } from './schemas'

// ============================================
// OBTENER TODAS LAS LEYES CON ESTADÍSTICAS
// ============================================

export async function getAllLawsWithStats(): Promise<GetAllLawsResponse> {
  try {
    const db = getDb()

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
        isNotNull(laws.shortName)
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
