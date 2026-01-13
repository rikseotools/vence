import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET: Obtener sugerencias activas ordenadas por prioridad
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('ai_chat_suggestions')
      .select('id, label, message, suggestion_key, emoji, priority')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(6) // Máximo 6 sugerencias visibles

    if (error) {
      console.error('Error fetching suggestions:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, suggestions: data })
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
