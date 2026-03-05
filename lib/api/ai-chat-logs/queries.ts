// lib/api/ai-chat-logs/queries.ts
// Drizzle queries para ai_chat_logs

import { getDb } from '@/db/client'
import { aiChatLogs } from '@/db/schema'
import { insertChatLogSchema, type InsertChatLogInput } from './schemas'

/**
 * Inserta un log de interacción de chat en la BD
 * Reemplaza la función inline logChatInteraction que usaba Supabase
 */
export async function insertChatLog(input: InsertChatLogInput): Promise<string | null> {
  try {
    const data = insertChatLogSchema.parse(input)
    const db = getDb()

    const values: typeof aiChatLogs.$inferInsert = {
      userId: data.userId || null,
      message: data.message,
      responsePreview: data.response?.substring(0, 500) || null,
      fullResponse: data.response || null,
      sourcesUsed: data.sources,
      detectedLaws: data.detectedLaws,
      tokensUsed: data.tokensUsed ?? null,
      questionContextId: data.questionContextId || null,
      questionContextLaw: data.questionContextLaw || null,
      suggestionUsed: data.suggestionUsed || null,
      responseTimeMs: data.responseTimeMs ?? null,
      hadError: data.hadError || false,
      errorMessage: data.errorMessage || null,
      userOposicion: data.userOposicion || null,
    }

    // Añadir ID pre-generado si existe
    if (data.logId) {
      values.id = data.logId
    }

    // Campos de discrepancia (solo si se proporcionan)
    if (data.hadDiscrepancy !== undefined) {
      values.hadDiscrepancy = data.hadDiscrepancy
      values.aiSuggestedAnswer = data.aiSuggestedAnswer || null
      values.dbAnswer = data.dbAnswer || null
      values.reanalysisResponse = data.reanalysisResponse || null
    }

    const result = await db
      .insert(aiChatLogs)
      .values(values)
      .returning({ id: aiChatLogs.id })

    return result[0]?.id || null
  } catch (error) {
    console.error('Error inserting chat log:', error)
    return null
  }
}
