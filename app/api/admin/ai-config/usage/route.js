import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * GET /api/admin/ai-config/usage
 * Obtiene estadísticas de uso de las APIs de IA
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30')
  const provider = searchParams.get('provider')

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = supabase
      .from('ai_api_usage')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (provider) {
      query = query.eq('provider', provider)
    }

    const { data: usageData, error } = await query

    if (error) throw error

    // Calcular estadísticas por proveedor
    const stats = {}
    const usage = usageData || []

    usage.forEach(entry => {
      const prov = entry.provider
      if (!stats[prov]) {
        stats[prov] = {
          provider: prov,
          total_requests: 0,
          total_input_tokens: 0,
          total_output_tokens: 0,
          total_tokens: 0,
          total_questions_verified: 0,
          by_model: {},
          by_feature: {},
          by_day: {}
        }
      }

      stats[prov].total_requests++
      stats[prov].total_input_tokens += entry.input_tokens || 0
      stats[prov].total_output_tokens += entry.output_tokens || 0
      stats[prov].total_tokens += entry.total_tokens || 0
      stats[prov].total_questions_verified += entry.questions_count || 0

      // Por modelo
      const model = entry.model || 'unknown'
      if (!stats[prov].by_model[model]) {
        stats[prov].by_model[model] = { requests: 0, tokens: 0 }
      }
      stats[prov].by_model[model].requests++
      stats[prov].by_model[model].tokens += entry.total_tokens || 0

      // Por feature
      const feature = entry.feature || 'unknown'
      if (!stats[prov].by_feature[feature]) {
        stats[prov].by_feature[feature] = { requests: 0, tokens: 0 }
      }
      stats[prov].by_feature[feature].requests++
      stats[prov].by_feature[feature].tokens += entry.total_tokens || 0

      // Por día
      const day = entry.created_at.split('T')[0]
      if (!stats[prov].by_day[day]) {
        stats[prov].by_day[day] = { requests: 0, tokens: 0 }
      }
      stats[prov].by_day[day].requests++
      stats[prov].by_day[day].tokens += entry.total_tokens || 0
    })

    // Calcular costes estimados (precios aproximados por 1M tokens)
    const PRICES = {
      openai: {
        'gpt-4o-mini': { input: 0.15, output: 0.60 },
        'gpt-4o': { input: 2.50, output: 10.00 },
        'gpt-4-turbo': { input: 10.00, output: 30.00 }
      },
      anthropic: {
        'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
        'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
        'claude-3-opus-20240229': { input: 15.00, output: 75.00 }
      },
      google: {
        'gemini-1.5-flash': { input: 0.075, output: 0.30 },
        'gemini-1.5-flash-8b': { input: 0.0375, output: 0.15 },
        'gemini-1.5-pro': { input: 1.25, output: 5.00 },
        'gemini-2.0-flash-exp': { input: 0.075, output: 0.30 }
      }
    }

    // Añadir estimación de costes
    Object.values(stats).forEach(provStats => {
      let totalCost = 0
      Object.entries(provStats.by_model).forEach(([model, data]) => {
        const prices = PRICES[provStats.provider]?.[model]
        if (prices) {
          // Asumimos 50% input, 50% output como aproximación
          const inputTokens = data.tokens * 0.5
          const outputTokens = data.tokens * 0.5
          const cost = (inputTokens / 1000000 * prices.input) + (outputTokens / 1000000 * prices.output)
          data.estimated_cost_usd = Math.round(cost * 10000) / 10000
          totalCost += cost
        }
      })
      provStats.estimated_total_cost_usd = Math.round(totalCost * 10000) / 10000
    })

    return Response.json({
      success: true,
      period: {
        days,
        from: startDate.toISOString(),
        to: new Date().toISOString()
      },
      stats: Object.values(stats),
      total_records: usage.length
    })

  } catch (error) {
    console.error('Error obteniendo uso de APIs:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
