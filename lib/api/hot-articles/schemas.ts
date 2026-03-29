import { z } from 'zod'

// Schema for official exam data of a single article (returned by hot_articles lookup)
export const articleOfficialExamDataSchema = z.object({
  hasOfficialExams: z.literal(true),
  totalOfficialQuestions: z.number(),
  uniqueExamsCount: z.number(),
  priorityLevel: z.enum(['critical', 'high', 'medium', 'low']),
  hotnessScore: z.number(),
  latestExamDate: z.string().nullable(),
  firstExamDate: z.string().nullable(),
  // Kept for backward compatibility with ArticleModal rendering
  examSources: z.array(z.string()),
  examEntities: z.array(z.string()),
  difficultyLevels: z.array(z.string()),
})

export type ArticleOfficialExamData = z.infer<typeof articleOfficialExamDataSchema>

// Normalize oposicion slug to the format used in hot_articles.target_oposicion
// hot_articles uses dashes (e.g., 'auxiliar-administrativo-estado')
export function normalizeOposicionSlug(slug: string): string {
  return slug.replace(/_/g, '-')
}

// Schema for check hot article request
export const checkHotArticleRequestSchema = z.object({
  articleId: z.string().uuid(),
  userOposicion: z.string().min(1),
  currentOposicion: z.string().min(1),
})

export type CheckHotArticleRequest = z.infer<typeof checkHotArticleRequestSchema>

export function safeParseCheckHotArticleRequest(data: unknown) {
  return checkHotArticleRequestSchema.safeParse(data)
}

// Response type for check hot article
export interface CheckHotArticleResponse {
  isHot: boolean
  hotnessScore: number
  priorityLevel: string
  hotMessage: string | null
  userOposicion: string
  alsoAppearsInOtherOposiciones: boolean
  otherOposicionesInfo: Array<{ oposicion: string; apariciones: number; prioridad: string }>
  curiosityMessage: string | null
}
