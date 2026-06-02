import { NextRequest } from 'next/server'

import { getAdminDb } from '@/db/client'
import { oposiciones, aiChatSuggestions, aiChatSuggestionClicks } from '@/db/schema'
import { and, eq, or, isNull, sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

// getAdminDb() = Drizzle con DATABASE_URL, bypass RLS (equivalente al
// service_role). Agnóstico de proveedor.
const db = () => getAdminDb()

interface SuggestionRow {
  id: string
  label: string
  message: string
  suggestion_key: string
  emoji: string | null
  priority: number | null
  oposicion_id: string | null
  clicks: number
}

interface ProcessedSuggestion {
  id: string
  label: string
  message: string
  suggestion_key: string
  emoji: string | null
  priority: number | null
  oposicion_id: string | null
  clicks: number
}

// GET: Obtener sugerencias activas filtradas por oposición/contexto/página y ordenadas por CTR
async function _GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    let oposicionId: string | null = searchParams.get('oposicionId')
    const contextType: string = searchParams.get('contextType') || 'general' // 'general' | 'law_context'
    const pageContext: string = searchParams.get('pageContext') || 'general' // 'general' | 'test' | 'psicotecnico' | 'psicotecnico_test'
    const lawName: string | null = searchParams.get('lawName') // Para reemplazar {lawName} en plantillas

    console.log('🔍 [Suggestions API] Request params:', { oposicionId, contextType, pageContext, lawName })

    // Si oposicionId es un slug (no UUID), buscar el UUID real
    if (oposicionId && !oposicionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // Convertir underscore a dash para buscar el slug correcto
      const slugToSearch = oposicionId.replace(/_/g, '-')
      console.log('🔍 [Suggestions API] Converting slug:', oposicionId, '→', slugToSearch)

      const [oposicion] = await db()
        .select({ id: oposiciones.id })
        .from(oposiciones)
        .where(eq(oposiciones.slug, slugToSearch))
        .limit(1)

      console.log('🔍 [Suggestions API] Oposicion lookup result:', oposicion || 'not found')

      if (oposicion) {
        oposicionId = oposicion.id
        console.log('🔍 [Suggestions API] Using UUID:', oposicionId)
      } else {
        // No se encontró UUID para este slug, no filtrar por oposicion
        console.log('⚠️ [Suggestions API] Slug not found in oposiciones table, ignoring oposicion filter')
        oposicionId = null
      }
    }

    // Filtro por oposición solo para sugerencias generales de página general
    // (el resto de page_context no filtra por oposición).
    const oposicionFilter =
      contextType === 'general' && pageContext === 'general'
        ? oposicionId
          ? or(eq(aiChatSuggestions.oposicionId, oposicionId), isNull(aiChatSuggestions.oposicionId))
          : isNull(aiChatSuggestions.oposicionId)
        : undefined

    // Obtener sugerencias con conteo de clicks. El embed agregado
    // `ai_chat_suggestion_clicks(count)` de PostgREST → leftJoin + count + groupBy.
    let data: SuggestionRow[] = []
    let error: Error | null = null
    try {
      data = await db()
        .select({
          id: aiChatSuggestions.id,
          label: aiChatSuggestions.label,
          message: aiChatSuggestions.message,
          suggestion_key: aiChatSuggestions.suggestionKey,
          emoji: aiChatSuggestions.emoji,
          priority: aiChatSuggestions.priority,
          oposicion_id: aiChatSuggestions.oposicionId,
          clicks: sql<number>`count(${aiChatSuggestionClicks.id})::int`,
        })
        .from(aiChatSuggestions)
        .leftJoin(
          aiChatSuggestionClicks,
          eq(aiChatSuggestionClicks.suggestionId, aiChatSuggestions.id),
        )
        .where(and(
          eq(aiChatSuggestions.isActive, true),
          eq(aiChatSuggestions.contextType, contextType),
          eq(aiChatSuggestions.pageContext, pageContext),
          oposicionFilter,
        ))
        .groupBy(aiChatSuggestions.id)
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e))
    }

    if (error) {
      console.error('Error fetching suggestions:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Procesar y ordenar por CTR (clicks) descendente, luego por prioridad
    const suggestions: ProcessedSuggestion[] = data
      .map((s: SuggestionRow): ProcessedSuggestion => {
        // Reemplazar {lawName} en label y message si se proporciona
        let label = s.label
        let message = s.message
        if (lawName) {
          label = label.replace(/{lawName}/g, lawName)
          message = message.replace(/{lawName}/g, lawName)
        }

        return {
          id: s.id,
          label,
          message,
          suggestion_key: s.suggestion_key,
          emoji: s.emoji,
          priority: s.priority,
          oposicion_id: s.oposicion_id,
          clicks: Number(s.clicks) || 0,
        }
      })
      .sort((a: ProcessedSuggestion, b: ProcessedSuggestion): number => {
        // Primero por clicks (CTR), luego por prioridad
        if (b.clicks !== a.clicks) return b.clicks - a.clicks
        return (b.priority ?? 0) - (a.priority ?? 0)
      })
      .slice(0, 6) // Máximo 6 sugerencias

    console.log('🔍 [Suggestions API] Returning', suggestions.length, 'suggestions:', suggestions.map(s => s.label))

    return Response.json({ success: true, suggestions })
  } catch (error) {
    console.error('Error in suggestions GET:', error)
    return Response.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

// POST: Registrar click en una sugerencia
async function _POST(request: NextRequest): Promise<Response> {
  try {
    const { suggestionId, suggestionKey, userId, sessionId } = await request.json() as {
      suggestionId?: string
      suggestionKey?: string
      userId?: string
      sessionId?: string
    }

    // Si tenemos suggestionKey pero no suggestionId, buscar el ID
    let finalSuggestionId: string | undefined = suggestionId
    if (!suggestionId && suggestionKey) {
      const [suggestion] = await db()
        .select({ id: aiChatSuggestions.id })
        .from(aiChatSuggestions)
        .where(eq(aiChatSuggestions.suggestionKey, suggestionKey))
        .limit(1)

      if (suggestion) {
        finalSuggestionId = suggestion.id
      }
    }

    if (!finalSuggestionId) {
      // Sugerencia no existe en BD — no es un error, simplemente no trackear
      // Las sugerencias están hardcodeadas en el widget, no todas están en BD
      return Response.json({ success: true, tracked: false })
    }

    // Registrar click
    let error: unknown = null
    try {
      await db().insert(aiChatSuggestionClicks).values({
        suggestionId: finalSuggestionId,
        userId: userId || null,
        sessionId: sessionId || null,
      })
    } catch (e) {
      error = e
    }

    if (error) {
      console.error('Error tracking click:', error)
      // No fallar si hay error de tracking, solo loguearlo
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Error in suggestions POST:', error)
    return Response.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/ai/chat/suggestions', _GET)
export const POST = withErrorLogging('/api/ai/chat/suggestions', _POST)
