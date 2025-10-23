import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function addSeriesNumericas66_81() {
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
        question_text: "¿Qué número continuaría la siguiente serie lógica? 24, 12, 36, 18, 54, 27, ¿?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 24, 12, 36, 18, 54, 27, ?
• Analizamos las operaciones entre términos consecutivos:

📊 Patrón identificado:
• Debemos observar toda la secuencia numérica para ver qué premisa sigue
• El planteamiento de la serie sería: :2 ×3 :2 ×3 :2 ×3...
• Siguiendo este patrón: 27 × 3 = 81

✅ Aplicando el patrón:
• 24 ÷ 2 = 12
• 12 × 3 = 36  
• 36 ÷ 2 = 18
• 18 × 3 = 54
• 54 ÷ 2 = 27
• 27 × 3 = 81

La respuesta correcta es A: 81`,
        option_a: "81", option_b: "30", option_c: "54", option_d: "29",
        correct_option: 0
      },
      {
        question_text: "Indique el número que continúa la serie: 6-11-18-27-¿?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 6, 11, 18, 27, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 11 - 6 = 5
• 18 - 11 = 7
• 27 - 18 = 9
• Diferencias: 5, 7, 9... (números impares)

✅ Patrón identificado:
• Las diferencias son números impares consecutivos: 5, 7, 9, 11...
• Siguiente diferencia: 11
• 27 + 11 = 38

La respuesta correcta es D: 38`,
        option_a: "36", option_b: "35", option_c: "24", option_d: "38",
        correct_option: 3
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 5, 10, 12, 36, 39, 156, ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 5, 10, 12, 36, 39, 156, ?
• Analizamos las operaciones entre términos:

📊 Patrón identificado:
• Multiplica por 2, suma 2, multiplica por 3, suma 3, multiplica por 4, toca sumar 4
• 5 × 2 = 10
• 10 + 2 = 12  
• 12 × 3 = 36
• 36 + 3 = 39
• 39 × 4 = 156
• 156 + 4 = 160

✅ Aplicando el patrón:
• Siguiente operación: sumar 4
• 156 + 4 = 160

La respuesta correcta es A: 160`,
        option_a: "160", option_b: "154", option_c: "176", option_d: "172",
        correct_option: 0
      },
      {
        question_text: "Indique el número que continúa la serie: 2-4-8-6-8-16-14-¿?",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 2, 4, 8, 6, 8, 16, 14, ?
• Analizamos las series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7): 2, 8, 8, 14, ? 
• Serie B (posiciones 2,4,6,8): 4, 6, 16, ?

✅ Patrón identificado:
• Observamos dos series donde una multiplica por 2 y otra resta 2
• Siguiendo el patrón de la serie intercalada, el número que continúa sería 16

La respuesta correcta es A: 16`,
        option_a: "16", option_b: "12", option_c: "25", option_d: "14",
        correct_option: 0
      },
      {
        question_text: "¿Qué número continuaría la serie? 23 33 39 48 55 63 ....",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 23, 33, 39, 48, 55, 63, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 33 - 23 = 10
• 39 - 33 = 6
• 48 - 39 = 9
• 55 - 48 = 7
• 63 - 55 = 8
• Diferencias: 10, 6, 9, 7, 8...

✅ Patrón identificado:
• Es una serie intercalada. La parte que nos interesa va sumando + 16 y es la siguiente: 23 39 55, con lo que corresponde 71

La respuesta correcta es A: 71`,
        option_a: "71", option_b: "67", option_c: "73", option_d: "70",
        correct_option: 0
      },
      {
        question_text: "Indique el número que continúa la siguiente serie: 2, 7, 22, 67, 202",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 2, 7, 22, 67, 202, ?
• Analizamos las operaciones entre términos:

📊 Patrón identificado:
• La serie, en su estructura, combina dos operaciones que se repiten a lo largo de toda la serie: (×3 +1)
• 2 (×3 +1) = 7
• 7 (×3 +1) = 22  
• 22 (×3 +1) = 67
• 67 (×3 +1) = 202
• 202 (×3 +1) = 607

✅ Aplicando el patrón:
• 202 × 3 + 1 = 606 + 1 = 607

La respuesta correcta es D: 607`,
        option_a: "432", option_b: "710", option_c: "567", option_d: "607",
        correct_option: 3
      },
      {
        question_text: "¿Qué número continuará la serie? 80, 75, 71, 68, 66, ¿?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 80, 75, 71, 68, 66, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 80 - 75 = -5
• 75 - 71 = -4
• 71 - 68 = -3
• 68 - 66 = -2
• Diferencias: -5, -4, -3, -2... 

✅ Patrón identificado:
• Las diferencias van disminuyendo en 1 cada vez
• Siguiente diferencia: -1
• 66 - 1 = 65

La respuesta correcta es B: 65`,
        option_a: "70", option_b: "65", option_c: "50", option_d: "60",
        correct_option: 1
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 83, 79, 82, 78, 81, 77, ?",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 83, 79, 82, 78, 81, 77, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7): 83, 82, 81, ?
• Serie B (posiciones 2,4,6,8): 79, 78, 77, ?

✅ Patrón identificado:
• En el presente caso: Resta 4, suma 3, resta 4, suma 3, resta 4, ahora toca sumar 3
• Otro planteamiento sería como series alternas:
• 83 79 82 78 81 77 ...vendría el 80. (cada serie va -1). La solución no varía

La respuesta correcta es B: 80`,
        option_a: "78", option_b: "80", option_c: "79", option_d: "77",
        correct_option: 1
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 3, 5, 7, 9, 11, 13, ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 3, 5, 7, 9, 11, 13, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 5 - 3 = 2
• 7 - 5 = 2
• 9 - 7 = 2
• 11 - 9 = 2
• 13 - 11 = 2
• Diferencia constante: 2

✅ Patrón identificado:
• En este caso como podemos ver tenemos una serie donde la lógica que sigue son los números impares correlativos
• 13 + 2 = 15

La respuesta correcta es B: 15`,
        option_a: "17", option_b: "15", option_c: "19", option_d: "21",
        correct_option: 1
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 45, 47, 46, 48, 47, 49, ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 45, 47, 46, 48, 47, 49, ?
• Analizamos las operaciones entre términos:

📊 Patrón identificado:
• En el caso que nos sigue: Suma dos, resta 1, suma 2, resta 1, suma 2, ahora tocaría restar 1
• 45 + 2 = 47
• 47 - 1 = 46
• 46 + 2 = 48
• 48 - 1 = 47
• 47 + 2 = 49
• 49 - 1 = 48

✅ Aplicando el patrón:
• Siguiente operación: restar 1
• 49 - 1 = 48

La respuesta correcta es C: 48`,
        option_a: "49", option_b: "51", option_c: "48", option_d: "50",
        correct_option: 2
      },
      {
        question_text: "Marque la respuesta que indique el número que continuaría la siguiente serie numérica: 12 10 14 7 16 4 18",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 12, 10, 14, 7, 16, 4, 18, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7): 12, 14, 16, 18, ? (va sumando +2)
• Serie B (posiciones 2,4,6,8): 10, 7, 4, ? (va restando -3)

✅ Patrón identificado:
• SERIES INTERCALADAS El concepto de intercalado hace referencia al hecho de que la relación de los dígitos de la serie no es de uno en uno, sino que vamos saltando cifras
• Dos series alternas:
• 1- 12 - 14 - 16 - 18 va sumando (+2)
• 2- 10 - 7 - 4 - ¿? va restando (-3) Esta serie es la que nos interesa para contestar: 4 - 3 = 1 que sería el resultado

La respuesta correcta es C: 1`,
        option_a: "21", option_b: "20", option_c: "1", option_d: "2",
        correct_option: 2
      },
      {
        question_text: "Encuentre la lógica de la siguiente serie e indique el número que la continuaría: 5 10 12 36 39 156 160 800...",
        content_data: {
          pattern_type: "ciclica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 5, 10, 12, 36, 39, 156, 160, 800, ?
• Analizamos las operaciones entre términos:

📊 Patrón identificado:
• Las series cíclicas son una combinación de las correlativas e intercaladas
• Este tipo de series implican realizar una y otra vez las mismas operaciones
• La serie sigue dos planteamientos matemáticos que se van alternando:
• 1) va multiplicando siguiendo la numeración natural: ×2 ×3 ×4 ×5 ...
• 2) va sumando siguiendo también la numeración natural: +2 +3 +4 +5...
• La serie iría: 5 ×2 = 10 +2 = 12 ×3 = 36 +3 = 39 ×4 = 156 +4 = 160 ×5 = 800... ahora vendría un +5, 800+5 = 805 que sería el resultado que nos piden

✅ Aplicando el patrón:
• Siguiente operación en el ciclo: +5
• 800 + 5 = 805

La respuesta correcta es A: 805`,
        option_a: "805", option_b: "806", option_c: "4800", option_d: "804",
        correct_option: 0
      },
      {
        question_text: "Complete la siguiente serie: 20, 17, 13, 18, 24, 17, ¿?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 20, 17, 13, 18, 24, 17, ?
• Analizamos las operaciones entre términos:

📊 Patrón identificado:
• En este caso el planteamiento sería: -3 -4 +5 +6 -7 -8 ...
• 20 - 3 = 17
• 17 - 4 = 13
• 13 + 5 = 18
• 18 + 6 = 24
• 24 - 7 = 17
• 17 - 8 = 9

✅ Aplicando el patrón:
• Siguiente operación: -8
• 17 - 8 = 9

La respuesta correcta es C: 9`,
        option_a: "10", option_b: "11", option_c: "9", option_d: "16",
        correct_option: 2
      },
      {
        question_text: "Según la siguiente seria lógica, ¿Qué número la continuaría? 10, 6, 12, 9, 14, 12, 16, ¿?",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 10, 6, 12, 9, 14, 12, 16, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7): 10, 12, 14, 16, ? (va sumando +2)
• Serie B (posiciones 2,4,6,8): 6, 9, 12, ? (va sumando +3)

✅ Patrón identificado:
• El concepto de serie intercalada se refiere al hecho que la relación entre los dígitos no es de uno con el siguiente y así sucesivamente, sino que se van saltando cifras
• En este ejercicio la relación sería: 10, 12, 14, 16 irían +2 ; mientras que el otro grupo 6, 9, 12, 15...irían sumando +3

La respuesta correcta es B: 15`,
        option_a: "16", option_b: "15", option_c: "17", option_d: "18",
        correct_option: 1
      },
      {
        question_text: "Indique el número que continuaría la serie que le presentan: 8 8 9 8 10 8 11 8 12 8 ...",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 8, 8, 9, 8, 10, 8, 11, 8, 12, 8, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7,9,11): 8, 9, 10, 11, 12, ? (va sumando +1)
• Serie B (posiciones 2,4,6,8,10,12): 8, 8, 8, 8, 8, ? (constante en 8)

✅ Patrón identificado:
• Parece claro en esta serie las dos subseries que aparecen: una en las posiciones pares repite el 8 de manera constante y la otra en las posiciones impares va avanzando según la numeración natural : 8, 9, 10, 11, ...
• En nuestro caso correspondería seguir esta última subserie, tendría que ir un 13 que es el número buscado

La respuesta correcta es D: 13`,
        option_a: "8", option_b: "11", option_c: "12", option_d: "13",
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
        console.log(`❌ Error en pregunta ${i+66}:`, error.message)
      } else {
        insertedIds.push(data[0]?.id)
        console.log(`✅ Pregunta ${i+66} añadida: ${data[0]?.id}`)
      }
    }
    
    console.log('')
    console.log('🎯 RESUMEN FINAL:')
    console.log(`✅ ${insertedIds.length} preguntas de series numéricas añadidas (P66-P81)`)
    console.log('')
    console.log('🔗 LINKS DE DEBUG INDIVIDUALES:')
    insertedIds.forEach((id, index) => {
      console.log(`   P${index + 66}: http://localhost:3000/debug/question/${id}`)
    })
    
    return insertedIds
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
    return []
  }
}

addSeriesNumericas66_81()