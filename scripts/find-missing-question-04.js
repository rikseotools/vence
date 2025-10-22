import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function findMissingQuestion04() {
  try {
    const supabase = getSupabase()
    
    console.log('🔍 Buscando pregunta 04 (1-3-5-7-9-11)...')
    
    // Buscar pregunta por texto
    const { data: questions } = await supabase
      .from('psychometric_questions')
      .select('*')
      .ilike('question_text', '%1-3-5-7-9-11%')
    
    console.log('📊 Resultados de búsqueda:', questions?.length || 0)
    
    if (questions && questions.length > 0) {
      questions.forEach(q => {
        console.log('✅ Encontrada:')
        console.log(`   ID: ${q.id}`)
        console.log(`   Texto: ${q.question_text}`)
        console.log(`   Activa: ${q.is_active}`)
        console.log(`   Creada: ${q.created_at}`)
      })
    } else {
      console.log('❌ No se encontró la pregunta 04')
      console.log('🔧 Creando pregunta 04...')
      
      // Obtener categoría y sección
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
      
      const questionData = {
        question_text: "Indique el número que continúa la serie: 1-3-5-7-9-11-?",
        question_subtype: "sequence_numeric",
        category_id: category.id,
        section_id: section.id,
        option_a: "12",
        option_b: "13",
        option_c: "14",
        option_d: "15",
        correct_option: 1, // B: 13
        explanation: `🔍 Análisis de la serie:
• Esta es una serie de números impares consecutivos:
• 1, 3, 5, 7, 9, 11...
• Cada número aumenta en 2 unidades

📊 Patrón identificado:
• +2, +2, +2, +2, +2, +2...
• Serie aritmética con diferencia común d=2

✅ Aplicando el patrón:
• 11 + 2 = 13

La respuesta correcta es B: 13`,
        content_data: {
          sequence: ["1", "3", "5", "7", "9", "11", "?"],
          pattern_type: "arithmetic_progression",
          solution_method: "manual"
        },
        difficulty: "easy",
        time_limit_seconds: 90,
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
        console.error('❌ Error insertando pregunta 04:', insertError)
      } else {
        console.log('✅ Pregunta 04 creada exitosamente')
        console.log(`📊 ID: ${insertedQuestion.id}`)
        console.log(`🔗 URL: http://localhost:3000/debug/question/${insertedQuestion.id}`)
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

findMissingQuestion04()