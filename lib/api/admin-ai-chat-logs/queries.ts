// lib/api/admin-ai-chat-logs/queries.ts
import { getDb } from '@/db/client'
import { aiChatLogs, userProfiles } from '@/db/schema'
import { desc, eq, isNull, isNotNull, inArray } from 'drizzle-orm'
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

  // Obtener estadísticas generales
  const allLogs = await db
    .select({
      feedback: aiChatLogs.feedback,
      hadError: aiChatLogs.hadError
    })
    .from(aiChatLogs)

  const stats = {
    total: allLogs.length,
    positive: allLogs.filter(l => l.feedback === 'positive').length,
    negative: allLogs.filter(l => l.feedback === 'negative').length,
    noFeedback: allLogs.filter(l => !l.feedback).length,
    errors: allLogs.filter(l => l.hadError).length
  }

  // Query paginada con filtro
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

  let logs
  if (feedbackFilter === 'positive') {
    logs = await db.select(baseSelect).from(aiChatLogs)
      .where(eq(aiChatLogs.feedback, 'positive'))
      .orderBy(desc(aiChatLogs.createdAt))
      .offset(offset).limit(limit)
  } else if (feedbackFilter === 'negative') {
    logs = await db.select(baseSelect).from(aiChatLogs)
      .where(eq(aiChatLogs.feedback, 'negative'))
      .orderBy(desc(aiChatLogs.createdAt))
      .offset(offset).limit(limit)
  } else if (feedbackFilter === 'none') {
    logs = await db.select(baseSelect).from(aiChatLogs)
      .where(isNull(aiChatLogs.feedback))
      .orderBy(desc(aiChatLogs.createdAt))
      .offset(offset).limit(limit)
  } else {
    logs = await db.select(baseSelect).from(aiChatLogs)
      .orderBy(desc(aiChatLogs.createdAt))
      .offset(offset).limit(limit)
  }

  // Enriquecer con info de usuarios
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

  // Top sugerencias
  const suggestionsData = await db
    .select({ suggestionUsed: aiChatLogs.suggestionUsed })
    .from(aiChatLogs)
    .where(isNotNull(aiChatLogs.suggestionUsed))

  const suggestionCounts: Record<string, number> = {}
  for (const s of suggestionsData) {
    if (s.suggestionUsed) {
      suggestionCounts[s.suggestionUsed] = (suggestionCounts[s.suggestionUsed] || 0) + 1
    }
  }
  const topSuggestions = Object.entries(suggestionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // Top leyes
  const lawLogsData = await db
    .select({ detectedLaws: aiChatLogs.detectedLaws })
    .from(aiChatLogs)

  const lawCounts: Record<string, number> = {}
  for (const l of lawLogsData) {
    const laws = (l.detectedLaws as string[] | null) || []
    for (const law of laws) {
      lawCounts[law] = (lawCounts[law] || 0) + 1
    }
  }
  const topLaws = Object.entries(lawCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // Tiempo de respuesta promedio
  const responseTimesData = await db
    .select({ responseTimeMs: aiChatLogs.responseTimeMs })
    .from(aiChatLogs)
    .where(isNotNull(aiChatLogs.responseTimeMs))

  const validTimes = responseTimesData.filter(r => r.responseTimeMs !== null)
  const avgResponseTime = validTimes.length
    ? Math.round(validTimes.reduce((sum, r) => sum + r.responseTimeMs!, 0) / validTimes.length)
    : 0

  const satisfactionRate = stats.positive + stats.negative > 0
    ? Math.round((stats.positive / (stats.positive + stats.negative)) * 100)
    : null

  return {
    success: true,
    logs: enrichedLogs,
    stats: {
      ...stats,
      avgResponseTime,
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
