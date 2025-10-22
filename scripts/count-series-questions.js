import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function countSeriesQuestions() {
  try {
    const supabase = getSupabase()
    
    console.log('🔍 Contando preguntas de series numéricas...')
    
    // Obtener la categoría
    const { data: category } = await supabase
      .from('psychometric_categories')
      .select('id')
      .eq('category_key', 'series-numericas')
      .single()
    
    if (!category) {
      console.error('❌ No se encontró la categoría series-numericas')
      return
    }
    
    // Contar preguntas
    const { data: questions, count } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, created_at', { count: 'exact' })
      .eq('category_id', category.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    
    console.log(`✅ Total de preguntas activas: ${count}`)
    console.log('\n📊 Lista de preguntas:')
    
    questions?.forEach((q, index) => {
      const shortText = q.question_text.substring(0, 50) + '...'
      const date = new Date(q.created_at).toLocaleDateString('es-ES')
      console.log(`${(index + 1).toString().padStart(2, '0')}. ${shortText} (${date})`)
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

countSeriesQuestions()