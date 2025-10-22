import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function addSeriesIntercaladas21Question() {
  try {
    const supabase = getSupabase()
    
    console.log('🔍 Obteniendo información de categoría y sección...')
    
    // Obtener la categoría y sección
    const { data: category } = await supabase
      .from('psychometric_categories')
      .select('id')
      .eq('category_key', 'series-numericas')
      .single()
    
    const { data: section } = await supabase
      .from('psychometric_sections')
      .select('id')
      .eq('section_key', 'series-numericas')
      .single()
    
    if (!category || !section) {
      console.error('❌ No se encontró la categoría o sección series-numericas')
      return
    }
    
    console.log('✅ Categoría y sección encontradas')
    console.log('📝 Insertando pregunta de series intercaladas...')
    
    // Crear la pregunta
    const questionData = {
      question_text: "Continúe la siguiente serie numérica: 21, 26, 32, 37, 44, 49, 57, ?",
      question_subtype: "sequence_numeric",
      category_id: category.id,
      section_id: section.id,
      option_a: "61",
      option_b: "62", 
      option_c: "63",
      option_d: "64",
      correct_option: 1, // B: 62
      explanation: `🔍 Análisis de la serie:
• Esta es una serie intercalada con dos subseries que se alternan:
• Subserie 1: 21 → 32 → 44 → 57 (posiciones 1, 3, 5, 7)
• Subserie 2: 26 → 37 → 49 → ? (posiciones 2, 4, 6, 8)

📊 Cálculo de diferencias:
• Subserie 1: +11, +12, +13 (diferencias crecientes)
• Subserie 2: +11, +12, +13 (mismo patrón)

✅ Aplicando el patrón:
• 49 + 13 = 62

La respuesta correcta es B: 62`,
      content_data: {
        sequence: ["21", "26", "32", "37", "44", "49", "57", "?"],
        pattern_type: "intercalated",
        solution_method: "manual"
      },
      difficulty: "medium",
      time_limit_seconds: 120,
      cognitive_skills: ["pattern_recognition", "sequence_analysis", "arithmetic"],
      is_active: true,
      is_verified: true
    }
    
    const { data: insertedQuestion, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert(questionData)
      .select()
      .single()
    
    if (insertError) {
      console.error('❌ Error insertando pregunta:', insertError)
      return
    }
    
    console.log('✅ Pregunta insertada exitosamente')
    console.log('📊 ID de la pregunta:', insertedQuestion.id)
    console.log('🔗 URL de debug:', `http://localhost:3000/debug/question/${insertedQuestion.id}`)
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

addSeriesIntercaladas21Question()