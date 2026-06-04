// lib/chat/domains/verification/queries.ts
// Queries para obtener datos de verificación

// Lecturas por self-hosted PgBouncer (max:8, sano), no Supavisor max:1 → 504.
import { getPoolerDb } from '@/db/client'
import { questions, articles, laws, psychometricQuestions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '../../shared/logger'

export interface LinkedArticle {
  id: string
  articleNumber: string
  title: string | null
  content: string | null
  lawShortName: string
  lawName: string
}

/**
 * Obtiene el artículo vinculado a una pregunta.
 *
 * Une questions → articles (primary_article_id) → laws (law_id, inner). El
 * innerJoin a laws reproduce el `laws!inner` del código anterior: si la
 * pregunta no existe, no tiene artículo, o el artículo no tiene ley, no hay
 * fila y se devuelve null.
 */
export async function getLinkedArticle(questionId: string): Promise<LinkedArticle | null> {
  if (!questionId) return null

  try {
    const db = getPoolerDb()
    const rows = await db
      .select({
        id: articles.id,
        articleNumber: articles.articleNumber,
        title: articles.title,
        content: articles.content,
        lawShortName: laws.shortName,
        lawName: laws.name,
      })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(eq(questions.id, questionId))
      .limit(1)

    const row = rows[0]
    if (!row) {
      logger.debug(`No linked article for question ${questionId}`, { domain: 'verification' })
      return null
    }

    return {
      id: row.id,
      articleNumber: row.articleNumber,
      title: row.title,
      content: row.content,
      lawShortName: row.lawShortName,
      lawName: row.lawName,
    }
  } catch (error) {
    logger.error('Error getting linked article', error, { domain: 'verification' })
    return null
  }
}

/**
 * Verifica si una pregunta es psicotécnica (existe en psychometric_questions)
 */
export async function checkIsPsychometric(questionId: string): Promise<boolean> {
  if (!questionId) return false

  try {
    const db = getPoolerDb()
    const rows = await db
      .select({ id: psychometricQuestions.id })
      .from(psychometricQuestions)
      .where(eq(psychometricQuestions.id, questionId))
      .limit(1)

    return rows.length > 0
  } catch {
    return false
  }
}
