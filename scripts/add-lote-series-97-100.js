import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function addSeriesNumericas97_100() {
  try {
    const supabase = getSupabase()

    console.log('🔍 Buscando categoría y sección...')
    
    // Buscar categoría Series Numéricas
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'series-numericas')
      .single()
    
    if (categoryError || !category) {
      console.log('❌ Error al encontrar categoría:', categoryError?.message)
      return
    }
    
    console.log('✅ Categoría encontrada:', category.display_name)
    
    // Buscar sección
    const { data: sections, error: sectionsError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id)
    
    if (sectionsError || !sections?.length) {
      console.log('❌ Error al encontrar secciones:', sectionsError?.message)
      return
    }
    
    const section = sections[0]
    console.log('✅ Sección encontrada:', section.display_name)

    const preguntas = [
      {
        question_text: "¿Qué número continuaría la siguiente serie lógica?: 14 19 29 44 64 89 ¿?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 14, 19, 29, 44, 64, 89, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 19 - 14 = 5
• 29 - 19 = 10  
• 44 - 29 = 15
• 64 - 44 = 20
• 89 - 64 = 25
• Diferencias: 5, 10, 15, 20, 25...

✅ Patrón identificado:
• La serie de diferencias son múltiplos de 5 consecutivos: +5, +10, +15, +20, +25, +30...
• La siguiente diferencia sería +30
• 89 + 30 = 119

La respuesta correcta es A: 119`,
        option_a: "119", option_b: "95", option_c: "125", option_d: "105",
        correct_option: 0
      },
      {
        question_text: "En la pregunta que viene a continuación, Vd. deberá descubrir el segundo número que seguiría la serie: 27 39 47 59 67 ...",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 27, 39, 47, 59, 67, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias alternadas:
• 39 - 27 = 12
• 47 - 39 = 8  
• 59 - 47 = 12
• 67 - 59 = 8
• Diferencias: +12, +8, +12, +8...

✅ Patrón identificado:
• La serie alterna entre diferencias de +12 y +8
• Después de +8, le corresponde +12
• 67 + 12 = 79
• Luego vendría: 79 + 8 = 87

La respuesta correcta es B: 87`,
        option_a: "80", option_b: "87", option_c: "78", option_d: "79",
        correct_option: 1
      },
      {
        question_text: "Indique el número que continúa la serie: 1-4-9-16-25-¿?",
        content_data: {
          pattern_type: "cuadrados",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 1, 4, 9, 16, 25, ?
• Analizamos la relación con los cuadrados perfectos:

📊 Patrón de cuadrados perfectos:
• 1 = 1²
• 4 = 2²
• 9 = 3²
• 16 = 4²
• 25 = 5²
• ? = 6²

✅ Patrón identificado:
• La serie corresponde a los cuadrados de números naturales consecutivos
• El siguiente término sería 6² = 36

La respuesta correcta es B: 36`,
        option_a: "35", option_b: "36", option_c: "24", option_d: "12",
        correct_option: 1
      },
      {
        question_text: "¿Qué número continuaría la siguiente serie lógica?: 25, 29, 35, 43, 53, 65, ¿?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 25, 29, 35, 43, 53, 65, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 29 - 25 = 4
• 35 - 29 = 6  
• 43 - 35 = 8
• 53 - 43 = 10
• 65 - 53 = 12
• Diferencias: 4, 6, 8, 10, 12...

✅ Patrón identificado:
• Las diferencias aumentan de 2 en 2: +4, +6, +8, +10, +12, +14...
• La siguiente diferencia sería +14
• 65 + 14 = 79

La respuesta correcta es C: 79`,
        option_a: "68", option_b: "69", option_c: "79", option_d: "78",
        correct_option: 2
      }
    ]

    const insertedIds = []
    
    for (let i = 0; i < preguntas.length; i++) {
      const pregunta = preguntas[i]
      const questionData = {
        category_id: category.id,
        section_id: section.id,
        ...pregunta,
        difficulty: 'medium',
        time_limit_seconds: 120,
        question_subtype: 'sequence_numeric',
        is_active: true,
        is_verified: true
      }

      const { data, error } = await supabase
        .from('psychometric_questions')
        .insert([questionData])
        .select()
      
      if (error) {
        console.log(`❌ Error en pregunta ${i+97}:`, error.message)
      } else {
        insertedIds.push(data[0]?.id)
        console.log(`✅ Pregunta ${i+97} añadida: ${data[0]?.id}`)
      }
    }
    
    console.log('')
    console.log('🎯 RESUMEN FINAL:')
    console.log(`✅ ${insertedIds.length} preguntas de series numéricas añadidas (P97-P100)`)
    console.log('')
    console.log('🔗 LINKS DE DEBUG INDIVIDUALES:')
    insertedIds.forEach((id, index) => {
      console.log(`   P${index + 97}: http://localhost:3000/debug/question/${id}`)
    })
    
    return insertedIds
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
    return []
  }
}

addSeriesNumericas97_100()