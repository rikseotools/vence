import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET: Obtener sugerencias activas filtradas por oposición/contexto/página y ordenadas por CTR
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    let oposicionId = searchParams.get('oposicionId')
    const contextType = searchParams.get('contextType') || 'general' // 'general' | 'law_context'
    const pageContext = searchParams.get('pageContext') || 'general' // 'general' | 'test' | 'psicotecnico' | 'psicotecnico_test'
    const lawName = searchParams.get('lawName') // Para reemplazar {lawName} en plantillas

    console.log('🔍 [Suggestions API] Request params:', { oposicionId, contextType, pageContext, lawName })

    // Si oposicionId es un slug (no UUID), buscar el UUID real
    if (oposicionId && !oposicionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // Convertir underscore a dash para buscar el slug correcto
      const slugToSearch = oposicionId.replace(/_/g, '-')
      console.log('🔍 [Suggestions API] Converting slug:', oposicionId, '→', slugToSearch)

      const { data: oposicion, error: oposError } = await supabase
        .from('oposiciones')
        .select('id')
        .eq('slug', slugToSearch)
        .single()

      console.log('🔍 [Suggestions API] Oposicion lookup result:', oposicion, oposError?.message)

      if (oposicion) {
        oposicionId = oposicion.id
        console.log('🔍 [Suggestions API] Using UUID:', oposicionId)
      }
    }

    // Obtener sugerencias con conteo de clicks
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
        context_type,
        page_context,
        ai_chat_suggestion_clicks(count)
      `)
      .eq('is_active', true)
      .eq('context_type', contextType)
      .eq('page_context', pageContext)

    // Filtrar por oposición solo para sugerencias generales de página general
    if (contextType === 'general' && pageContext === 'general') {
      if (oposicionId) {
        query = query.or(`oposicion_id.eq.${oposicionId},oposicion_id.is.null`)
      } else {
        query = query.is('oposicion_id', null)
      }
    }
    // law_context y otros page_context no filtran por oposición

    const { data, error } = await query

    if (error) {
      console.error('Error fetching suggestions:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Procesar y ordenar por CTR (clicks) descendente, luego por prioridad
    const suggestions = data
      .map(s => {
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
          clicks: s.ai_chat_suggestion_clicks?.[0]?.count || 0
        }
      })
      .sort((a, b) => {
        // Primero por clicks (CTR), luego por prioridad
        if (b.clicks !== a.clicks) return b.clicks - a.clicks
        return b.priority - a.priority
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
