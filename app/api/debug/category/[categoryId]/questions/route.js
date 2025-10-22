import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET(request, { params }) {
  try {
    const { categoryId } = params
    const supabase = getSupabase()

    console.log('🔍 Debug API: Obteniendo preguntas de categoría:', categoryId)

    // Obtener todas las preguntas de la categoría especificada
    const { data: questions, error } = await supabase
      .from('psychometric_questions')
      .select(`
        id,
        question_text,
        question_subtype,
        created_at,
        category_id,
        section_id
      `)
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('❌ Error obteniendo preguntas de categoría:', error)
      return Response.json({ 
        error: 'Error obteniendo preguntas de categoría',
        details: error.message 
      }, { status: 500 })
    }

    console.log(`✅ Encontradas ${questions?.length || 0} preguntas en categoría ${categoryId}`)

    return Response.json({
      questions: questions || [],
      total: questions?.length || 0
    })

  } catch (error) {
    console.error('❌ Error inesperado en debug/category API:', error)
    return Response.json({ 
      error: 'Error interno del servidor',
      details: error.message 
    }, { status: 500 })
  }
}