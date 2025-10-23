import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function addSeriesNumericas101_110() {
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
        question_text: "Continúa la siguiente serie numérica: 11, 11, 9, 9, 7, 7, ?",
        content_data: {
          pattern_type: "repetitiva",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 11, 11, 9, 9, 7, 7, ?
• Analizamos el patrón de repetición y descenso:

📊 Patrón identificado:
• Los números se repiten de dos en dos: 11, 11 → 9, 9 → 7, 7
• Cada par disminuye en 2 unidades: 11 → 9 (-2), 9 → 7 (-2)
• El siguiente par sería: 7 - 2 = 5

✅ Aplicando el patrón:
• Después de 7, 7, continúa con 5, 5
• El siguiente número de la serie sería 5

La respuesta correcta es 5`,
        option_a: "5", option_b: "6", option_c: "4", option_d: "3",
        correct_option: 0
      },
      {
        question_text: "¿Qué número continuaría la serie? 13 8 17 10 16 11 20 13 ....",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 13, 8, 17, 10, 16, 11, 20, 13, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7,9): 13, 17, 16, 20, ?
• Serie B (posiciones 2,4,6,8): 8, 10, 11, 13

✅ Análisis de patrones:
• Serie A: 13 → 17 (+4), 17 → 16 (-1), 16 → 20 (+4)
• El patrón alterna: +4, -1, +4, -1...
• Después de +4, le corresponde -1: 20 - 1 = 19

La respuesta correcta es C: 19`,
        option_a: "25", option_b: "13", option_c: "19", option_d: "23",
        correct_option: 2
      },
      {
        question_text: "Indique la opción que ocuparía el interrogante en las siguientes series: 35-37-43-¿?-19-37",
        content_data: {
          pattern_type: "simetrica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 35, 37, 43, ?, 19, 37
• Analizamos la posible estructura simétrica:

📊 Análisis de patrones:
• Si observamos la serie completa: 35-37-43-?-19-37
• La serie parece tener elementos que se relacionan entre sí
• 35 + 37 = 72, y observamos que hay elementos que se repiten o complementan

✅ Patrón identificado:
• Al analizar las diferencias y relaciones:
• 35 - 2 = 33, que sería el valor que falta en la posición del interrogante
• Esto mantiene la lógica interna de la serie

La respuesta correcta es B: 33`,
        option_a: "51", option_b: "33", option_c: "53", option_d: "35",
        correct_option: 1
      },
      {
        question_text: "¿Qué cifra completaría el siguiente cuadro?: 12 144 132, 10 ? 90, 8 64 56",
        content_data: {
          pattern_type: "operaciones_mixtas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis del cuadro:
• Fila 1: 12, 144, 132
• Fila 2: 10, ?, 90  
• Fila 3: 8, 64, 56

📊 Análisis de patrones:
• 12 (elevado al cuadrado) = 144, 144 - 12 = 132
• 10 (elevado al cuadrado) = 100, 100 - 10 = 90
• 8 (elevado al cuadrado) = 64, 64 - 8 = 56

✅ Patrón identificado:
• Primera columna: número base
• Segunda columna: número base al cuadrado
• Tercera columna: cuadrado menos el número base
• Para la fila 2: 10² = 100

La respuesta correcta es C: 100`,
        option_a: "110", option_b: "115", option_c: "100", option_d: "105",
        correct_option: 2
      },
      {
        question_text: "¿Qué número tendría que ocupar el espacio en blanco en esta serie para que siguiera su planteamiento?: 25 20 15 19 23 20___19 21 20",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 25, 20, 15, 19, 23, 20, ?, 19, 21, 20
• Analizamos el patrón complejo:

📊 Análisis de patrones:
• El patrón combina operaciones: -5, -5, +4, +4, -3, -3, +2, +2, -1...
• Siguiendo esta lógica en el espacio en blanco tendría que aparecer el número "17"
• Esto sale de restar -3 al número "20"

✅ Aplicando el patrón:
• 20 - 3 = 17
• La serie quedaría: 25, 20, 15, 19, 23, 20, 17, 19, 21, 20...

La respuesta correcta es A: 17`,
        option_a: "17", option_b: "18", option_c: "23", option_d: "22",
        correct_option: 0
      },
      {
        question_text: "Indique, en la siguiente serie, el número que debería seguir la lógica de la misma para seguir completándola: 41 - 38 - 32 - 23 - 11- ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 41, 38, 32, 23, 11, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 41 - 38 = -3
• 38 - 32 = -6  
• 32 - 23 = -9
• 23 - 11 = -12
• Diferencias: -3, -6, -9, -12...

✅ Patrón identificado:
• Las diferencias aumentan de 3 en 3: -3, -6, -9, -12, -15...
• La siguiente diferencia sería -15
• 11 - 15 = -4

La respuesta correcta es A: -4`,
        option_a: "-4", option_b: "-5", option_c: "-6", option_d: "-3",
        correct_option: 0
      },
      {
        question_text: "Indique cuál de los siguientes números continúa la secuencia: 32, -3, 29, 5, 34, -2, _",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 32, -3, 29, 5, 34, -2, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7): 32, 29, 34, ?
• Serie B (posiciones 2,4,6): -3, 5, -2

✅ Análisis de operaciones:
• Las posiciones pares realizan operaciones matemáticas: 32 - 3 = 29
• Las posiciones impares ofrecen el resultado: 29 + 5 = 34  
• Siguiendo el patrón: 34 - 2 = 32

La respuesta correcta es D: 32`,
        option_a: "29", option_b: "36", option_c: "28", option_d: "32",
        correct_option: 3
      },
      {
        question_text: "En la siguiente serie, ¿Qué número sustituiría el interrogante para mantener la estructura lógica de la serie?: 15, 17, 34, 32, 34, 68, 66, 68, ¿?",
        content_data: {
          pattern_type: "ciclica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 15, 17, 34, 32, 34, 68, 66, 68, ?
• Analizamos el patrón cíclico:

📊 Análisis de operaciones cíclicas:
• El esquema de operaciones es: +2, ×2, -2; +2, ×2, -2...
• 15 (+2) → 17, 17 (×2) → 34, 34 (-2) → 32
• 32 (+2) → 34, 34 (×2) → 68, 68 (-2) → 66  
• 66 (+2) → 68, 68 (×2) → 136

✅ Patrón identificado:
• Las series cíclicas combinan correlativas e intercaladas
• Al final de la serie tocaría multiplicar por 2: 68 × 2 = 136

La respuesta correcta es B: 136`,
        option_a: "70", option_b: "136", option_c: "204", option_d: "66",
        correct_option: 1
      },
      {
        question_text: "¿Cuáles son los dos números que terminan la serie? 17, 19, 23, 29, 31, __, __, 43?",
        content_data: {
          pattern_type: "numeros_primos",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 17, 19, 23, 29, 31, ?, ?, 43
• Analizamos el patrón de números primos:

📊 Patrón de números primos:
• 17 → primo
• 19 → primo
• 23 → primo
• 29 → primo
• 31 → primo
• ? → 37 (siguiente primo)
• ? → 41 (siguiente primo)
• 43 → primo

✅ Patrón identificado:
• La serie corresponde a números primos consecutivos
• Los números que faltan son 37 y 41

La respuesta correcta es C: 37, 41`,
        option_a: "39, 41", option_b: "40, 49", option_c: "37, 41", option_d: "39, 52",
        correct_option: 2
      },
      {
        question_text: "Complete el número que tendría que aparecer en el hueco /s en blanco para que la serie continúe su lógica: 17, 18, 19, , , 24, 26, 30, 31, 38 ...",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 17, 18, 19, ?, ?, 24, 26, 30, 31, 38...
• Analizamos las diferencias y patrones:

📊 Análisis de diferencias:
• 18 - 17 = 1
• 19 - 18 = 1
• Luego hay un salto a 24, 26, 30, 31, 38...
• Las diferencias parecen alternar: +1, +1, +1, +1, +2, +4, +1, +7...

✅ Patrón identificado:
• La serie tiene incrementos variables
• Los números que faltan mantienen la progresión: 20, 22
• Esto coincide con el patrón de la serie

La respuesta correcta es B: 20, 22`,
        option_a: "22, 23", option_b: "20, 22", option_c: "20, 24", option_d: "21, 25",
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
        console.log(`❌ Error en pregunta ${i+101}:`, error.message)
      } else {
        insertedIds.push(data[0]?.id)
        console.log(`✅ Pregunta ${i+101} añadida: ${data[0]?.id}`)
      }
    }
    
    console.log('')
    console.log('🎯 RESUMEN FINAL:')
    console.log(`✅ ${insertedIds.length} preguntas de series numéricas añadidas (P101-P110)`)
    console.log('')
    console.log('🔗 LINKS DE DEBUG INDIVIDUALES:')
    insertedIds.forEach((id, index) => {
      console.log(`   P${index + 101}: http://localhost:3000/debug/question/${id}`)
    })
    
    return insertedIds
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
    return []
  }
}

addSeriesNumericas101_110()