// lib/api/admin-ai-chat-logs/queries.ts
import { getAdminDb as getDb } from '@/db/client'
import { aiChatLogs, userProfiles } from '@/db/schema'
import { desc, eq, isNull, inArray, and, sql, count } from 'drizzle-orm'
import type { AiChatLogsResponse } from './schemas'

// ============================================
// OBTENER LOGS DE AI CHAT CON ESTADÍSTICAS
// ============================================

export async function getAiChatLogs(
  page: number,
  limit: number,
  feedbackFilter?: string
): Promise<AiChatLogsResponse> {
  const db = getDb()
  const offset = (page - 1) * limit
  const notReviewed = isNull(aiChatLogs.reviewedAt)

  // 1. Stats agregados en una sola query SQL
  const [statsRow] = await db
    .select({
      total: count(),
      positive: sql<number>`count(*) filter (where ${aiChatLogs.feedback} = 'positive')`,
      negative: sql<number>`count(*) filter (where ${aiChatLogs.feedback} = 'negative')`,
      noFeedback: sql<number>`count(*) filter (where ${aiChatLogs.feedback} is null)`,
      errors: sql<number>`count(*) filter (where ${aiChatLogs.hadError} = true)`,
      avgResponseTime: sql<number>`coalesce(avg(${aiChatLogs.responseTimeMs})::int, 0)`,
    })
    .from(aiChatLogs)
    .where(notReviewed)

  const stats = {
    total: Number(statsRow.total),
    positive: Number(statsRow.positive),
    negative: Number(statsRow.negative),
    noFeedback: Number(statsRow.noFeedback),
    errors: Number(statsRow.errors),
    avgResponseTime: Number(statsRow.avgResponseTime),
  }

  const satisfactionRate = stats.positive + stats.negative > 0
    ? Math.round((stats.positive / (stats.positive + stats.negative)) * 100)
    : null

  // 2. Top sugerencias y top leyes en paralelo con SQL agregado
  const [topSuggestionsRaw, topLawsRaw] = await Promise.all([
    db.execute(sql`
      select suggestion_used as name, count(*)::int as count
      from ai_chat_logs
      where reviewed_at is null and suggestion_used is not null
      group by suggestion_used
      order by count desc
      limit 5
    `),
    db.execute(sql`
      select law, count(*)::int as count
      from ai_chat_logs, jsonb_array_elements_text(detected_laws) as law
      where reviewed_at is null and detected_laws is not null
      group by law
      order by count desc
      limit 5
    `),
  ])

  const topSuggestions = ((topSuggestionsRaw as { rows?: unknown[] }).rows as { name: string; count: number }[] ?? [])
    .map(r => ({ name: r.name, count: Number(r.count) }))
  const topLaws = ((topLawsRaw as { rows?: unknown[] }).rows as { law: string; count: number }[] ?? [])
    .map(r => ({ name: r.law, count: Number(r.count) }))

  // 3. Query paginada con filtro
  const baseSelect = {
    id: aiChatLogs.id,
    userId: aiChatLogs.userId,
    message: aiChatLogs.message,
    responsePreview: aiChatLogs.responsePreview,
    fullResponse: aiChatLogs.fullResponse,
    sourcesUsed: aiChatLogs.sourcesUsed,
    questionContextId: aiChatLogs.questionContextId,
    questionContextLaw: aiChatLogs.questionContextLaw,
    suggestionUsed: aiChatLogs.suggestionUsed,
    responseTimeMs: aiChatLogs.responseTimeMs,
    tokensUsed: aiChatLogs.tokensUsed,
    hadError: aiChatLogs.hadError,
    errorMessage: aiChatLogs.errorMessage,
    feedback: aiChatLogs.feedback,
    feedbackComment: aiChatLogs.feedbackComment,
    detectedLaws: aiChatLogs.detectedLaws,
    createdAt: aiChatLogs.createdAt
  }

  const filterCondition =
    feedbackFilter === 'positive' ? and(notReviewed, eq(aiChatLogs.feedback, 'positive')) :
    feedbackFilter === 'negative' ? and(notReviewed, eq(aiChatLogs.feedback, 'negative')) :
    feedbackFilter === 'none' ? and(notReviewed, isNull(aiChatLogs.feedback)) :
    notReviewed

  const logs = await db.select(baseSelect).from(aiChatLogs)
    .where(filterCondition)
    .orderBy(desc(aiChatLogs.createdAt))
    .offset(offset).limit(limit)

  // 4. Enriquecer con info de usuarios
  const userIds = [...new Set(logs.filter(l => l.userId).map(l => l.userId!))]
  const usersMap: Record<string, { id: string; display_name: string | null; email: string }> = {}

  if (userIds.length > 0) {
    const users = await db
      .select({
        id: userProfiles.id,
        fullName: userProfiles.fullName,
        email: userProfiles.email
      })
      .from(userProfiles)
      .where(inArray(userProfiles.id, userIds))

    for (const u of users) {
      usersMap[u.id] = { id: u.id, display_name: u.fullName, email: u.email }
    }
  }

  const enrichedLogs = logs.map(log => ({
    id: log.id,
    user_id: log.userId,
    message: log.message,
    response_preview: log.responsePreview,
    full_response: log.fullResponse,
    sources_used: log.sourcesUsed,
    question_context_id: log.questionContextId,
    question_context_law: log.questionContextLaw,
    suggestion_used: log.suggestionUsed,
    response_time_ms: log.responseTimeMs,
    tokens_used: log.tokensUsed,
    had_error: log.hadError,
    error_message: log.errorMessage,
    feedback: log.feedback,
    feedback_comment: log.feedbackComment,
    detected_laws: log.detectedLaws,
    created_at: log.createdAt,
    user: log.userId
      ? usersMap[log.userId] || { display_name: 'Usuario', email: null }
      : null
  }))

  return {
    success: true,
    logs: enrichedLogs,
    stats: {
      ...stats,
      satisfactionRate
    },
    topSuggestions,
    topLaws,
    pagination: {
      page,
      limit,
      hasMore: logs.length === limit
    }
  }
}
