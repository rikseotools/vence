// lib/api/laws/queries.ts - Queries Drizzle para Leyes
import { getDb } from '@/db/client'
import { laws, articles, questions } from '@/db/schema'
import { eq, and, sql, count } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { LawWithCountsSchema, type LawWithCounts, type GetLawsWithCountsResponse } from './schemas'

// ============================================
// OBTENER LEYES CON CONTEO DE PREGUNTAS (DRIZZLE)
// ============================================

async function getLawsWithQuestionCountsInternal(): Promise<GetLawsWithCountsResponse> {
  try {
    const db = getDb()
    console.log('🚀 Obteniendo leyes con conteo (Drizzle Query Builder)...')
    console.time('⏱️ getLawsWithQuestionCounts')

    // Query con Drizzle query builder
    const result = await db
      .select({
        id: laws.id,
        name: laws.name,
        short_name: laws.shortName,
        description: laws.description,
        year: laws.year,
        type: laws.type,
        questionCount: count(questions.id),
        officialQuestions: sql<number>`COUNT(CASE WHEN ${questions.isOfficialExam} = true THEN 1 END)`,
      })
      .from(laws)
      .leftJoin(articles, eq(articles.lawId, laws.id))
      .leftJoin(
        questions,
        and(
          eq(questions.primaryArticleId, articles.id),
          eq(questions.isActive, true)
        )
      )
      .where(eq(laws.isActive, true))
      .groupBy(laws.id, laws.name, laws.shortName, laws.description, laws.year, laws.type)
      .orderBy(sql`COUNT(${questions.id}) DESC`)

    console.timeEnd('⏱️ getLawsWithQuestionCounts')

    // Transformar y validar con Zod
    const lawsWithCounts: LawWithCounts[] = result
      .filter(law => Number(law.questionCount) >= 1)
      .map(law => {
        const parsed = LawWithCountsSchema.safeParse({
          id: law.id,
          name: law.name,
          short_name: law.short_name,
          description: law.description,
          year: law.year,
          type: law.type,
          questionCount: Number(law.questionCount),
          officialQuestions: Number(law.officialQuestions),
        })

        if (!parsed.success) {
          console.warn('⚠️ Ley con datos inválidos:', law.short_name, parsed.error.flatten())
          return null
        }
        return parsed.data
      })
      .filter((law): law is LawWithCounts => law !== null)

    console.log(`✅ ${lawsWithCounts.length} leyes con preguntas obtenidas`)

    return {
      success: true,
      laws: lawsWithCounts,
    }
  } catch (error) {
    console.error('❌ Error obteniendo leyes con conteo:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// 🚀 VERSIÓN CACHEADA (1 mes - las leyes cambian poco)
export const getLawsWithQuestionCounts = unstable_cache(
  getLawsWithQuestionCountsInternal,
  ['laws-with-question-counts'],
  { revalidate: 2592000, tags: ['laws'] }  // 30 días
)

// ============================================
// FALLBACK: RETORNA ARRAY VACÍO
// ============================================

export async function getLawsBasic(): Promise<GetLawsWithCountsResponse> {
  console.warn('⚠️ Fallback activado: retornando lista vacía')
  return {
    success: true,
    laws: [],
  }
}
