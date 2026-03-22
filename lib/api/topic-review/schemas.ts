// lib/api/topic-review/schemas.ts - Schemas de validación para revisión de temas
import { z } from 'zod/v3'

// ============================================
// REVIEW STATUS
// ============================================

export const REVIEW_STATUSES = [
  'perfect', 'bad_explanation', 'bad_answer', 'bad_answer_and_explanation',
  'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
  'tech_perfect', 'tech_bad_explanation', 'tech_bad_answer', 'tech_bad_answer_and_explanation',
  'pending',
] as const

export const reviewStatusSchema = z.enum(REVIEW_STATUSES)

export type ReviewStatus = z.infer<typeof reviewStatusSchema>

/** Statuses that represent confirmed errors — questions should be deactivated */
export const ERROR_STATUSES: readonly ReviewStatus[] = [
  'bad_explanation', 'bad_answer', 'bad_answer_and_explanation',
  'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
  'tech_bad_explanation', 'tech_bad_answer', 'tech_bad_answer_and_explanation',
] as const

/** Statuses that represent verified questions — questions should be active */
export const OK_STATUSES: readonly ReviewStatus[] = [
  'perfect', 'tech_perfect',
] as const

/** Check if a status is a confirmed error */
export function isErrorStatus(status: string): boolean {
  return (ERROR_STATUSES as readonly string[]).includes(status)
}

/** Check if a status means the question is verified OK */
export function isOkStatus(status: string): boolean {
  return (OK_STATUSES as readonly string[]).includes(status)
}

/** Human-readable labels for error statuses (used as deactivation_reason) */
export const ERROR_STATUS_LABELS: Record<string, string> = {
  bad_answer: 'Respuesta incorrecta',
  bad_explanation: 'Explicación incorrecta',
  bad_answer_and_explanation: 'Respuesta y explicación incorrectas',
  wrong_article: 'Artículo vinculado incorrecto',
  wrong_article_bad_explanation: 'Artículo incorrecto y explicación incorrecta',
  wrong_article_bad_answer: 'Artículo incorrecto y respuesta incorrecta',
  all_wrong: 'Todo incorrecto (respuesta, explicación y artículo)',
  tech_bad_answer: 'Respuesta incorrecta (informática)',
  tech_bad_answer_and_explanation: 'Respuesta y explicación incorrectas (informática)',
  tech_bad_explanation: 'Explicación incorrecta (informática)',
  invalid_structure: 'Estructura inválida (opciones vacías, texto vacío)',
}

// ============================================
// REVIEW STATS (14 contadores)
// ============================================

export const reviewStatsSchema = z.object({
  total_questions: z.number(),
  verified: z.number(),
  perfect: z.number(),
  bad_explanation: z.number(),
  bad_answer: z.number(),
  bad_answer_and_explanation: z.number(),
  wrong_article: z.number(),
  wrong_article_bad_explanation: z.number(),
  wrong_article_bad_answer: z.number(),
  all_wrong: z.number(),
  tech_perfect: z.number(),
  tech_bad_explanation: z.number(),
  tech_bad_answer: z.number(),
  tech_bad_answer_and_explanation: z.number(),
  pending: z.number(),
  last_verified_at: z.string().nullable(),
})

export type ReviewStats = z.infer<typeof reviewStatsSchema>

export function createEmptyStats(): ReviewStats {
  return {
    total_questions: 0,
    verified: 0,
    perfect: 0,
    bad_explanation: 0,
    bad_answer: 0,
    bad_answer_and_explanation: 0,
    wrong_article: 0,
    wrong_article_bad_explanation: 0,
    wrong_article_bad_answer: 0,
    all_wrong: 0,
    tech_perfect: 0,
    tech_bad_explanation: 0,
    tech_bad_answer: 0,
    tech_bad_answer_and_explanation: 0,
    pending: 0,
    last_verified_at: null,
  }
}

// ============================================
// REQUEST SCHEMAS
// ============================================

export const listRequestSchema = z.object({
  position: z.string().optional(),
  topic_id: z.string().uuid().optional(),
})

export type ListRequest = z.infer<typeof listRequestSchema>

export const updateStatusRequestSchema = z.object({
  questionId: z.string().uuid('questionId debe ser un UUID válido'),
  status: reviewStatusSchema,
})

export type UpdateStatusRequest = z.infer<typeof updateStatusRequestSchema>

export const topicDetailParamsSchema = z.object({
  topicId: z.string().uuid('topicId debe ser un UUID válido'),
})

export type TopicDetailParams = z.infer<typeof topicDetailParamsSchema>

// ============================================
// RESPONSE TYPES
// ============================================

export type TopicWithStats = {
  id: string
  topic_number: number
  title: string
  description: string | null
  position_type: string
  is_active: boolean | null
  stats: ReviewStats
  laws: {
    id: string
    short_name: string
    name: string
    is_virtual: boolean
    article_numbers: string[] | null
  }[]
  hasVirtualLaws: boolean
}

export type TopicBlock = {
  id: string
  title: string
  topics: TopicWithStats[]
}

// ============================================
// SAFE PARSERS
// ============================================

export function safeParseListRequest(params: Record<string, string | null>) {
  return listRequestSchema.safeParse({
    position: params.position ?? undefined,
    topic_id: params.topic_id ?? undefined,
  })
}

export function safeParseUpdateStatus(data: unknown) {
  return updateStatusRequestSchema.safeParse(data)
}

export function safeParseTopicDetail(data: unknown) {
  return topicDetailParamsSchema.safeParse(data)
}
