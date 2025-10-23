import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function addSeriesNumericas111_125() {
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
        question_text: "Continúe la serie: B 19 Q 22 F 17 V 20 J 15 A 18 N 13 F ? ?",
        content_data: {
          pattern_type: "alfanumerica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie alfanumérica:
• Serie: B 19 Q 22 F 17 V 20 J 15 A 18 N 13 F ? ?
• Analizamos las series de letras y números por separado:

📊 Series alternativas:
• Serie de letras: B, F, J, N (suma +4), Q, V, A, F (suma +5)
• Serie de números: 19, 17, 15, 13 (restar -2), 22, 20, 18, 16 (restar -2)

✅ Patrón identificado:
• Las diferencias aumentan de 2 en 2: +4, +6, +8, +10, +12, +14...
• La siguiente diferencia sería +14
• F + 4 = J en el alfabeto, pero siguiendo el patrón sería 16Q

La respuesta correcta es B: 16Q`,
        option_a: "4P", option_b: "16Q", option_c: "14R", option_d: "16S",
        correct_option: 1
      },
      {
        question_text: "¿Qué número es erróneo en la serie? 10, 15, 20, 25, 30, 35, 43, 45 ...",
        content_data: {
          pattern_type: "error_detection",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie para detectar error:
• Serie: 10, 15, 20, 25, 30, 35, 43, 45...
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 15 - 10 = 5
• 20 - 15 = 5
• 25 - 20 = 5
• 30 - 25 = 5
• 35 - 30 = 5
• 43 - 35 = 8 (ERROR)
• 45 - 43 = 2

✅ Error identificado:
• La serie debería seguir sumando +5 constantemente
• Después de 35 debería venir 40, no 43
• El número erróneo es 43

La respuesta correcta es B: 43`,
        option_a: "50", option_b: "43", option_c: "45", option_d: "35",
        correct_option: 1
      },
      {
        question_text: "Indique, en la siguiente serie, el número que debería seguir la lógica de la misma para seguir completándola: 0, 5, 9, 15, 20, 27, 33, ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 0, 5, 9, 15, 20, 27, 33, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 5 - 0 = 5
• 9 - 5 = 4
• 15 - 9 = 6
• 20 - 15 = 5
• 27 - 20 = 7
• 33 - 27 = 6
• Diferencias: 5, 4, 6, 5, 7, 6...

✅ Patrón identificado:
• Las diferencias alternan en dos series: (5, 6, 7...) y (4, 5, 6...)
• Después de 6, le corresponde 8 de la primera serie
• 33 + 8 = 41

La respuesta correcta es D: 41`,
        option_a: "45", option_b: "38", option_c: "36", option_d: "41",
        correct_option: 3
      },
      {
        question_text: "¿Qué número sustituiría la interrogación? 10, 12, 14, 8, 9, 10, 11, 13, 15, ___, ?, 9",
        content_data: {
          pattern_type: "bloques",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie en bloques:
• Serie: 10, 12, 14, 8, 9, 10, 11, 13, 15, ___, ?, 9
• Analizamos los bloques de tres números:

📊 Análisis por bloques:
• Bloque 1: 10-12-14
• Bloque 2: 8-9-10
• Bloque 3: 11-13-15
• Bloque 4: 7-8-9

✅ Patrón identificado:
• Los bloques siguen patrones: primeros números de cada bloque van seguidos: 10, 8, 11, 7...
• Los segundos números: 12, 9, 13, 8...
• Los terceros números: 14, 10, 15, 9
• En el espacio en blanco tendría que aparecer el número "8"

La respuesta correcta es B: 8`,
        option_a: "7", option_b: "8", option_c: "11", option_d: "9",
        correct_option: 1
      },
      {
        question_text: "¿Qué dos números faltarían en la siguiente serie para que su continuidad tenga sentido?: 1, 5, 13, 25, 41, ¿?, ¿?, 113, 145",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 1, 5, 13, 25, 41, ?, ?, 113, 145
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 5 - 1 = 4
• 13 - 5 = 8
• 25 - 13 = 12
• 41 - 25 = 16
• Diferencias: 4, 8, 12, 16... (incrementos de +4)

✅ Patrón identificado:
• Las diferencias aumentan de 4 en 4: +4, +8, +12, +16, +20, +24, +28, +32
• 41 + 20 = 61
• 61 + 24 = 85
• 85 + 28 = 113 ✓
• 113 + 32 = 145 ✓

La respuesta correcta es A: 61, 85`,
        option_a: "61, 85", option_b: "62, 84", option_c: "61, 84", option_d: "60, 85",
        correct_option: 0
      },
      {
        question_text: "En las siguiente serie, tiene que indicar el número que no sigue el orden lógico de la misma: 3 9 4 11 33 28 35 105 101",
        content_data: {
          pattern_type: "error_detection",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie para detectar error:
• Serie: 3, 9, 4, 11, 33, 28, 35, 105, 101
• Analizamos el patrón subyacente:

📊 Análisis de patrones:
• 3 × 3 = 9, 9 - 5 = 4
• 4 × 3 = 12 (no 11), 11 × 3 = 33, 33 - 5 = 28
• 28 + 7 = 35, 35 × 3 = 105, 105 - 4 = 101

✅ Error identificado:
• El patrón sugiere operaciones de multiplicación y resta
• En la secuencia, el número que rompe la lógica es 101
• Debería seguir un patrón más consistente

La respuesta correcta es A: 101`,
        option_a: "101", option_b: "28", option_c: "9", option_d: "105",
        correct_option: 0
      },
      {
        question_text: "En la siguiente serie: 1 2 1 2 3 2 3 5 4, existe un número que no sigue el razonamiento de la misma, indíquelo:",
        content_data: {
          pattern_type: "error_detection",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie para detectar error:
• Serie: 1, 2, 1, 2, 3, 2, 3, 5, 4
• Analizamos el patrón por grupos de tres:

📊 Análisis por grupos:
• Grupo 1: 1, 2, 1
• Grupo 2: 2, 3, 2  
• Grupo 3: 3, 4, 3 (pero aparece 3, 5, 4)

✅ Error identificado:
• El patrón debería ser: primero aumenta +1, luego vuelve al número inicial
• En el tercer grupo: 3, 4, 3 (correcto)
• Pero aparece: 3, 5, 4
• El número erróneo es el primer 5

La respuesta correcta es A: El primer 5`,
        option_a: "El primer 5", option_b: "El segundo 3", option_c: "El primer 1", option_d: "segundo 4",
        correct_option: 0
      },
      {
        question_text: "Indique el número que falta en la siguiente matriz: 14 9 20, 12 5 14, 10 3 ¿?",
        content_data: {
          pattern_type: "matriz",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la matriz:
• Matriz: 14 9 20
•         12 5 14  
•         10 3 ?

📊 Análisis de relaciones:
• 14 + 9 = 23, pero aparece 20
• 12 + 5 = 17, pero aparece 14
• 10 + 3 = 13, y el patrón sería restar 3

✅ Patrón identificado:
• Fila 1: 14 + 9 - 3 = 20
• Fila 2: 12 + 5 - 3 = 14
• Fila 3: 10 + 3 - 3 = 10

La respuesta correcta es C: 10`,
        option_a: "12", option_b: "21", option_c: "10", option_d: "11",
        correct_option: 2
      },
      {
        question_text: "Indique la opción que ocuparía el interrogante en las siguientes series: 70-78-62-¿?- 54",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 70, 78, 62, ?, 54
• Analizamos las diferencias:

📊 Análisis de diferencias:
• 78 - 70 = +8
• 62 - 78 = -16
• ? - 62 = ?
• 54 - ? = ?

✅ Patrón identificado:
• La serie alterna entre operaciones: +8, -16
• Si continuamos el patrón: +8, -16, +8, -16
• 62 + 8 = 70 (pero eso nos devolvería al inicio)
• Mejor análisis: 70 → 78 (+8), 78 → 62 (-16), 62 → 70 (+8), 70 → 54 (-16)

La respuesta correcta es D: 70`,
        option_a: "52", option_b: "72", option_c: "46", option_d: "70",
        correct_option: 3
      },
      {
        question_text: "En la siguiente matriz numérica, indique el número que tendría que aparecer en lugar del interrogante siguiendo un patrón lógico. 12 (56) 16, 17 (¿?) 21",
        content_data: {
          pattern_type: "matriz",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la matriz:
• Fila 1: 12 (56) 16
• Fila 2: 17 (?) 21

📊 Análisis de relaciones:
• 12 + 16 = 28, 28 × 2 = 56
• 17 + 21 = 38, siguiendo el patrón: 38 × 2 = 76

✅ Patrón identificado:
• Se suman los valores de los extremos de la fila
• El resultado se multiplica por 2 y se coloca en el centro
• 17 + 21 = 38 × 2 = 76

La respuesta correcta es A: 76`,
        option_a: "76", option_b: "72", option_c: "43", option_d: "46",
        correct_option: 0
      },
      {
        question_text: "¿Qué número continúa la serie? 6, 18, 38, 66, ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 6, 18, 38, 66, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 18 - 6 = 12
• 38 - 18 = 20
• 66 - 38 = 28
• Diferencias: 12, 20, 28... (incrementos de +8)

✅ Patrón identificado:
• Las diferencias aumentan de 8 en 8: +12, +20, +28, +36
• La siguiente diferencia sería +36
• 66 + 36 = 102

La respuesta correcta es A: 102`,
        option_a: "102", option_b: "73", option_c: "89", option_d: "95",
        correct_option: 0
      },
      {
        question_text: "Continue la serie que se le presenta a continuación: 90 88 88 86 172 170 510...",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 90, 88, 88, 86, 172, 170, 510...
• Analizamos los patrones intercalados:

📊 Análisis de patrones intercalados:
• Doble patrón que va intercalándose en la serie:
• 1) -2, -2, -2... como constante
• 2) ×1, ×2, ×3, ×4... incrementándose

✅ Patrón identificado:
• 90 → 88 (-2), 88 → 86 (-2), luego 86 × 2 = 172
• 172 → 170 (-2), luego 170 × 3 = 510  
• Correspondería por la posición restar -2 al último número: 510 - 2 = 508

La respuesta correcta es B: 508`,
        option_a: "1530", option_b: "508", option_c: "1020", option_d: "507",
        correct_option: 1
      },
      {
        question_text: "Indique la opción que continúa la serie: 6-9-7-8-11-9-10-13-¿?",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 6, 9, 7, 8, 11, 9, 10, 13, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7,9): 6, 7, 9, 10, ?
• Serie B (posiciones 2,4,6,8): 9, 8, 11, 13

✅ Análisis de patrones:
• Serie A: +1, +2, +1... (alterna entre +1 y +2)
• Después de 10, le corresponde +1: 10 + 1 = 11

La respuesta correcta es C: 11`,
        option_a: "14", option_b: "12", option_c: "11", option_d: "13",
        correct_option: 2
      },
      {
        question_text: "11-15-12-16-13-17-?",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 11, 15, 12, 16, 13, 17, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7): 11, 12, 13, ?
• Serie B (posiciones 2,4,6): 15, 16, 17

✅ Análisis de patrones:
• Serie A: aumenta de 1 en 1: 11, 12, 13, 14
• Serie B: aumenta de 1 en 1: 15, 16, 17
• El siguiente número de la serie A sería 14

La respuesta correcta es B: 14`,
        option_a: "10", option_b: "14", option_c: "12", option_d: "16",
        correct_option: 1
      },
      {
        question_text: "¿Qué número de la serie va en la incógnita? 3, 7, 6, 2, 12, -3, ¿?, -8, 48, -13 ...",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 3, 7, 6, 2, 12, -3, ?, -8, 48, -13...
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7,9): 3, 6, 12, ?, 48
• Serie B (posiciones 2,4,6,8,10): 7, 2, -3, -8, -13

✅ Análisis de patrones:
• Serie A: ×2 cada vez: 3 → 6 (×2), 6 → 12 (×2), 12 → 24 (×2), 24 → 48 (×2)
• Serie B: -5 cada vez: 7 → 2 (-5), 2 → -3 (-5), -3 → -8 (-5), -8 → -13 (-5)
• El número que falta es 24

La respuesta correcta es D: 24`,
        option_a: "-5", option_b: "8", option_c: "36", option_d: "24",
        correct_option: 3
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
        console.log(`❌ Error en pregunta ${i+111}:`, error.message)
      } else {
        insertedIds.push(data[0]?.id)
        console.log(`✅ Pregunta ${i+111} añadida: ${data[0]?.id}`)
      }
    }
    
    console.log('')
    console.log('🎯 RESUMEN FINAL:')
    console.log(`✅ ${insertedIds.length} preguntas de series numéricas añadidas (P111-P125)`)
    console.log('')
    console.log('🔗 LINKS DE DEBUG INDIVIDUALES:')
    insertedIds.forEach((id, index) => {
      console.log(`   P${index + 111}: http://localhost:3000/debug/question/${id}`)
    })
    
    return insertedIds
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
    return []
  }
}

addSeriesNumericas111_125()