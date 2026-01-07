import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const feedbackFilter = searchParams.get('feedback') // 'positive', 'negative', 'none', 'all'
    const offset = (page - 1) * limit

    // Obtener estadísticas generales
    const { data: statsData } = await supabase
      .from('ai_chat_logs')
      .select('feedback, had_error', { count: 'exact' })

    const stats = {
      total: statsData?.length || 0,
      positive: statsData?.filter(l => l.feedback === 'positive').length || 0,
      negative: statsData?.filter(l => l.feedback === 'negative').length || 0,
      noFeedback: statsData?.filter(l => !l.feedback).length || 0,
      errors: statsData?.filter(l => l.had_error).length || 0
    }

    // Query base para logs
    let query = supabase
      .from('ai_chat_logs')
      .select(`
        id,
        user_id,
        message,
        response_preview,
        sources_used,
        question_context_law,
        suggestion_used,
        response_time_ms,
        had_error,
        error_message,
        feedback,
        feedback_comment,
        detected_laws,
        created_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Aplicar filtro de feedback
    if (feedbackFilter === 'positive') {
      query = query.eq('feedback', 'positive')
    } else if (feedbackFilter === 'negative') {
      query = query.eq('feedback', 'negative')
    } else if (feedbackFilter === 'none') {
      query = query.is('feedback', null)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('Error obteniendo logs:', error)
      return Response.json({
        success: false,
        error: 'Error obteniendo logs'
      }, { status: 500 })
    }

    // Obtener info de usuarios si hay logs
    let usersMap = {}
    if (logs?.length > 0) {
      const userIds = [...new Set(logs.filter(l => l.user_id).map(l => l.user_id))]
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, display_name, email')
          .in('id', userIds)

        users?.forEach(u => {
          usersMap[u.id] = u
        })
      }
    }

    // Enriquecer logs con info de usuario
    const enrichedLogs = logs?.map(log => ({
      ...log,
      user: log.user_id ? usersMap[log.user_id] || { display_name: 'Usuario', email: null } : null
    }))

    // Obtener sugerencias más usadas
    const { data: topSuggestions } = await supabase
      .from('ai_chat_logs')
      .select('suggestion_used')
      .not('suggestion_used', 'is', null)

    const suggestionCounts = {}
    topSuggestions?.forEach(s => {
      suggestionCounts[s.suggestion_used] = (suggestionCounts[s.suggestion_used] || 0) + 1
    })
    const topSuggestionsList = Object.entries(suggestionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    // Obtener leyes más consultadas
    const { data: lawLogs } = await supabase
      .from('ai_chat_logs')
      .select('detected_laws')
      .not('detected_laws', 'eq', '[]')

    const lawCounts = {}
    lawLogs?.forEach(l => {
      const laws = l.detected_laws || []
      laws.forEach(law => {
        lawCounts[law] = (lawCounts[law] || 0) + 1
      })
    })
    const topLaws = Object.entries(lawCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    // Calcular tiempo de respuesta promedio
    const { data: responseTimes } = await supabase
      .from('ai_chat_logs')
      .select('response_time_ms')
      .not('response_time_ms', 'is', null)
      .eq('had_error', false)

    const avgResponseTime = responseTimes?.length
      ? Math.round(responseTimes.reduce((sum, r) => sum + r.response_time_ms, 0) / responseTimes.length)
      : 0

    return Response.json({
      success: true,
      logs: enrichedLogs,
      stats: {
        ...stats,
        avgResponseTime,
        satisfactionRate: stats.positive + stats.negative > 0
          ? Math.round((stats.positive / (stats.positive + stats.negative)) * 100)
          : null
      },
      topSuggestions: topSuggestionsList,
      topLaws,
      pagination: {
        page,
        limit,
        hasMore: logs?.length === limit
      }
    })

  } catch (error) {
    console.error('Error en ai-chat-logs:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}
