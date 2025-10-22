import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function addSeriesCorrelativas99Question() {
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
    console.log('📝 Insertando pregunta de series correlativas...')
    
    // Crear la pregunta
    const questionData = {
      question_text: "Continúe la siguiente serie numérica: 99, 96, 94, 91, 89, 86, ?",
      question_subtype: "sequence_numeric",
      category_id: category.id,
      section_id: section.id,
      option_a: "83",
      option_b: "85", 
      option_c: "84",
      option_d: "82",
      correct_option: 2, // C: 84
      explanation: `🔍 Análisis de la serie:
• Esta es una serie correlativa donde las diferencias van alternando:
• 99 → 96: -3
• 96 → 94: -2 
• 94 → 91: -3
• 91 → 89: -2
• 89 → 86: -3
• 86 → ?: -2

📊 Patrón identificado:
• Las diferencias alternan entre -3 y -2
• Posiciones impares: -3
• Posiciones pares: -2

✅ Aplicando el patrón:
• 86 - 2 = 84

La respuesta correcta es C: 84`,
      content_data: {
        sequence: ["99", "96", "94", "91", "89", "86", "?"],
        pattern_type: "alternating_differences",
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

addSeriesCorrelativas99Question()