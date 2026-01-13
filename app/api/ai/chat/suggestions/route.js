import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET: Obtener sugerencias activas filtradas por oposición y ordenadas por CTR
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const oposicionId = searchParams.get('oposicionId')

    // Obtener sugerencias con conteo de clicks
    // Filtramos por oposicion_id específica O sugerencias universales (null)
    let query = supabase
      .from('ai_chat_suggestions')
      .select(`
        id,
        label,
        message,
        suggestion_key,
        emoji,
        priority,
        oposicion_id,
        ai_chat_suggestion_clicks(count)
      `)
      .eq('is_active', true)

    // Filtrar por oposición: mostrar las de esa oposición + las universales
    if (oposicionId) {
      query = query.or(`oposicion_id.eq.${oposicionId},oposicion_id.is.null`)
    } else {
      // Si no hay oposición, solo mostrar las universales
      query = query.is('oposicion_id', null)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching suggestions:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Procesar y ordenar por CTR (clicks) descendente, luego por prioridad
    const suggestions = data
      .map(s => ({
        id: s.id,
        label: s.label,
        message: s.message,
        suggestion_key: s.suggestion_key,
        emoji: s.emoji,
        priority: s.priority,
        oposicion_id: s.oposicion_id,
        clicks: s.ai_chat_suggestion_clicks?.[0]?.count || 0
      }))
      .sort((a, b) => {
        // Primero por clicks (CTR), luego por prioridad
        if (b.clicks !== a.clicks) return b.clicks - a.clicks
        return b.priority - a.priority
      })
      .slice(0, 6) // Máximo 6 sugerencias

    return Response.json({ success: true, suggestions })
  } catch (error) {
    console.error('Error in suggestions GET:', error)
    return Response.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

// POST: Registrar click en una sugerencia
export async function POST(request) {
  try {
    const { suggestionId, suggestionKey, userId, sessionId } = await request.json()

    // Si tenemos suggestionKey pero no suggestionId, buscar el ID
    let finalSuggestionId = suggestionId
    if (!suggestionId && suggestionKey) {
      const { data: suggestion } = await supabase
        .from('ai_chat_suggestions')
        .select('id')
        .eq('suggestion_key', suggestionKey)
        .single()

      if (suggestion) {
        finalSuggestionId = suggestion.id
      }
    }

    if (!finalSuggestionId) {
      return Response.json({ success: false, error: 'Sugerencia no encontrada' }, { status: 400 })
    }

    // Registrar click
    const { error } = await supabase
      .from('ai_chat_suggestion_clicks')
      .insert({
        suggestion_id: finalSuggestionId,
        user_id: userId || null,
        session_id: sessionId || null
      })

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
