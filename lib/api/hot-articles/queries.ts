import { getDb } from '@/db/client'
import { hotArticles, questions } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { normalizeOposicionSlug, type ArticleOfficialExamData } from './schemas'

/**
 * Get official exam data for a single article, filtered by oposicion.
 * Uses hot_articles table (indexed on article_id + target_oposicion).
 * Returns null if no official exam data exists for this article+oposicion.
 */
export async function getArticleOfficialExamData(
  articleId: string,
  userOposicion: string | null
): Promise<ArticleOfficialExamData | null> {
  if (!userOposicion) return null

  const db = getDb()
  const normalizedOposicion = normalizeOposicionSlug(userOposicion)

  const [row] = await db
    .select()
    .from(hotArticles)
    .where(
      and(
        eq(hotArticles.articleId, articleId),
        eq(hotArticles.targetOposicion, normalizedOposicion)
      )
    )
    .limit(1)

  if (!row) return null

  let examSources = extractFromBreakdown(row.entitiesBreakdown, 'exam_sources')
  let examEntities = extractFromBreakdown(row.entitiesBreakdown, 'exam_entities')
  let difficultyLevels = extractFromBreakdown(row.entitiesBreakdown, 'difficulty_levels')

  // If entities_breakdown is empty, enrich from questions table
  if (examSources.length === 0) {
    const enriched = await enrichFromQuestions(db, articleId)
    examSources = enriched.examSources
    examEntities = enriched.examEntities
    difficultyLevels = enriched.difficultyLevels
  }

  return {
    hasOfficialExams: true,
    totalOfficialQuestions: row.totalOfficialAppearances ?? 0,
    uniqueExamsCount: row.uniqueExamsCount ?? 0,
    priorityLevel: (row.priorityLevel as 'critical' | 'high' | 'medium' | 'low') ?? 'low',
    hotnessScore: Number(row.hotnessScore) || 0,
    latestExamDate: row.lastAppearanceDate ?? null,
    firstExamDate: row.firstAppearanceDate ?? null,
    examSources,
    examEntities,
    difficultyLevels,
  }
}

/**
 * Get official exam data for multiple articles at once, filtered by oposicion.
 * Returns a record keyed by article_number.
 */
export async function getMultipleArticlesOfficialExamData(
  articleNumbers: string[],
  lawShortName: string,
  userOposicion: string | null
): Promise<Record<string, ArticleOfficialExamData>> {
  if (!userOposicion || articleNumbers.length === 0) return {}

  const db = getDb()
  const normalizedOposicion = normalizeOposicionSlug(userOposicion)

  const rows = await db
    .select()
    .from(hotArticles)
    .where(
      and(
        eq(hotArticles.lawName, lawShortName),
        eq(hotArticles.targetOposicion, normalizedOposicion),
        inArray(hotArticles.articleNumber, articleNumbers)
      )
    )

  const result: Record<string, ArticleOfficialExamData> = {}

  for (const row of rows) {
    if (!row.articleNumber) continue
    result[row.articleNumber] = {
      hasOfficialExams: true,
      totalOfficialQuestions: row.totalOfficialAppearances ?? 0,
      uniqueExamsCount: row.uniqueExamsCount ?? 0,
      priorityLevel: (row.priorityLevel as 'critical' | 'high' | 'medium' | 'low') ?? 'low',
      hotnessScore: Number(row.hotnessScore) || 0,
      latestExamDate: row.lastAppearanceDate ?? null,
      firstExamDate: row.firstAppearanceDate ?? null,
      examSources: extractFromBreakdown(row.entitiesBreakdown, 'exam_sources'),
      examEntities: extractFromBreakdown(row.entitiesBreakdown, 'exam_entities'),
      difficultyLevels: extractFromBreakdown(row.entitiesBreakdown, 'difficulty_levels'),
    }
  }

  return result
}

/** Enrich exam data from questions table when entities_breakdown is empty */
async function enrichFromQuestions(db: ReturnType<typeof getDb>, articleId: string) {
  const officialQuestions = await db
    .select({
      examSource: questions.examSource,
      examEntity: questions.examEntity,
      officialDifficultyLevel: questions.officialDifficultyLevel,
    })
    .from(questions)
    .where(
      and(
        eq(questions.primaryArticleId, articleId),
        eq(questions.isOfficialExam, true),
        eq(questions.isActive, true)
      )
    )

  return {
    examSources: [...new Set(officialQuestions.map(q => q.examSource).filter((s): s is string => !!s))],
    examEntities: [...new Set(officialQuestions.map(q => q.examEntity).filter((s): s is string => !!s))],
    difficultyLevels: [...new Set(officialQuestions.map(q => q.officialDifficultyLevel).filter((s): s is string => !!s))],
  }
}

/** Extract string arrays from entities_breakdown JSONB */
function extractFromBreakdown(breakdown: unknown, key: string): string[] {
  if (!breakdown || typeof breakdown !== 'object') return []
  const obj = breakdown as Record<string, unknown>
  const value = obj[key]
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}
