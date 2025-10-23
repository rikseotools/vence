import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function addSeriesNumericas82_96() {
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
        question_text: "¿Qué número seguiría en la siguiente serie?: 7, 8, 11, 16, 23, ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 7, 8, 11, 16, 23, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 8 - 7 = 1
• 11 - 8 = 3  
• 16 - 11 = 5
• 23 - 16 = 7
• Diferencias: 1, 3, 5, 7...

✅ Patrón identificado:
• La serie de diferencias son números impares consecutivos: 1, 3, 5, 7, 9...
• La siguiente diferencia sería 9
• 23 + 9 = 32

La respuesta correcta es A: 32`,
        option_a: "32", option_b: "30", option_c: "31", option_d: "29",
        correct_option: 0
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 64, 32, 16, 8, 4, ?",
        content_data: {
          pattern_type: "geometrica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 64, 32, 16, 8, 4, ?
• Analizamos las relaciones entre términos consecutivos:

📊 Patrón geométrico:
• 64 ÷ 2 = 32
• 32 ÷ 2 = 16
• 16 ÷ 2 = 8
• 8 ÷ 2 = 4
• 4 ÷ 2 = 2

✅ Patrón identificado:
• La serie sigue una progresión geométrica dividiendo por 2
• Cada término es la mitad del anterior
• 4 ÷ 2 = 2

La respuesta correcta es C: 2`,
        option_a: "3", option_b: "1", option_c: "2", option_d: "0",
        correct_option: 2
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 2, 6, 18, 54, 162, ?",
        content_data: {
          pattern_type: "geometrica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 2, 6, 18, 54, 162, ?
• Analizamos las relaciones multiplicativas:

📊 Patrón geométrico:
• 2 × 3 = 6
• 6 × 3 = 18
• 18 × 3 = 54
• 54 × 3 = 162
• 162 × 3 = 486

✅ Patrón identificado:
• La serie sigue una progresión geométrica multiplicando por 3
• Cada término es el triple del anterior
• 162 × 3 = 486

La respuesta correcta es B: 486`,
        option_a: "324", option_b: "486", option_c: "648", option_d: "500",
        correct_option: 1
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 1, 4, 9, 16, 25, ?",
        content_data: {
          pattern_type: "cuadrados",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 1, 4, 9, 16, 25, ?
• Analizamos la relación con los números naturales:

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

La respuesta correcta es D: 36`,
        option_a: "30", option_b: "35", option_c: "49", option_d: "36",
        correct_option: 3
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 3, 7, 15, 31, 63, ?",
        content_data: {
          pattern_type: "exponencial",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 3, 7, 15, 31, 63, ?
• Analizamos el patrón subyacente:

📊 Análisis del patrón:
• 3 = 2² - 1 = 4 - 1
• 7 = 2³ - 1 = 8 - 1
• 15 = 2⁴ - 1 = 16 - 1
• 31 = 2⁵ - 1 = 32 - 1
• 63 = 2⁶ - 1 = 64 - 1
• ? = 2⁷ - 1 = 128 - 1

✅ Patrón identificado:
• Cada término sigue la fórmula: 2ⁿ - 1, donde n aumenta consecutivamente
• El siguiente término sería 2⁷ - 1 = 128 - 1 = 127

La respuesta correcta es A: 127`,
        option_a: "127", option_b: "125", option_c: "126", option_d: "129",
        correct_option: 0
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 5, 10, 20, 40, 80, ?",
        content_data: {
          pattern_type: "geometrica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 5, 10, 20, 40, 80, ?
• Analizamos las relaciones multiplicativas:

📊 Patrón geométrico:
• 5 × 2 = 10
• 10 × 2 = 20
• 20 × 2 = 40
• 40 × 2 = 80
• 80 × 2 = 160

✅ Patrón identificado:
• La serie sigue una progresión geométrica multiplicando por 2
• Cada término es el doble del anterior
• 80 × 2 = 160

La respuesta correcta es C: 160`,
        option_a: "100", option_b: "120", option_c: "160", option_d: "200",
        correct_option: 2
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 1, 1, 2, 3, 5, 8, ?",
        content_data: {
          pattern_type: "fibonacci",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 1, 1, 2, 3, 5, 8, ?
• Analizamos la relación entre términos:

📊 Patrón de Fibonacci:
• 1 + 1 = 2
• 1 + 2 = 3
• 2 + 3 = 5
• 3 + 5 = 8
• 5 + 8 = 13

✅ Patrón identificado:
• La serie sigue la secuencia de Fibonacci
• Cada término es la suma de los dos anteriores
• 5 + 8 = 13

La respuesta correcta es A: 13`,
        option_a: "13", option_b: "11", option_c: "12", option_d: "10",
        correct_option: 0
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 100, 81, 64, 49, 36, ?",
        content_data: {
          pattern_type: "cuadrados_descendente",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 100, 81, 64, 49, 36, ?
• Analizamos la relación con los cuadrados perfectos:

📊 Patrón de cuadrados descendentes:
• 100 = 10²
• 81 = 9²
• 64 = 8²
• 49 = 7²
• 36 = 6²
• ? = 5²

✅ Patrón identificado:
• La serie corresponde a los cuadrados de números naturales en orden descendente
• El siguiente término sería 5² = 25

La respuesta correcta es B: 25`,
        option_a: "20", option_b: "25", option_c: "30", option_d: "16",
        correct_option: 1
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 0, 1, 4, 9, 16, 25, ?",
        content_data: {
          pattern_type: "cuadrados",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 0, 1, 4, 9, 16, 25, ?
• Analizamos la relación con los números naturales:

📊 Patrón de cuadrados perfectos:
• 0 = 0²
• 1 = 1²
• 4 = 2²
• 9 = 3²
• 16 = 4²
• 25 = 5²
• ? = 6²

✅ Patrón identificado:
• La serie corresponde a los cuadrados de números naturales consecutivos empezando desde 0
• El siguiente término sería 6² = 36

La respuesta correcta es D: 36`,
        option_a: "30", option_b: "35", option_c: "49", option_d: "36",
        correct_option: 3
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 2, 8, 32, 128, 512, ?",
        content_data: {
          pattern_type: "exponencial",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 2, 8, 32, 128, 512, ?
• Analizamos las relaciones multiplicativas:

📊 Patrón exponencial:
• 2 × 4 = 8
• 8 × 4 = 32
• 32 × 4 = 128
• 128 × 4 = 512
• 512 × 4 = 2048

✅ Patrón identificado:
• La serie sigue una progresión geométrica multiplicando por 4
• Cada término es cuatro veces el anterior
• 512 × 4 = 2048

La respuesta correcta es A: 2048`,
        option_a: "2048", option_b: "1024", option_c: "2560", option_d: "1536",
        correct_option: 0
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 6, 12, 24, 48, 96, ?",
        content_data: {
          pattern_type: "geometrica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 6, 12, 24, 48, 96, ?
• Analizamos las relaciones multiplicativas:

📊 Patrón geométrico:
• 6 × 2 = 12
• 12 × 2 = 24
• 24 × 2 = 48
• 48 × 2 = 96
• 96 × 2 = 192

✅ Patrón identificado:
• La serie sigue una progresión geométrica multiplicando por 2
• Cada término es el doble del anterior
• 96 × 2 = 192

La respuesta correcta es C: 192`,
        option_a: "180", option_b: "200", option_c: "192", option_d: "144",
        correct_option: 2
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 1, 8, 27, 64, 125, ?",
        content_data: {
          pattern_type: "cubos",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 1, 8, 27, 64, 125, ?
• Analizamos la relación con los cubos perfectos:

📊 Patrón de cubos perfectos:
• 1 = 1³
• 8 = 2³
• 27 = 3³
• 64 = 4³
• 125 = 5³
• ? = 6³

✅ Patrón identificado:
• La serie corresponde a los cubos de números naturales consecutivos
• El siguiente término sería 6³ = 216

La respuesta correcta es B: 216`,
        option_a: "180", option_b: "216", option_c: "200", option_d: "243",
        correct_option: 1
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 3, 6, 12, 24, 48, ?",
        content_data: {
          pattern_type: "geometrica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 3, 6, 12, 24, 48, ?
• Analizamos las relaciones multiplicativas:

📊 Patrón geométrico:
• 3 × 2 = 6
• 6 × 2 = 12
• 12 × 2 = 24
• 24 × 2 = 48
• 48 × 2 = 96

✅ Patrón identificado:
• La serie sigue una progresión geométrica multiplicando por 2
• Cada término es el doble del anterior
• 48 × 2 = 96

La respuesta correcta es A: 96`,
        option_a: "96", option_b: "72", option_c: "84", option_d: "120",
        correct_option: 0
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 10, 20, 19, 38, 37, 74, ?",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 10, 20, 19, 38, 37, 74, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7): 10, 19, 37, ?
• Serie B (posiciones 2,4,6): 20, 38, 74

✅ Análisis de patrones:
• Serie A: 10 → 19 (+9), 19 → 37 (+18)
• El patrón en los incrementos: +9, +18 (se duplica)
• Siguiente incremento: +36, por lo tanto: 37 + 36 = 73

• Serie B: 20 → 38 (+18), 38 → 74 (+36)
• Los incrementos se duplican: +18, +36

La respuesta correcta es D: 73`,
        option_a: "70", option_b: "75", option_c: "72", option_d: "73",
        correct_option: 3
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 4, 16, 64, 256, 1024, ?",
        content_data: {
          pattern_type: "exponencial",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 4, 16, 64, 256, 1024, ?
• Analizamos las relaciones multiplicativas y exponenciales:

📊 Patrón exponencial:
• 4 = 2²
• 16 = 2⁴ (4 × 4)
• 64 = 2⁶ (16 × 4)
• 256 = 2⁸ (64 × 4)
• 1024 = 2¹⁰ (256 × 4)
• ? = 2¹² (1024 × 4)

✅ Patrón identificado:
• Cada término es 4 veces el anterior
• También se puede ver como potencias de 2 con exponentes pares: 2², 2⁴, 2⁶, 2⁸, 2¹⁰, 2¹²
• 1024 × 4 = 4096

La respuesta correcta es B: 4096`,
        option_a: "2048", option_b: "4096", option_c: "5120", option_d: "3072",
        correct_option: 1
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
        console.log(`❌ Error en pregunta ${i+82}:`, error.message)
      } else {
        insertedIds.push(data[0]?.id)
        console.log(`✅ Pregunta ${i+82} añadida: ${data[0]?.id}`)
      }
    }
    
    console.log('')
    console.log('🎯 RESUMEN FINAL:')
    console.log(`✅ ${insertedIds.length} preguntas de series numéricas añadidas (P82-P96)`)
    console.log('')
    console.log('🔗 LINKS DE DEBUG INDIVIDUALES:')
    insertedIds.forEach((id, index) => {
      console.log(`   P${index + 82}: http://localhost:3000/debug/question/${id}`)
    })
    
    return insertedIds
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
    return []
  }
}

addSeriesNumericas82_96()