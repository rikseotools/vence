import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * GET /api/verify-articles/errors
 * Obtiene los últimos errores de verificación para una ley
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const lawId = searchParams.get('lawId')
    const limit = parseInt(searchParams.get('limit') || '10')
    const articles = searchParams.get('articles') // Lista de artículos separados por coma

    if (!lawId) {
      return Response.json({
        success: false,
        error: 'Se requiere lawId'
      }, { status: 400 })
    }

    let query = supabase
      .from('ai_verification_errors')
      .select('*')
      .eq('law_id', lawId)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Si se especifican artículos, filtrar solo esos
    if (articles) {
      const articleList = articles.split(',').map(a => a.trim())
      query = query.in('article_number', articleList)
    }

    const { data: errors, error } = await query

    if (error) {
      throw error
    }

    return Response.json({
      success: true,
      errors: errors || [],
      filtered: !!articles
    })

  } catch (error) {
    console.error('Error obteniendo logs de errores:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
